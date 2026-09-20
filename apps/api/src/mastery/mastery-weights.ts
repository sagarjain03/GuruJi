/**
 * Every tunable number in the mastery model, in one object.
 *
 * Scattered constants get tuned one at a time by whoever is looking at one
 * symptom, and the model drifts without anybody deciding that it should. Here a
 * change to how mastery is judged is a change to this file, visible in a diff.
 *
 * The source of truth for the values is docs/mastery-model.md. If they disagree,
 * the document is wrong and should be corrected — not the other way round.
 */

/** The positive components. These sum to exactly 1. */
export const COMPONENT_WEIGHTS = {
  accuracy: 0.3,
  retention: 0.2,
  difficultyPerformance: 0.2,
  patternCoverage: 0.15,
  speed: 0.15,
} as const

export type ComponentName = keyof typeof COMPONENT_WEIGHTS

/**
 * Subtracted, not merely excluded.
 *
 * Leaving hinted solves out of `accuracy` would treat heavy hint use as absence
 * of evidence. It is evidence — of a gap. Someone who solves everything at hint
 * level 4 should see a score that says so.
 */
export const HINT_DEPENDENCY_WEIGHT = 0.2

/**
 * Easy ×1.0 · Medium ×1.6 · Hard ×2.5.
 *
 * Not linear, and not exponential either. Ten easy solves must not equal four
 * hard ones, but a single hard solve must not outweigh a topic's worth of
 * honest medium work.
 */
export const DIFFICULTY_WEIGHTS = {
  EASY: 1.0,
  MEDIUM: 1.6,
  HARD: 2.5,
} as const

/**
 * `min(1, attempts / 5)` — the damping term.
 *
 * Without it one lucky solve reads as total mastery, and the recommendation
 * engine stops showing you the topic you have seen exactly once. Five is the
 * point at which a score is allowed to mean what it says.
 */
export const CONFIDENCE_ATTEMPTS = 5

/**
 * How much each hint level counts against a solve.
 *
 * Level 1 is a nudge; level 4 is most of the answer. Treating them the same
 * would make asking for a hint at all feel like an admission, which is the
 * opposite of what hints are for.
 */
export const HINT_LEVEL_WEIGHTS = [0, 0.25, 0.5, 0.75, 1.0] as const

/** The bands the UI shows, because a decimal place implies precision we do not have. */
export const MASTERY_BANDS = [
  { min: 0, label: 'Not started' },
  { min: 20, label: 'Learning' },
  { min: 40, label: 'Developing' },
  { min: 60, label: 'Proficient' },
  { min: 80, label: 'Strong' },
  { min: 95, label: 'Mastered' },
] as const

/**
 * A guard against a careless edit.
 *
 * Called by the test suite rather than at boot: a weight typo is a
 * build-time mistake, and failing a deployment for it is worse than failing a
 * test for it.
 */
export function componentWeightTotal(): number {
  return Object.values(COMPONENT_WEIGHTS).reduce((total, weight) => total + weight, 0)
}
