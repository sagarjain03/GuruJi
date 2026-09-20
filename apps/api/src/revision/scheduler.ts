/**
 * The base ladder, in days.
 *
 * Longer than a flashcard system's on purpose. A card costs seconds to review;
 * re-solving a problem costs twenty minutes, so the schedule has to be worth
 * the trip.
 */
export const LADDER = [1, 3, 7, 14, 30, 60, 120] as const

export const DEFAULT_EASE = 2.5
export const MIN_EASE = 1.3
export const MAX_EASE = 3.0

/** Never below a day. A queue that shows the same item twice in one day is noise. */
export const MIN_INTERVAL_DAYS = 1

/** `MASTERED` needs this many in a row, not one lucky recall. */
export const MASTERY_STREAK = 3
export const MASTERY_INTERVAL_DAYS = 60

/** `REVIEWING` begins here — the point where this stops being fresh learning. */
export const REVIEWING_INTERVAL_DAYS = 7

export type RevisionOutcome =
  | 'SOLVED_EASILY'
  | 'SOLVED_WITH_EFFORT'
  | 'STRUGGLED'
  | 'FAILED'

export type RevisionState = 'LEARNING' | 'REVIEWING' | 'MASTERED' | 'LAPSED'

/** What the ease factor does per outcome. See docs/revision-engine.md. */
const EASE_DELTA: Record<RevisionOutcome, number> = {
  SOLVED_EASILY: 0.15,
  SOLVED_WITH_EFFORT: 0,
  STRUGGLED: -0.15,
  FAILED: -0.2,
}

export interface RevisionSchedule {
  /** Days until the next review. */
  intervalDays: number
  ease: number
  /** Position on the ladder. Advances on a success, holds on a struggle. */
  ladderIndex: number
  repetitions: number
  lapses: number
  /** Successes in a row that were not struggles. Reset by anything else. */
  streak: number
  state: RevisionState
}

/**
 * A problem solved for the first time comes back tomorrow.
 *
 * Day 1 rather than day 0: re-solving something the same hour proves only that
 * it is still in working memory, which is the one thing nobody needed to check.
 */
export function firstSchedule(): RevisionSchedule {
  return {
    intervalDays: LADDER[0],
    ease: DEFAULT_EASE,
    ladderIndex: 0,
    repetitions: 0,
    lapses: 0,
    streak: 0,
    state: 'LEARNING',
  }
}

/**
 * The next schedule, given what happened.
 *
 * Pure and total: same input, same output, and every outcome has a defined
 * result. That is what makes the whole table in the design document directly
 * assertable rather than something we hope holds in production.
 */
export function nextSchedule(
  current: RevisionSchedule,
  outcome: RevisionOutcome,
): RevisionSchedule {
  const ease = clampEase(current.ease + EASE_DELTA[outcome])

  if (outcome === 'FAILED') {
    return {
      intervalDays: MIN_INTERVAL_DAYS,
      ease,
      // Back to the bottom of the ladder. The knowledge is gone; pretending it
      // is merely stale would schedule the next look far too late.
      ladderIndex: 0,
      repetitions: current.repetitions + 1,
      lapses: current.lapses + 1,
      streak: 0,
      /*
       * `LAPSED` only if there was something to lose.
       *
       * Failing a problem that never got past `LEARNING` is not a lapse, it is
       * still learning — and marking it otherwise would give it the priority
       * boost the recommendation engine reserves for knowledge that was
       * actually had and then lost.
       */
      state: current.state === 'LEARNING' ? 'LEARNING' : 'LAPSED',
    }
  }

  if (outcome === 'STRUGGLED') {
    // Halved, and the ladder does **not** advance. The answer arrived, but the
    // reconstruction was shaky, and that is the signal worth acting on.
    const intervalDays = Math.max(MIN_INTERVAL_DAYS, Math.round(current.intervalDays * 0.5))
    return {
      intervalDays,
      ease,
      ladderIndex: current.ladderIndex,
      repetitions: current.repetitions + 1,
      lapses: current.lapses,
      streak: 0,
      state: stateFor(intervalDays, 0, current.state),
    }
  }

  /*
   * A success advances the ladder, and the ease scales it.
   *
   * The document gives both a fixed ladder and a multiplier, which only agree
   * if the ladder *is* the default-ease case — so that is how it is read here.
   * At ease 2.5 the sequence is exactly 1, 3, 7, 14, 30, 60, 120. A problem
   * someone finds trivial drifts past that; one they keep fumbling stays short.
   */
  const ladderIndex = Math.min(current.ladderIndex + 1, LADDER.length - 1)
  const base = LADDER[ladderIndex] ?? LADDER[LADDER.length - 1] ?? MIN_INTERVAL_DAYS
  const intervalDays = Math.max(MIN_INTERVAL_DAYS, Math.round(base * (ease / DEFAULT_EASE)))
  const streak = current.streak + 1

  return {
    intervalDays,
    ease,
    ladderIndex,
    repetitions: current.repetitions + 1,
    lapses: current.lapses,
    streak,
    state: stateFor(intervalDays, streak, current.state),
  }
}

/**
 * A failed *ordinary* attempt on something already scheduled.
 *
 * Treated as a struggle rather than ignored. The user has just demonstrated the
 * gap, and waiting for a date in three weeks to act on information we already
 * have is the system being pedantic at their expense.
 */
export function onUnscheduledFailure(current: RevisionSchedule): RevisionSchedule {
  return nextSchedule(current, 'STRUGGLED')
}

function stateFor(intervalDays: number, streak: number, previous: RevisionState): RevisionState {
  // Consecutive successes at long intervals, not one. A single lucky recall
  // does not retire a problem from the queue.
  if (intervalDays >= MASTERY_INTERVAL_DAYS && streak >= MASTERY_STREAK) {
    return 'MASTERED'
  }
  if (intervalDays >= REVIEWING_INTERVAL_DAYS) {
    return 'REVIEWING'
  }
  // A lapsed item stays lapsed until it climbs back out, so the recommendation
  // engine keeps prioritising it while it is still fragile.
  return previous === 'LAPSED' ? 'LAPSED' : 'LEARNING'
}

/**
 * Clamped at both ends.
 *
 * The floor matters more than the ceiling: without it a repeatedly-failed
 * problem collapses into a permanent daily item, and a queue with a permanent
 * daily item in it is a queue people stop opening.
 */
function clampEase(ease: number): number {
  return Math.min(MAX_EASE, Math.max(MIN_EASE, Number(ease.toFixed(4))))
}

/** `dueAt` from an interval. UTC, because the stored instant always is. */
export function dueAtFrom(now: Date, intervalDays: number): Date {
  const due = new Date(now)
  due.setUTCDate(due.getUTCDate() + intervalDays)
  return due
}
