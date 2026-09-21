/**
 * Every weight in the recommendation engine, in one object.
 *
 * The source of truth is docs/recommendation-engine.md. If they disagree, the
 * document is wrong and gets corrected — not the other way round.
 */
export const SCORING_WEIGHTS = {
  revisionUrgency: 0.3,
  weaknessSignal: 0.25,
  difficultyFit: 0.15,
  patternGap: 0.1,
  prerequisiteReadiness: 0.1,
} as const

/** Subtracted, not added. Recently seen is a reason to wait, not to repeat. */
export const RECENCY_PENALTY_WEIGHT = 0.1

/**
 * A lapsed item saturates urgency outright.
 *
 * Knowledge had and lost is the cheapest to recover, and the design document
 * states plainly that a failed revision beats new material. That is a product
 * rule, not a tuning preference — so the boost has to be large enough that no
 * other signal can outvote it, rather than merely large enough today.
 *
 * At `0.35` it was not. A two-day-lapsed item scored 0.398 against 0.400 for
 * fresh work in a weak topic, and the stated ordering held or failed depending
 * on how overdue the item happened to be. Saturating makes the guarantee
 * structural: `0.30 × 1` exceeds the `0.25` that weakness can contribute at its
 * absolute maximum.
 */
export const LAPSED_BOOST = 1

/** Past this, "overdue" stops telling us anything new. */
export const OVERDUE_SATURATION_DAYS = 14

/** Where `difficultyFit` peaks: just above what the user can already do. */
export const STRETCH = 0.15

export type RecommendationKind =
  | 'REVISION'
  | 'WEAK_TOPIC'
  | 'NEW_PATTERN'
  | 'NEW_PROBLEM'
  | 'MOCK_CHALLENGE'

export interface Candidate {
  problemId: string
  slug: string
  title: string
  /** 0 easy, 0.5 medium, 1 hard — the scale `difficultyTolerance` is on. */
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  topicIds: string[]
  patternIds: string[]
  kind: RecommendationKind
  /** Present only for problems already on the revision schedule. */
  revision?: { overdueDays: number; state: string } | undefined
  solved: boolean
  /** Null when never attempted. */
  lastAttemptedDaysAgo?: number | undefined
  /** Null when never put in front of the user. */
  lastRecommendedDaysAgo?: number | undefined
  dismissals: number
}

export interface UserContext {
  /** The user's own average across practised topics, 0..100. */
  averageMastery: number
  topicMastery: Map<string, number>
  patternAttempts: Map<string, number>
  /** 0..1. Rises as the user handles harder problems. */
  difficultyTolerance: number
  /**
   * Topics whose prerequisites this user has not met.
   *
   * A set rather than a score: this is a gate, and a gate that can be
   * outweighed by a strong signal elsewhere is not a gate.
   */
  blockedTopicIds: Set<string>
  /** Problems shown in the last three batches. */
  recentlyRecommended: Set<string>
  /** True before there is any history to reason from. */
  coldStart: boolean
}

export interface ScoreBreakdown {
  revisionUrgency: number
  weaknessSignal: number
  difficultyFit: number
  patternGap: number
  prerequisiteReadiness: number
  recencyPenalty: number
}

export interface ScoredCandidate {
  candidate: Candidate
  score: number
  breakdown: ScoreBreakdown
}

const DIFFICULTY_LEVEL: Record<Candidate['difficulty'], number> = {
  EASY: 0,
  MEDIUM: 0.5,
  HARD: 1,
}

/**
 * The weighted formula from the design document.
 *
 * Pure: same candidate and context in, same score out. That is what makes every
 * behaviour in the spec — weak topics outranking strong ones, prerequisites
 * gating hard, difficulty adapting upward — a direct assertion rather than
 * something observed in production and hoped for.
 */
export function scoreCandidate(candidate: Candidate, context: UserContext): ScoredCandidate {
  const breakdown: ScoreBreakdown = {
    revisionUrgency: revisionUrgency(candidate),
    weaknessSignal: weaknessSignal(candidate, context),
    difficultyFit: difficultyFit(candidate, context),
    patternGap: patternGap(candidate, context),
    prerequisiteReadiness: prerequisiteReadiness(candidate, context),
    recencyPenalty: recencyPenalty(candidate, context),
  }

  /*
   * The gate, applied as a gate.
   *
   * An unmet prerequisite scores **zero**, not merely low. Recommending graph
   * traversal to someone who has not met trees is not a slightly worse
   * suggestion, it is a wrong one — and a soft weight lets a strong signal
   * elsewhere outvote it.
   */
  if (breakdown.prerequisiteReadiness === 0) {
    return { candidate, score: 0, breakdown }
  }

  const positive =
    SCORING_WEIGHTS.revisionUrgency * breakdown.revisionUrgency +
    SCORING_WEIGHTS.weaknessSignal * breakdown.weaknessSignal +
    SCORING_WEIGHTS.difficultyFit * breakdown.difficultyFit +
    SCORING_WEIGHTS.patternGap * breakdown.patternGap +
    SCORING_WEIGHTS.prerequisiteReadiness * breakdown.prerequisiteReadiness

  return {
    candidate,
    score: clamp01(positive - RECENCY_PENALTY_WEIGHT * breakdown.recencyPenalty),
    breakdown,
  }
}

/** Days overdue, saturating — plus a fixed jump for anything lapsed. */
function revisionUrgency(candidate: Candidate): number {
  if (candidate.revision === undefined) {
    return 0
  }

  const overdue = clamp01(
    Math.max(0, candidate.revision.overdueDays) / OVERDUE_SATURATION_DAYS,
  )
  const lapsed = candidate.revision.state === 'LAPSED' ? LAPSED_BOOST : 0

  return clamp01(overdue + lapsed)
}

/**
 * How far below the user's *own* average this sits.
 *
 * Relative, never absolute. A strong user whose weakest topic is at 70 still
 * has a weakest topic and still deserves targeted practice; an absolute bar
 * would tell them everything is fine and quietly stop training them.
 */
function weaknessSignal(candidate: Candidate, context: UserContext): number {
  if (candidate.topicIds.length === 0) {
    return 0
  }

  const scores = candidate.topicIds
    .map((topicId) => context.topicMastery.get(topicId))
    .filter((score): score is number => score !== undefined)

  // No score yet is not weakness. Treating unknown as zero would make every
  // untouched topic look like the most urgent thing in the product.
  if (scores.length === 0) {
    return 0
  }

  const weakest = Math.min(...scores)
  // Normalised by the average itself, so "20 below 40" counts for more than
  // "20 below 90" — which is how it actually feels.
  const gap = context.averageMastery - weakest
  return clamp01(gap / Math.max(context.averageMastery, 1))
}

/**
 * Peaks just above what the user can already do.
 *
 * Recommending only what they can already do produces no growth; recommending
 * far above it produces frustration and hint-dependence. The edge of competence
 * is also where the mastery signal is most informative.
 */
function difficultyFit(candidate: Candidate, context: UserContext): number {
  const target = clamp01(context.difficultyTolerance + STRETCH)
  const distance = Math.abs(DIFFICULTY_LEVEL[candidate.difficulty] - target)
  return clamp01(1 - distance)
}

/** Higher for techniques barely touched — but only once the topic is reachable. */
function patternGap(candidate: Candidate, context: UserContext): number {
  if (candidate.patternIds.length === 0) {
    return 0
  }

  const attempts = candidate.patternIds.map(
    (patternId) => context.patternAttempts.get(patternId) ?? 0,
  )
  const leastPractised = Math.min(...attempts)

  // Five attempts is where a pattern stops being new. Past that this signal has
  // nothing left to say and the others should decide.
  return clamp01(1 - leastPractised / 5)
}

function prerequisiteReadiness(candidate: Candidate, context: UserContext): number {
  return candidate.topicIds.some((topicId) => context.blockedTopicIds.has(topicId)) ? 0 : 1
}

/**
 * Recently seen, recently attempted, or repeatedly dismissed.
 *
 * A due revision is exempt from the "seen it lately" part: being shown a
 * problem *because it is due* is the entire point, and penalising that would
 * make the engine argue with the revision schedule.
 */
function recencyPenalty(candidate: Candidate, context: UserContext): number {
  if (candidate.revision !== undefined) {
    return clamp01(candidate.dismissals * 0.25)
  }

  let penalty = 0

  if (context.recentlyRecommended.has(candidate.problemId)) {
    penalty += 0.6
  }

  if (candidate.lastAttemptedDaysAgo !== undefined) {
    // Fades over a fortnight. Something attempted yesterday is a poor
    // suggestion; something attempted a month ago is not.
    penalty += clamp01(1 - candidate.lastAttemptedDaysAgo / 14) * 0.6
  }

  if (candidate.solved) {
    penalty += 0.4
  }

  penalty += clamp01(candidate.dismissals * 0.25)

  return clamp01(penalty)
}

function clamp01(value: number): number {
  return Number.isNaN(value) ? 0 : Math.min(1, Math.max(0, value))
}
