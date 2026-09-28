import { z } from 'zod'
import { activityDaySchema } from './progress'

/**
 * A date range for the analytics endpoints: `YYYY-MM-DD`, UTC, both ends
 * inclusive. Either end may be omitted; the server fills in the defaults and
 * bounds the span, because an unbounded `from`/`to` is a cheap way to ask the
 * database for everything.
 */
export const analyticsRangeQuerySchema = z
  .object({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  // An unknown parameter is refused, not ignored — nothing else is accepted.
  .strict()
export type AnalyticsRangeQuery = z.infer<typeof analyticsRangeQuerySchema>

/** The range the server actually used, echoed back so the client can label it. */
export const resolvedRangeSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
})
export type ResolvedRange = z.infer<typeof resolvedRangeSchema>

export const activityResponseSchema = resolvedRangeSchema.extend({
  /** Only days with activity; the client fills the gaps with zero. */
  days: z.array(activityDaySchema),
})
export type ActivityResponse = z.infer<typeof activityResponseSchema>

const difficultyCountSchema = z.object({
  attempted: z.number().int(),
  solved: z.number().int(),
})

export const difficultyDistributionSchema = z.object({
  easy: difficultyCountSchema,
  medium: difficultyCountSchema,
  hard: difficultyCountSchema,
})
export type DifficultyDistribution = z.infer<typeof difficultyDistributionSchema>

/**
 * One topic or pattern, as the analytics page charts it.
 *
 * `accuracy` is first-attempt solves over distinct problems attempted — the
 * same honest signal the mastery model uses — and null with no attempts,
 * because 0% and "never tried" must not look the same.
 */
export const performanceRowSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  attempts: z.number().int(),
  solved: z.number().int(),
  accuracy: z.number().nullable(),
  masteryScore: z.number().int(),
})
export type PerformanceRow = z.infer<typeof performanceRowSchema>

export const topicAnalyticsSchema = z.object({
  topics: z.array(performanceRowSchema),
  patterns: z.array(performanceRowSchema),
  /** Distinct problems, not submissions: retrying one problem is one problem. */
  difficulty: difficultyDistributionSchema,
})
export type TopicAnalytics = z.infer<typeof topicAnalyticsSchema>

/** One UTC week, Monday to Sunday. */
export const trendWeekSchema = z.object({
  /** The Monday that starts the week, `YYYY-MM-DD`. */
  weekStart: z.iso.date(),
  submissions: z.number().int(),
  accepted: z.number().int(),
  /** Accepted over graded submissions; null for a week with none. */
  accuracy: z.number().nullable(),
  /**
   * Median time spent on accepted submissions. A median rather than a mean:
   * one editor left open overnight would otherwise own the whole chart.
   */
  medianSolveTimeMs: z.number().int().nullable(),
})
export type TrendWeek = z.infer<typeof trendWeekSchema>

export const trendsResponseSchema = resolvedRangeSchema.extend({
  /** Every week in the range, including empty ones, oldest first. */
  weeks: z.array(trendWeekSchema),
})
export type TrendsResponse = z.infer<typeof trendsResponseSchema>
