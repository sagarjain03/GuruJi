/**
 * Where a user's day starts and ends, in UTC instants.
 *
 * Every timestamp stored is UTC, and that is not negotiable. But "what is due
 * today" is a *local-day* question, and answering it with UTC midnight means a
 * user in `Asia/Kolkata` watches their queue roll over at 5:30 in the morning.
 *
 * The timezone is an IANA name rather than a fixed offset, because an offset is
 * wrong twice a year in every region with daylight saving — and that bug gets
 * reported as "the app is weird in the morning" and takes a week to find.
 */

/**
 * The instant the user's current local day began, and the one it ends at.
 *
 * `Intl` does the work. Computing an offset by hand means reimplementing the
 * IANA database, and the copy in the runtime is the one that gets updated when
 * a government changes its rules.
 */
export function localDayBounds(now: Date, timeZone: string): { start: Date; end: Date } {
  const start = startOfLocalDay(now, timeZone)
  const end = startOfLocalDay(addDays(start, 1), timeZone)
  return { start, end }
}

/**
 * The UTC instant at which the local day containing `at` started.
 *
 * Done by measuring the zone's offset at that instant and subtracting it,
 * rather than by formatting and re-parsing a wall-clock string. A DST boundary
 * makes some local times ambiguous and others nonexistent, and a round trip
 * through a string silently picks one — usually the wrong one, once a year.
 */
export function startOfLocalDay(at: Date, timeZone: string): Date {
  const offsetMs = zoneOffsetMs(at, timeZone)
  const local = new Date(at.getTime() + offsetMs)

  const localMidnight = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
    0,
    0,
    0,
    0,
  )

  /*
   * Re-measured at the candidate instant, not reused from above.
   *
   * On the day a clock moves, the offset at midday is not the offset at
   * midnight. Using the first measurement would put the boundary an hour out
   * for exactly the users whose region just changed — which is the bug this
   * whole module exists to avoid.
   */
  const candidate = new Date(localMidnight - offsetMs)
  const corrected = zoneOffsetMs(candidate, timeZone)
  return corrected === offsetMs ? candidate : new Date(localMidnight - corrected)
}

/** `YYYY-MM-DD` as the user's calendar would show it. */
export function localDateString(at: Date, timeZone: string): string {
  const local = new Date(at.getTime() + zoneOffsetMs(at, timeZone))
  return local.toISOString().slice(0, 10)
}

/**
 * How far ahead of UTC the zone is at that instant, in milliseconds.
 *
 * `en-CA` because it formats as `YYYY-MM-DD`, which `Date.parse` reads
 * unambiguously. A locale-dependent format here would work on one machine and
 * not on another.
 */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const parts = new Map(formatter.formatToParts(at).map((part) => [part.type, part.value]))

  const asUtc = Date.UTC(
    Number(parts.get('year')),
    Number(parts.get('month')) - 1,
    Number(parts.get('day')),
    // Midnight formats as hour 24 in some runtimes rather than 0.
    Number(parts.get('hour')) % 24,
    Number(parts.get('minute')),
    Number(parts.get('second')),
  )

  // Seconds resolution is all `Intl` gives; the stored instant has more, and
  // the difference would otherwise show up as a sub-second drift in the bounds.
  return asUtc - Math.floor(at.getTime() / 1000) * 1000
}

function addDays(at: Date, days: number): Date {
  return new Date(at.getTime() + days * 24 * 60 * 60 * 1000)
}

/** A timezone the runtime does not know is a bad profile, not a crash. */
export function safeTimeZone(timeZone: string | null | undefined): string {
  if (timeZone === null || timeZone === undefined || timeZone.length === 0) {
    return 'UTC'
  }
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone })
    return timeZone
  } catch {
    return 'UTC'
  }
}
