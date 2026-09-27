/**
 * The server buckets by UTC day, so a `YYYY-MM-DD` here names a calendar day,
 * not an instant. Formatting it in UTC keeps "Sep 3" from sliding to "Sep 2"
 * for everyone west of Greenwich.
 */
const DAY = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const SHORT_DAY = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
const MONTH = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' })

export function parseDay(day: string): Date {
  return new Date(`${day}T00:00:00Z`)
}

export function toDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(day: string, days: number): string {
  const date = parseDay(day)
  date.setUTCDate(date.getUTCDate() + days)
  return toDay(date)
}

export const formatDay = (day: string) => DAY.format(parseDay(day))
export const formatShortDay = (day: string) => SHORT_DAY.format(parseDay(day))
export const formatMonth = (day: string) => MONTH.format(parseDay(day))

export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`
}

export function formatMinutes(ms: number | null): string {
  if (ms === null) return '—'
  const minutes = ms / 60_000
  return minutes < 10 ? `${minutes.toFixed(1)} min` : `${Math.round(minutes)} min`
}
