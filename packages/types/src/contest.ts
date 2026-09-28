import { z } from 'zod'
import { difficultySchema } from './content'
import { mistakeCategorySchema } from './mistake'
import { submitRequestSchema } from './submission'

/**
 * Mock contest (Phase 11). A timed, single-user assessment of three problems.
 *
 * The clock belongs to the server: `deadlineAt` is fixed at start, and every
 * view carries `serverNow` so the client can count down without trusting its
 * own clock. Nothing here ranks one learner against another.
 */

export const CONTEST_DURATIONS = [60, 90] as const

export const contestStatusSchema = z.enum(['ACTIVE', 'FINISHED'])
export type ContestStatus = z.infer<typeof contestStatusSchema>

export const contestFinishReasonSchema = z.enum(['EARLY', 'TIME_UP'])
export type ContestFinishReason = z.infer<typeof contestFinishReasonSchema>

export const startContestRequestSchema = z.object({
  durationMinutes: z.union([z.literal(60), z.literal(90)]),
  /** Off by default: an assessment measures what you can do unaided. */
  hintsAllowed: z.boolean().default(false),
})
export type StartContestRequest = z.infer<typeof startContestRequestSchema>

/**
 * A graded submission inside a contest. Never a "Run": sample runs keep going
 * through `/submissions` with `isRun: true` and are not part of the contest.
 */
export const contestSubmitRequestSchema = submitRequestSchema.omit({ isRun: true, hintsUsedAtSubmit: true })
export type ContestSubmitRequest = z.infer<typeof contestSubmitRequestSchema>

export const contestProblemStateSchema = z.enum(['UNSOLVED', 'ATTEMPTED', 'SOLVED'])
export type ContestProblemState = z.infer<typeof contestProblemStateSchema>

export const contestProblemViewSchema = z.object({
  position: z.number().int(),
  problemId: z.uuid(),
  slug: z.string(),
  title: z.string(),
  difficulty: difficultySchema,
  points: z.number().int(),
  /** Picked from solved problems because too few unsolved ones were left. */
  wasSolvedBefore: z.boolean(),
  state: contestProblemStateSchema,
  /** Graded contest submissions; judge failures are not the learner's attempts. */
  attempts: z.number().int(),
})
export type ContestProblemView = z.infer<typeof contestProblemViewSchema>

export const contestViewSchema = z.object({
  id: z.uuid(),
  status: contestStatusSchema,
  durationMinutes: z.number().int(),
  hintsAllowed: z.boolean(),
  startedAt: z.iso.datetime(),
  deadlineAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  finishReason: contestFinishReasonSchema.nullable(),
  /** The server's clock at response time; count down from this, not `Date.now()`. */
  serverNow: z.iso.datetime(),
  score: z.number().int(),
  maxScore: z.number().int(),
  problems: z.array(contestProblemViewSchema),
})
export type ContestView = z.infer<typeof contestViewSchema>

export const contestReportProblemSchema = z.object({
  slug: z.string(),
  title: z.string(),
  difficulty: difficultySchema,
  solved: z.boolean(),
  attempts: z.number().int(),
  /** From contest start to the first accepted submission; null when unsolved. */
  timeToSolveMs: z.number().int().nullable(),
  hintsUsed: z.number().int(),
  topics: z.array(z.string()),
  patterns: z.array(z.string()),
  mistakeCategories: z.array(mistakeCategorySchema),
  wasSolvedBefore: z.boolean(),
})
export type ContestReportProblem = z.infer<typeof contestReportProblemSchema>

export const contestAreaSchema = z.object({
  kind: z.enum(['TOPIC', 'PATTERN']),
  slug: z.string(),
  name: z.string(),
  /** The evidence in plain words: which problems, which mistakes. */
  reason: z.string(),
})
export type ContestArea = z.infer<typeof contestAreaSchema>

export const contestReportSchema = z.object({
  contestId: z.uuid(),
  score: z.number().int(),
  maxScore: z.number().int(),
  finishReason: contestFinishReasonSchema,
  problems: z.array(contestReportProblemSchema),
  /** Null when everything was solved — there is no weakness to name. */
  weakArea: contestAreaSchema.nullable(),
  /** Only when all were solved: the slowest topic, which is not a weakness. */
  slowest: contestAreaSchema.nullable(),
})
export type ContestReport = z.infer<typeof contestReportSchema>
