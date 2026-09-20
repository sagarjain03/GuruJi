import { describe, expect, it } from 'vitest'
import { localDateString, localDayBounds, safeTimeZone, startOfLocalDay } from './local-day'

/**
 * The bug this file exists to prevent gets reported as "the app is weird in the
 * morning" and takes a week to find. So the awkward cases are pinned here
 * rather than left to be discovered by a user in March.
 */
describe('local day boundaries', () => {
  it('starts a UTC user’s day at UTC midnight', () => {
    const { start, end } = localDayBounds(new Date('2026-09-20T13:00:00Z'), 'UTC')

    expect(start.toISOString()).toBe('2026-09-20T00:00:00.000Z')
    expect(end.toISOString()).toBe('2026-09-21T00:00:00.000Z')
  })

  it('starts an Asia/Kolkata day at 18:30 the previous UTC day', () => {
    const { start } = localDayBounds(new Date('2026-09-20T13:00:00Z'), 'Asia/Kolkata')

    // +05:30. Using UTC midnight would roll this user's queue over at half past
    // five in the morning, every day.
    expect(start.toISOString()).toBe('2026-09-19T18:30:00.000Z')
  })

  it('puts a late-evening Kolkata instant in the right local day', () => {
    // 01:00 UTC is 06:30 local, the same calendar day.
    expect(localDateString(new Date('2026-09-20T01:00:00Z'), 'Asia/Kolkata')).toBe('2026-09-20')
    // 19:00 UTC is 00:30 local — already tomorrow.
    expect(localDateString(new Date('2026-09-20T19:00:00Z'), 'Asia/Kolkata')).toBe('2026-09-21')
  })

  it('handles a zone behind UTC', () => {
    const { start } = localDayBounds(new Date('2026-09-20T13:00:00Z'), 'America/New_York')

    // −04:00 in September.
    expect(start.toISOString()).toBe('2026-09-20T04:00:00.000Z')
  })

  describe('across a DST transition', () => {
    /*
     * The case a fixed offset gets wrong, and a format-and-reparse gets wrong
     * differently. New York moves to −04:00 on 8 March 2026 at 02:00 local.
     */
    it('uses the offset in force *before* the spring-forward day', () => {
      const { start } = localDayBounds(new Date('2026-03-07T18:00:00Z'), 'America/New_York')

      // Still −05:00.
      expect(start.toISOString()).toBe('2026-03-07T05:00:00.000Z')
    })

    it('uses the offset in force on the spring-forward day itself', () => {
      // Midday on the day the clocks moved: the day *started* at −05:00, even
      // though by now the zone is at −04:00. Measuring the offset once, at the
      // current instant, would put this boundary an hour out.
      const { start } = localDayBounds(new Date('2026-03-08T18:00:00Z'), 'America/New_York')

      expect(start.toISOString()).toBe('2026-03-08T05:00:00.000Z')
      expect(localDateString(new Date('2026-03-08T18:00:00Z'), 'America/New_York')).toBe(
        '2026-03-08',
      )
    })

    it('uses the offset in force the day after', () => {
      const { start } = localDayBounds(new Date('2026-03-09T18:00:00Z'), 'America/New_York')

      // Now −04:00.
      expect(start.toISOString()).toBe('2026-03-09T04:00:00.000Z')
    })

    it('handles the autumn fall-back day', () => {
      // 1 November 2026, back to −05:00 at 02:00 local.
      const { start } = localDayBounds(new Date('2026-11-01T18:00:00Z'), 'America/New_York')

      expect(start.toISOString()).toBe('2026-11-01T04:00:00.000Z')
    })
  })

  it('gives a day that is one day long, in zones with and without DST', () => {
    for (const zone of ['UTC', 'Asia/Kolkata', 'America/New_York', 'Australia/Lord_Howe']) {
      const { start, end } = localDayBounds(new Date('2026-06-15T09:00:00Z'), zone)
      const hours = (end.getTime() - start.getTime()) / (60 * 60 * 1000)

      // 23, 24 or 25 depending on the day. Never zero, never negative, never a
      // fortnight — all of which a careless offset calculation can produce.
      expect(hours).toBeGreaterThanOrEqual(23)
      expect(hours).toBeLessThanOrEqual(25)
    }
  })

  it('starts the day at the same instant however far into it we ask', () => {
    const zone = 'Asia/Kolkata'
    const morning = startOfLocalDay(new Date('2026-09-20T19:00:00Z'), zone)
    const evening = startOfLocalDay(new Date('2026-09-21T17:00:00Z'), zone)

    // Both instants are the same local day, so both must agree on when it began.
    expect(morning.toISOString()).toBe(evening.toISOString())
  })

  it('falls back to UTC for a timezone the runtime does not know', () => {
    // A bad profile value is bad data, not a reason to fail a request.
    expect(safeTimeZone('Mars/Olympus_Mons')).toBe('UTC')
    expect(safeTimeZone('')).toBe('UTC')
    expect(safeTimeZone(null)).toBe('UTC')
    expect(safeTimeZone('Asia/Kolkata')).toBe('Asia/Kolkata')
  })
})
