import { describe, expect, it } from 'vitest'
import { computeMastery, type MasteryCounters } from './mastery'
import { COMPONENT_WEIGHTS, componentWeightTotal } from './mastery-weights'

/**
 * The formula is pure, so every degenerate case is directly checkable.
 *
 * These are not coverage for its own sake. Each one is a way the model has a
 * known tendency to lie — one lucky solve reading as mastery, a hint-walked
 * solve reading like an unaided one, a division by an empty denominator — and
 * a claim that it does not.
 */

const EMPTY: MasteryCounters = {
  attempts: 0,
  solved: 0,
  firstAttemptSolved: 0,
  revisionAttempts: 0,
  revisionSuccesses: 0,
  easyAttempts: 0,
  easySolved: 0,
  mediumAttempts: 0,
  mediumSolved: 0,
  hardAttempts: 0,
  hardSolved: 0,
  patternsSolved: 0,
  patternsAvailable: 0,
  speedRatioSum: 0,
  speedSamples: 0,
  hintWeightedSolves: 0,
}

function counters(overrides: Partial<MasteryCounters>): MasteryCounters {
  return { ...EMPTY, ...overrides }
}

describe('mastery weights', () => {
  it('sums to exactly 1', () => {
    // A guard against a careless edit. The formula silently renormalises, so a
    // typo here would change every score in the product without failing
    // anything else.
    expect(componentWeightTotal()).toBeCloseTo(1, 10)
  })
})

describe('computeMastery', () => {
  it('scores zero with no data, and says so rather than implying a judgement', () => {
    const result = computeMastery(EMPTY)

    expect(result.score).toBe(0)
    expect(result.lowData).toBe(true)
    expect(result.band).toBe('Not started')
    // Nothing measurable, so nothing is claimed about any component.
    expect(result.components.every((component) => component.value === null)).toBe(true)
  })

  it('does not let one perfect solve read as mastery', () => {
    const result = computeMastery(
      counters({
        attempts: 1,
        solved: 1,
        firstAttemptSolved: 1,
        easyAttempts: 1,
        easySolved: 1,
        patternsSolved: 1,
        patternsAvailable: 8,
        speedRatioSum: 1,
        speedSamples: 1,
      }),
    )

    // Confidence damping. Without it the recommendation engine stops showing a
    // topic the user has seen exactly once.
    expect(result.confidence).toBeCloseTo(0.2, 10)
    expect(result.score).toBeLessThan(30)
    expect(result.lowData).toBe(true)
  })

  it('scores zero for all failures, with no division by zero anywhere', () => {
    const result = computeMastery(
      counters({
        attempts: 10,
        solved: 0,
        firstAttemptSolved: 0,
        easyAttempts: 4,
        mediumAttempts: 4,
        hardAttempts: 2,
        patternsAvailable: 6,
      }),
    )

    expect(result.score).toBe(0)
    expect(Number.isNaN(result.score)).toBe(false)
    // Solved is the denominator for hint dependency. Nothing solved means
    // nothing to be dependent on — not a NaN, and not a penalty.
    expect(result.components.find((c) => c.name === 'hintDependency')?.value).toBeNull()
  })

  it('scores hint-walked solves materially below unaided ones', () => {
    // Hard problems throughout, so `difficultyPerformance` is at its ceiling
    // and the only thing separating the two runs is the hints.
    const base = {
      attempts: 10,
      solved: 10,
      firstAttemptSolved: 10,
      hardAttempts: 10,
      hardSolved: 10,
      patternsSolved: 4,
      patternsAvailable: 4,
      speedRatioSum: 10,
      speedSamples: 10,
    }

    const unaided = computeMastery(counters({ ...base, hintWeightedSolves: 0 }))
    // Every solve reached the deepest hint level.
    const walked = computeMastery(counters({ ...base, hintWeightedSolves: 10 }))

    expect(unaided.score).toBe(100)
    // Being walked to an answer is evidence of a gap, not absence of evidence.
    expect(walked.score).toBe(80)
    expect(unaided.score - walked.score).toBeGreaterThanOrEqual(15)
  })

  it('scores hard solves above the same number of easy ones', () => {
    const shape = {
      attempts: 8,
      solved: 6,
      firstAttemptSolved: 6,
      patternsSolved: 3,
      patternsAvailable: 4,
      speedRatioSum: 6,
      speedSamples: 6,
    }

    const easy = computeMastery(counters({ ...shape, easyAttempts: 8, easySolved: 6 }))
    const hard = computeMastery(counters({ ...shape, hardAttempts: 8, hardSolved: 6 }))

    expect(hard.score).toBeGreaterThan(easy.score)
  })

  it('caps a single pattern solved over and over', () => {
    const shape = {
      attempts: 20,
      solved: 20,
      firstAttemptSolved: 20,
      hardAttempts: 20,
      hardSolved: 20,
      speedRatioSum: 20,
      speedSamples: 20,
      patternsAvailable: 8,
    }

    // Twenty problems, one technique.
    const narrow = computeMastery(counters({ ...shape, patternsSolved: 1 }))
    const broad = computeMastery(counters({ ...shape, patternsSolved: 8 }))

    expect(broad.score).toBe(100)
    expect(narrow.score).toBeLessThan(broad.score)

    /*
     * Coverage is the only thing that differs, so the gap is exactly its
     * weight — renormalised, because there is no revision history here and
     * retention hands its share to the components that can be measured.
     */
    const measuredTotal =
      COMPONENT_WEIGHTS.accuracy +
      COMPONENT_WEIGHTS.difficultyPerformance +
      COMPONENT_WEIGHTS.patternCoverage +
      COMPONENT_WEIGHTS.speed
    const expectedGap = (7 / 8) * (COMPONENT_WEIGHTS.patternCoverage / measuredTotal) * 100
    expect(broad.score - narrow.score).toBeCloseTo(expectedGap, 0)
  })

  it('falls when revisions are failed — retention is the durability signal', () => {
    const shape = {
      attempts: 10,
      solved: 10,
      firstAttemptSolved: 10,
      hardAttempts: 10,
      hardSolved: 10,
      patternsSolved: 4,
      patternsAvailable: 4,
      speedRatioSum: 10,
      speedSamples: 10,
      revisionAttempts: 6,
    }

    const remembered = computeMastery(counters({ ...shape, revisionSuccesses: 6 }))
    const forgotten = computeMastery(counters({ ...shape, revisionSuccesses: 0 }))

    expect(remembered.score).toBe(100)
    // Solving once is not knowing.
    expect(forgotten.score).toBeLessThan(remembered.score)
  })

  it('reaches exactly 100 with every component at maximum', () => {
    const result = computeMastery(
      counters({
        attempts: 20,
        solved: 20,
        firstAttemptSolved: 20,
        revisionAttempts: 10,
        revisionSuccesses: 10,
        hardAttempts: 20,
        hardSolved: 20,
        patternsSolved: 6,
        patternsAvailable: 6,
        speedRatioSum: 20,
        speedSamples: 20,
        hintWeightedSolves: 0,
      }),
    )

    expect(result.score).toBe(100)
    expect(result.band).toBe('Mastered')
    expect(result.lowData).toBe(false)
  })

  it('redistributes the weight of components it cannot measure', () => {
    /*
     * Retention does not exist until Phase 6, and a pattern row has no coverage
     * to speak of. Scoring those zero would cap everyone in the product at a
     * number they had no way to earn — "nobody has asked you yet" is not the
     * same claim as "you failed".
     */
    const result = computeMastery(
      counters({
        attempts: 10,
        solved: 10,
        firstAttemptSolved: 10,
        hardAttempts: 10,
        hardSolved: 10,
        speedRatioSum: 10,
        speedSamples: 10,
        // No revision history, no pattern data.
      }),
    )

    expect(result.score).toBe(100)

    const retention = result.components.find((c) => c.name === 'retention')
    expect(retention?.value).toBeNull()
    expect(retention?.weight).toBe(0)

    // The three that could be measured now carry the whole positive weight.
    const applied = result.components
      .filter((c) => c.name !== 'hintDependency')
      .reduce((total, c) => total + c.weight, 0)
    expect(applied).toBeCloseTo(1, 10)
  })

  it('puts a score in the band the interface will show', () => {
    const result = computeMastery(
      counters({
        attempts: 10,
        solved: 6,
        firstAttemptSolved: 5,
        mediumAttempts: 10,
        mediumSolved: 6,
        patternsSolved: 3,
        patternsAvailable: 5,
        speedRatioSum: 6,
        speedSamples: 6,
      }),
    )

    expect(result.score).toBeGreaterThan(0)
    expect(result.score).toBeLessThan(100)
    expect(result.band).not.toBe('Not started')
    // Every component the user could ask about has an answer.
    expect(result.components).toHaveLength(Object.keys(COMPONENT_WEIGHTS).length + 1)
  })
})
