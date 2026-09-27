import { AppError } from '../common/app-error'
import { bucketDays, bucketWeeks, median, rangeBounds, resolveRange, weekStart } from './analytics-math'

const NOW = new Date('2026-09-27T10:00:00Z')
const BOUNDS = { defaultDays: 365, maxDays: 366 }

describe('resolveRange', () => {
  it('defaults to the last N days ending today, inclusive', () => {
    expect(resolveRange({}, NOW, BOUNDS)).toEqual({ from: '2025-09-28', to: '2026-09-27' })
  })

  it('counts back from a given `to` when only `to` is given', () => {
    expect(resolveRange({ to: '2026-01-31' }, NOW, { defaultDays: 7, maxDays: 30 })).toEqual({
      from: '2026-01-25',
      to: '2026-01-31',
    })
  })

  it('clamps a future `to` to today rather than failing', () => {
    // A client a few hours ahead of UTC legitimately thinks it is already tomorrow.
    expect(resolveRange({ from: '2026-09-20', to: '2026-09-28' }, NOW, BOUNDS)).toEqual({
      from: '2026-09-20',
      to: '2026-09-27',
    })
  })

  it('refuses a backwards range', () => {
    expect(() => resolveRange({ from: '2026-09-10', to: '2026-09-01' }, NOW, BOUNDS)).toThrow(AppError)
  })

  it('refuses a span over the cap, naming the cap', () => {
    expect(() => resolveRange({ from: '2020-01-01', to: '2026-09-27' }, NOW, BOUNDS)).toThrow(
      'at most 366 days',
    )
  })

  it('accepts a span exactly at the cap', () => {
    expect(resolveRange({ from: '2025-09-27', to: '2026-09-27' }, NOW, BOUNDS)).toEqual({
      from: '2025-09-27',
      to: '2026-09-27',
    })
  })
})

describe('rangeBounds', () => {
  it('turns an inclusive date range into a half-open instant range', () => {
    expect(rangeBounds({ from: '2026-09-01', to: '2026-09-02' })).toEqual({
      gte: new Date('2026-09-01T00:00:00.000Z'),
      lt: new Date('2026-09-03T00:00:00.000Z'),
    })
  })
})

describe('weekStart', () => {
  it('maps every day to the Monday of its UTC week', () => {
    expect(weekStart('2026-09-21')).toBe('2026-09-21') // Monday
    expect(weekStart('2026-09-27')).toBe('2026-09-21') // Sunday
    expect(weekStart(new Date('2026-09-22T23:59:59Z'))).toBe('2026-09-21')
  })
})

describe('median', () => {
  it('is null for nothing, the middle for odd counts, the midpoint for even', () => {
    expect(median([])).toBeNull()
    expect(median([5, 1, 3])).toBe(3)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })
})

describe('bucketDays', () => {
  it('counts distinct problems per UTC day, solved only when accepted', () => {
    const rows = [
      { createdAt: new Date('2026-09-01T01:00:00Z'), verdict: 'WRONG_ANSWER', problemId: 'a' },
      { createdAt: new Date('2026-09-01T02:00:00Z'), verdict: 'ACCEPTED', problemId: 'a' },
      { createdAt: new Date('2026-09-01T23:59:00Z'), verdict: 'WRONG_ANSWER', problemId: 'b' },
      { createdAt: new Date('2026-09-03T00:00:00Z'), verdict: 'ACCEPTED', problemId: 'b' },
    ]

    expect(bucketDays(rows)).toEqual([
      { date: '2026-09-01', attempted: 2, solved: 1 },
      { date: '2026-09-03', attempted: 1, solved: 1 },
    ])
  })
})

describe('bucketWeeks', () => {
  it('emits every week in the range, empty ones included, with accuracy and median time', () => {
    const rows = [
      { createdAt: new Date('2026-09-01T10:00:00Z'), verdict: 'WRONG_ANSWER', timeSpentMs: 90_000 },
      { createdAt: new Date('2026-09-02T10:00:00Z'), verdict: 'ACCEPTED', timeSpentMs: 60_000 },
      { createdAt: new Date('2026-09-03T10:00:00Z'), verdict: 'ACCEPTED', timeSpentMs: 20_000 },
      { createdAt: new Date('2026-09-04T10:00:00Z'), verdict: 'ACCEPTED', timeSpentMs: 3_600_000 },
      { createdAt: new Date('2026-09-15T10:00:00Z'), verdict: 'TIME_LIMIT_EXCEEDED', timeSpentMs: 5_000 },
    ]

    expect(bucketWeeks(rows, { from: '2026-09-01', to: '2026-09-15' })).toEqual([
      // Median, so the hour-long outlier does not drag the week to 20 minutes.
      { weekStart: '2026-08-31', submissions: 4, accepted: 3, accuracy: 0.75, medianSolveTimeMs: 60_000 },
      { weekStart: '2026-09-07', submissions: 0, accepted: 0, accuracy: null, medianSolveTimeMs: null },
      { weekStart: '2026-09-14', submissions: 1, accepted: 0, accuracy: 0, medianSolveTimeMs: null },
    ])
  })
})
