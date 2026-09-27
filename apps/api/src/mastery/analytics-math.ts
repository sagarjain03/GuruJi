import type { ActivityDay, AnalyticsRangeQuery, ResolvedRange, TrendWeek } from '@guruji/types'
import { AppError } from '../common/app-error'

/**
 * The pure half of analytics: ranges, buckets and medians. Everything here is
 * UTC. Bucketing happens on the server so the streak and the charts agree with
 * each other on every device, whatever its time zone.
 */

const DAY_MS = 24 * 60 * 60 * 1000

export interface RangeBounds {
  /** How many days to cover when `from` is omitted. */
  defaultDays: number
  /** The widest span accepted, inclusive of both ends. */
  maxDays: number
}

function toDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`)
}

function toDay(instant: Date): string {
  return instant.toISOString().slice(0, 10)
}

function addDays(day: string, days: number): string {
  return toDay(new Date(toDate(day).getTime() + days * DAY_MS))
}

/**
 * Fills in and bounds a requested range.
 *
 * A future `to` is clamped to today rather than refused: a client a few hours
 * ahead of UTC legitimately believes it is already tomorrow. A backwards or
 * oversized range is refused, because silently shrinking it would chart
 * something other than what was asked for.
 */
export function resolveRange(query: AnalyticsRangeQuery, now: Date, bounds: RangeBounds): ResolvedRange {
  const today = toDay(now)
  const to = query.to === undefined || query.to > today ? today : query.to
  const from = query.from ?? addDays(to, -(bounds.defaultDays - 1))

  if (from > to) {
    throw new AppError('INVALID_RANGE', '`from` must not be after `to`.')
  }
  const span = Math.round((toDate(to).getTime() - toDate(from).getTime()) / DAY_MS) + 1
  if (span > bounds.maxDays) {
    throw new AppError('INVALID_RANGE', `A range can cover at most ${bounds.maxDays} days.`)
  }
  return { from, to }
}

/** An inclusive day range as the half-open instant range a query needs. */
export function rangeBounds(range: ResolvedRange): { gte: Date; lt: Date } {
  return { gte: toDate(range.from), lt: toDate(addDays(range.to, 1)) }
}

/** The Monday that starts the UTC week containing `day`. */
export function weekStart(day: string | Date): string {
  const date = typeof day === 'string' ? toDate(day) : toDate(toDay(day))
  const sinceMonday = (date.getUTCDay() + 6) % 7
  return toDay(new Date(date.getTime() - sinceMonday * DAY_MS))
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const upper = sorted[middle] ?? 0
  return sorted.length % 2 === 1 ? upper : ((sorted[middle - 1] ?? 0) + upper) / 2
}

/** Distinct problems attempted and solved per UTC day, oldest first. */
export function bucketDays(
  rows: { createdAt: Date; verdict: string | null; problemId: string }[],
): ActivityDay[] {
  const byDay = new Map<string, { attempted: Set<string>; solved: Set<string> }>()
  for (const row of rows) {
    const date = toDay(row.createdAt)
    const bucket = byDay.get(date) ?? { attempted: new Set<string>(), solved: new Set<string>() }
    bucket.attempted.add(row.problemId)
    if (row.verdict === 'ACCEPTED') bucket.solved.add(row.problemId)
    byDay.set(date, bucket)
  }

  return [...byDay.entries()]
    .map(([date, bucket]) => ({ date, attempted: bucket.attempted.size, solved: bucket.solved.size }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Every UTC week touching the range, oldest first, empty weeks included. */
export function bucketWeeks(
  rows: { createdAt: Date; verdict: string | null; timeSpentMs: number }[],
  range: ResolvedRange,
): TrendWeek[] {
  const weeks = new Map<string, { submissions: number; accepted: number; times: number[] }>()
  const last = weekStart(range.to)
  for (let cursor = weekStart(range.from); cursor <= last; cursor = addDays(cursor, 7)) {
    weeks.set(cursor, { submissions: 0, accepted: 0, times: [] })
  }

  for (const row of rows) {
    const week = weeks.get(weekStart(row.createdAt))
    if (week === undefined) continue
    week.submissions += 1
    if (row.verdict === 'ACCEPTED') {
      week.accepted += 1
      week.times.push(row.timeSpentMs)
    }
  }

  return [...weeks.entries()].map(([start, week]) => {
    const time = median(week.times)
    return {
      weekStart: start,
      submissions: week.submissions,
      accepted: week.accepted,
      accuracy: week.submissions === 0 ? null : week.accepted / week.submissions,
      medianSolveTimeMs: time === null ? null : Math.round(time),
    }
  })
}

/**
 * Share of attempted problems solved on their first graded submission — the
 * honest accuracy the mastery model also uses. Ten wrong answers and then a
 * right one is not 100%. Null with nothing attempted: never tried is not 0%.
 */
export function firstTryAccuracy(rows: { problemId: string; verdict: string | null; createdAt: Date }[]): number | null {
  const first = new Map<string, { verdict: string | null; at: number }>()
  for (const row of rows) {
    const seen = first.get(row.problemId)
    if (seen === undefined || row.createdAt.getTime() < seen.at) {
      first.set(row.problemId, { verdict: row.verdict, at: row.createdAt.getTime() })
    }
  }
  if (first.size === 0) return null
  const solvedFirstTime = [...first.values()].filter((entry) => entry.verdict === 'ACCEPTED').length
  return solvedFirstTime / first.size
}

/**
 * Hints taken, across problems. `hintsUsedAtSubmit` is cumulative per problem,
 * so each problem contributes its highest count, not the sum of its submissions.
 */
export function hintsUsed(rows: { problemId: string; hintsUsedAtSubmit: number }[]): number {
  const highest = new Map<string, number>()
  for (const row of rows) {
    highest.set(row.problemId, Math.max(highest.get(row.problemId) ?? 0, row.hintsUsedAtSubmit))
  }
  return [...highest.values()].reduce((total, count) => total + count, 0)
}
