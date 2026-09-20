import { z } from 'zod'

/**
 * One component of a mastery score, as the interface shows it.
 *
 * `value` is null when there is nothing to measure it from — no revision
 * history yet, no patterns tagged. That is a different statement from zero, and
 * the two must not look the same: "nobody has asked you yet" is not "you failed
 * this". The weight is what was *actually* applied, after unmeasured components
 * hand their share to the ones that could be measured.
 */
export const masteryComponentSchema = z.object({
  name: z.enum([
    'accuracy',
    'retention',
    'difficultyPerformance',
    'patternCoverage',
    'speed',
    'hintDependency',
  ]),
  value: z.number().nullable(),
  weight: z.number(),
})
export type MasteryComponent = z.infer<typeof masteryComponentSchema>

/**
 * A score the user can interrogate.
 *
 * "Why is my Graphs score 40?" must have an answer — accuracy 55%, retention
 * unmeasured, hint dependency high — and not a shrug. An opaque score nobody
 * can take apart is indistinguishable from a made-up one, and it will be
 * treated as one.
 */
export const masterySchema = z.object({
  score: z.number().int(),
  band: z.string(),
  /** True until there are enough attempts for the score to mean anything. */
  lowData: z.boolean(),
  confidence: z.number(),
  components: z.array(masteryComponentSchema),
})
export type Mastery = z.infer<typeof masterySchema>

export const topicProgressSchema = z.object({
  topicId: z.uuid(),
  slug: z.string(),
  name: z.string(),
  attempts: z.number().int(),
  solved: z.number().int(),
  lastPracticedAt: z.iso.datetime().nullable(),
  mastery: masterySchema,
})
export type TopicProgress = z.infer<typeof topicProgressSchema>

export const patternProgressSchema = z.object({
  patternId: z.uuid(),
  slug: z.string(),
  name: z.string(),
  attempts: z.number().int(),
  solved: z.number().int(),
  lastPracticedAt: z.iso.datetime().nullable(),
  mastery: masterySchema,
})
export type PatternProgress = z.infer<typeof patternProgressSchema>

/** One day of activity, for the heatmap. */
export const activityDaySchema = z.object({
  /** `YYYY-MM-DD` in UTC. The client renders it in local time. */
  date: z.string(),
  attempted: z.number().int(),
  solved: z.number().int(),
})
export type ActivityDay = z.infer<typeof activityDaySchema>

/**
 * The streak.
 *
 * Deliberately **not** an input to mastery — consistency is a habit, not a
 * skill, and a model that rewarded it would let someone raise their score by
 * logging in. It is shown because it is motivating, and it is kept out of the
 * model for exactly the same reason.
 */
export const streakSchema = z.object({
  current: z.number().int(),
  longest: z.number().int(),
  /** Null when nothing has ever been solved. */
  lastActiveDate: z.string().nullable(),
})
export type Streak = z.infer<typeof streakSchema>

export const analyticsOverviewSchema = z.object({
  totalAttempted: z.number().int(),
  totalSolved: z.number().int(),
  solvedByDifficulty: z.object({
    easy: z.number().int(),
    medium: z.number().int(),
    hard: z.number().int(),
  }),
  streak: streakSchema,
  /** Ordered weakest first — the list the dashboard turns into "work on this". */
  topics: z.array(topicProgressSchema),
  patterns: z.array(patternProgressSchema),
  activity: z.array(activityDaySchema),
})
export type AnalyticsOverview = z.infer<typeof analyticsOverviewSchema>
