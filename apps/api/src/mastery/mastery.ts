import {
  COMPONENT_WEIGHTS,
  CONFIDENCE_ATTEMPTS,
  DIFFICULTY_WEIGHTS,
  HINT_DEPENDENCY_WEIGHT,
  HINT_LEVEL_WEIGHTS,
  MASTERY_BANDS,
  type ComponentName,
} from './mastery-weights'

/**
 * The materialised counters a score is computed from.
 *
 * Deliberately plain numbers and nothing else — no Prisma types, no database.
 * The formula is the part that has to be right, so it is the part that is a
 * pure function with no way to reach anything.
 */
export interface MasteryCounters {
  /** Distinct problems attempted. Not submissions: retrying is not evidence. */
  attempts: number
  solved: number
  /** Solved on the first graded submission. The honest accuracy signal. */
  firstAttemptSolved: number

  /** Phase 6 fills these. Until then retention is unmeasured, not zero. */
  revisionAttempts: number
  revisionSuccesses: number

  easyAttempts: number
  easySolved: number
  mediumAttempts: number
  mediumSolved: number
  hardAttempts: number
  hardSolved: number

  /** Distinct patterns solved, and how many the topic has to offer. */
  patternsSolved: number
  patternsAvailable: number

  /**
   * Sum of per-problem clamped speed ratios, and how many went into it.
   *
   * A sum of ratios rather than a sum of times: one three-hour session with the
   * tab left open would otherwise sink the component for good. Each sample is
   * clamped to 0..1 before it is added, so no single problem can move the mean
   * by more than one sample's worth.
   */
  speedRatioSum: number
  speedSamples: number

  /** Weighted by the hint level reached, not a plain count. */
  hintWeightedSolves: number
}

export interface MasteryComponent {
  name: ComponentName | 'hintDependency'
  /** 0..1, or null when there is nothing to measure it from. */
  value: number | null
  /** The weight actually applied, after unmeasured components are redistributed. */
  weight: number
}

export interface MasteryScore {
  /** 0..100, rounded. The number stored and shown. */
  score: number
  band: string
  /** True until there are enough attempts for the score to mean anything. */
  lowData: boolean
  confidence: number
  /** Every component, including the ones that could not be measured. */
  components: MasteryComponent[]
}

/**
 * The formula from docs/mastery-model.md.
 *
 * Pure and deterministic: same counters in, same score out, always. That is
 * what makes every degenerate case in the test suite directly checkable, and it
 * is why nothing here reads a clock or a database.
 */
export function computeMastery(counters: MasteryCounters): MasteryScore {
  const measured = measureComponents(counters)
  const confidence = Math.min(1, counters.attempts / CONFIDENCE_ATTEMPTS)

  /*
   * Unmeasured components hand their weight to the ones that *can* be measured.
   *
   * The alternative is to score them zero, which reads as "you failed at this"
   * when it means "nobody has asked you yet". Retention is the case that
   * matters today: revision does not exist until Phase 6, so scoring it zero
   * would cap every user in the product at 80% of a number they had no way to
   * earn. A pattern row has no `patternCoverage` either — coverage is a
   * topic-level idea.
   */
  const measuredTotal = (Object.keys(COMPONENT_WEIGHTS) as ComponentName[])
    .filter((name) => measured[name] !== null)
    .reduce((total, name) => total + COMPONENT_WEIGHTS[name], 0)

  const components: MasteryComponent[] = (Object.keys(COMPONENT_WEIGHTS) as ComponentName[]).map(
    (name) => ({
      name,
      value: measured[name],
      // Everything unmeasured means nothing to score. Zero, not a division by it.
      weight: measured[name] === null || measuredTotal === 0 ? 0 : COMPONENT_WEIGHTS[name] / measuredTotal,
    }),
  )

  const positive = components.reduce(
    (total, component) => total + (component.value ?? 0) * component.weight,
    0,
  )

  const hintDependency = measured.hintDependency
  components.push({
    name: 'hintDependency',
    value: hintDependency,
    weight: HINT_DEPENDENCY_WEIGHT,
  })

  const raw = clamp01(positive - (hintDependency ?? 0) * HINT_DEPENDENCY_WEIGHT) * confidence

  return {
    score: Math.round(raw * 100),
    band: bandFor(Math.round(raw * 100)),
    lowData: counters.attempts < CONFIDENCE_ATTEMPTS,
    confidence,
    components,
  }
}

type Measured = Record<ComponentName | 'hintDependency', number | null>

function measureComponents(counters: MasteryCounters): Measured {
  return {
    // First attempt, not eventual success. Counting every attempt rewards
    // brute-force retrying, which is the habit this whole model exists to avoid
    // encouraging.
    accuracy: ratio(counters.firstAttemptSolved, counters.attempts),

    // The only component that measures durability rather than achievement.
    retention: ratio(counters.revisionSuccesses, counters.revisionAttempts),

    difficultyPerformance: weightedSolveRate(counters),

    // Twenty two-pointer problems is depth in one pattern, not mastery of the
    // topic that contains it.
    patternCoverage: ratio(counters.patternsSolved, counters.patternsAvailable),

    speed: ratio(counters.speedRatioSum, counters.speedSamples),

    // Against *solves*, not attempts: the question is how much of what you got
    // right, you were walked to.
    hintDependency: ratio(counters.hintWeightedSolves, counters.solved),
  }
}

/**
 * Credit for what you solved, measured against the hardest thing you could have.
 *
 * The obvious version — weight both sides and divide — is wrong, and quietly
 * so. `Σ(solved × w) / Σ(attempted × w)` cancels the weight whenever the mix is
 * uniform: six of eight easy and six of eight hard both come out at 0.75, and
 * the component that exists to separate them separates nothing.
 *
 * So the denominator is the hardest weight rather than the attempted one. A
 * perfect run of hard problems reaches 1; a perfect run of easy ones reaches
 * 0.4 and cannot go higher, which is the "ten easy solves are not four hard
 * ones" rule stated as arithmetic. Difficulty is a ceiling on this component,
 * not a scale factor that divides itself out.
 */
function weightedSolveRate(counters: MasteryCounters): number | null {
  const credit =
    counters.easySolved * DIFFICULTY_WEIGHTS.EASY +
    counters.mediumSolved * DIFFICULTY_WEIGHTS.MEDIUM +
    counters.hardSolved * DIFFICULTY_WEIGHTS.HARD

  const attempted = counters.easyAttempts + counters.mediumAttempts + counters.hardAttempts

  return ratio(credit, attempted * DIFFICULTY_WEIGHTS.HARD)
}

/** Null rather than zero when the denominator is empty — and never a division by it. */
function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) {
    return null
  }
  return clamp01(numerator / denominator)
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0
  }
  return Math.min(1, Math.max(0, value))
}

/**
 * How the time taken compares with what the problem was expected to take.
 *
 * Clamped per problem before it is ever averaged, so a tab left open overnight
 * costs exactly one bad sample instead of poisoning the mean. A self-reported
 * zero means the client did not measure it — not that it was instant — so it
 * contributes the neutral 1 rather than a free maximum.
 *
 * Lives here, beside the formula, because both the incremental write path and
 * the nightly job that checks it have to derive this the same way. Two copies
 * that "must match" is the exact failure the reconciliation job exists to
 * catch — and it would be reporting its own arithmetic.
 */
export function speedRatio(timeSpentMs: number, estimatedMinutes: number): number {
  if (timeSpentMs <= 0 || estimatedMinutes <= 0) {
    return 1
  }
  return clamp01(estimatedMinutes / (timeSpentMs / 60_000))
}

/** Level 1 is a nudge, level 4 is most of the answer. They are not the same. */
export function hintWeight(hintsUsed: number): number {
  const index = Math.min(Math.max(hintsUsed, 0), HINT_LEVEL_WEIGHTS.length - 1)
  return HINT_LEVEL_WEIGHTS[index] ?? 1
}

export function bandFor(score: number): string {
  // Walked backwards so the highest matching threshold wins.
  return [...MASTERY_BANDS].reverse().find((band) => score >= band.min)?.label ?? 'Not started'
}
