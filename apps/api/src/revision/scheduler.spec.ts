import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EASE,
  LADDER,
  MASTERY_STREAK,
  MAX_EASE,
  MIN_EASE,
  firstSchedule,
  nextSchedule,
  onUnscheduledFailure,
  type RevisionOutcome,
  type RevisionSchedule,
} from './scheduler'

/** Applies a run of outcomes, so a multi-step claim reads as one. */
function after(outcomes: RevisionOutcome[], from = firstSchedule()): RevisionSchedule {
  return outcomes.reduce((schedule, outcome) => nextSchedule(schedule, outcome), from)
}

describe('revision scheduler', () => {
  it('brings a first solve back tomorrow', () => {
    const schedule = firstSchedule()

    // Day 1, not day 0. Re-solving within the hour proves only that it is still
    // in working memory, which nobody needed checked.
    expect(schedule.intervalDays).toBe(1)
    expect(schedule.ease).toBe(DEFAULT_EASE)
    expect(schedule.state).toBe('LEARNING')
  })

  it('walks the documented ladder exactly, at the default ease', () => {
    let schedule = firstSchedule()
    const seen = [schedule.intervalDays]

    for (let step = 1; step < LADDER.length; step += 1) {
      schedule = nextSchedule(schedule, 'SOLVED_WITH_EFFORT')
      seen.push(schedule.intervalDays)
    }

    // The document gives both a ladder and a multiplier. They only agree if the
    // ladder is the default-ease case — this is that claim, asserted.
    expect(seen).toEqual([...LADDER])
  })

  it('stretches intervals for a problem the user finds easy', () => {
    const steady = after(['SOLVED_WITH_EFFORT', 'SOLVED_WITH_EFFORT', 'SOLVED_WITH_EFFORT'])
    const easy = after(['SOLVED_EASILY', 'SOLVED_EASILY', 'SOLVED_EASILY'])

    expect(easy.ease).toBeGreaterThan(steady.ease)
    expect(easy.intervalDays).toBeGreaterThan(steady.intervalDays)
  })

  it('halves on a struggle without advancing the ladder', () => {
    const before = after(['SOLVED_WITH_EFFORT', 'SOLVED_WITH_EFFORT', 'SOLVED_WITH_EFFORT'])
    const after_ = nextSchedule(before, 'STRUGGLED')

    expect(after_.intervalDays).toBe(Math.round(before.intervalDays * 0.5))
    // The answer arrived, but the reconstruction was shaky. Advancing would
    // reward getting there rather than knowing it.
    expect(after_.ladderIndex).toBe(before.ladderIndex)
    expect(after_.ease).toBeLessThan(before.ease)
  })

  it('never lets a struggle drop below a day', () => {
    const schedule = after(['STRUGGLED', 'STRUGGLED', 'STRUGGLED', 'STRUGGLED'])

    // A queue that shows the same item twice in one day is noise, not practice.
    expect(schedule.intervalDays).toBe(1)
  })

  it('resets on a failure, counts the lapse, and marks it lapsed', () => {
    const reviewing = after([
      'SOLVED_WITH_EFFORT',
      'SOLVED_WITH_EFFORT',
      'SOLVED_WITH_EFFORT',
    ])
    expect(reviewing.state).toBe('REVIEWING')

    const failed = nextSchedule(reviewing, 'FAILED')

    expect(failed.intervalDays).toBe(1)
    expect(failed.ladderIndex).toBe(0)
    expect(failed.lapses).toBe(1)
    expect(failed.state).toBe('LAPSED')
  })

  it('does not call a first-time failure a lapse', () => {
    const failed = nextSchedule(firstSchedule(), 'FAILED')

    /*
     * Nothing was lost, so nothing lapsed. It matters because the
     * recommendation engine gives `LAPSED` the highest priority it has —
     * knowledge you had and lost is the cheapest thing to recover — and
     * spending that on a problem still being learned wastes it.
     */
    expect(failed.state).toBe('LEARNING')
    expect(failed.lapses).toBe(1)
  })

  it('clamps ease at both ends', () => {
    const floored = after(Array.from({ length: 20 }, () => 'FAILED' as const))
    const ceiling = after(Array.from({ length: 20 }, () => 'SOLVED_EASILY' as const))

    // The floor is the one that matters: without it a repeatedly-failed problem
    // becomes a permanent daily item, and people abandon the whole system.
    expect(floored.ease).toBe(MIN_EASE)
    expect(ceiling.ease).toBe(MAX_EASE)
  })

  it('requires consecutive successes to master, not one', () => {
    // Far enough up the ladder that the interval alone would qualify.
    let schedule = after(Array.from({ length: 5 }, () => 'SOLVED_WITH_EFFORT' as const))
    expect(schedule.intervalDays).toBeGreaterThanOrEqual(60)
    expect(schedule.streak).toBeGreaterThanOrEqual(MASTERY_STREAK)
    expect(schedule.state).toBe('MASTERED')

    // One struggle takes it back. A single lucky recall must not retire a
    // problem from the queue, and neither must a shaky one keep it retired.
    schedule = nextSchedule(schedule, 'STRUGGLED')
    expect(schedule.state).not.toBe('MASTERED')
    expect(schedule.streak).toBe(0)
  })

  it('does not master on a long interval reached without a streak', () => {
    let schedule = after(Array.from({ length: 5 }, () => 'SOLVED_WITH_EFFORT' as const))
    schedule = nextSchedule(schedule, 'STRUGGLED')
    schedule = nextSchedule(schedule, 'SOLVED_WITH_EFFORT')

    // Back at a long interval, but only one success deep.
    expect(schedule.streak).toBe(1)
    expect(schedule.state).not.toBe('MASTERED')
  })

  it('keeps a lapsed item lapsed until it climbs back out', () => {
    const lapsed = nextSchedule(
      after(['SOLVED_WITH_EFFORT', 'SOLVED_WITH_EFFORT', 'SOLVED_WITH_EFFORT']),
      'FAILED',
    )
    expect(lapsed.state).toBe('LAPSED')

    /*
     * Climbing back out is slower than the climb up was, and that is the point.
     *
     * Failing cost ease, and every interval afterwards is scaled by it — so the
     * same three successes that first reached `REVIEWING` land short of the
     * seven-day threshold the second time. The item stays prioritised for an
     * extra round, which is exactly what "you had this and lost it" deserves.
     */
    let schedule = lapsed
    for (let step = 0; step < 2; step += 1) {
      schedule = nextSchedule(schedule, 'SOLVED_WITH_EFFORT')
      expect(schedule.state).toBe('LAPSED')
    }
    expect(schedule.intervalDays).toBeLessThan(7)

    const recovered = nextSchedule(schedule, 'SOLVED_WITH_EFFORT')
    expect(recovered.state).toBe('REVIEWING')
  })

  it('shortens the interval when an ordinary attempt fails', () => {
    const scheduled = after(['SOLVED_WITH_EFFORT', 'SOLVED_WITH_EFFORT', 'SOLVED_WITH_EFFORT'])
    const shortened = onUnscheduledFailure(scheduled)

    // The gap has just been demonstrated. Waiting for a date three weeks out to
    // act on information already in hand is the system being pedantic.
    expect(shortened.intervalDays).toBeLessThan(scheduled.intervalDays)
    expect(shortened.lapses).toBe(scheduled.lapses)
  })
})
