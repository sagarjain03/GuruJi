import { z } from 'zod'

// Defined in ./labels (no runtime imports) and re-exported, so the web can take them without zod.
export { REVISION_OUTCOME_LABEL, REVISION_STATE_LABEL } from './labels'

/**
 * How a revision went.
 *
 * Graded on *how* the answer was reconstructed, not only whether it was. A
 * problem solved after twenty minutes of flailing is different evidence from
 * one solved in three, and a schedule that treats them alike brings the second
 * one back far too late.
 */
export const revisionOutcomeSchema = z.enum([
  'SOLVED_EASILY',
  'SOLVED_WITH_EFFORT',
  'STRUGGLED',
  'FAILED',
])
export type RevisionOutcome = z.infer<typeof revisionOutcomeSchema>


export const revisionStateSchema = z.enum(['LEARNING', 'REVIEWING', 'MASTERED', 'LAPSED'])
export type RevisionState = z.infer<typeof revisionStateSchema>


export const queueItemSchema = z.object({
  id: z.uuid(),
  problemId: z.uuid(),
  slug: z.string(),
  title: z.string(),
  difficulty: z.string(),
  state: revisionStateSchema,
  dueAt: z.iso.datetime(),
  /** Negative while it is still in the future. */
  overdueDays: z.number().int(),
  topicMastery: z.number().nullable(),
})
export type QueueItem = z.infer<typeof queueItemSchema>

export const dueQueueSchema = z.object({
  items: z.array(queueItemSchema),
  /** Everything due, including what did not fit today. */
  totalDue: z.number().int(),
  /**
   * What the cap held back. Shown rather than hidden — "24 to catch up on, 10
   * today" is a plan; a queue that silently forgets fourteen of them is a lie.
   */
  carriedForward: z.number().int(),
  cap: z.number().int(),
  catchingUp: z.boolean(),
})
export type DueQueue = z.infer<typeof dueQueueSchema>

export const upcomingDaySchema = z.object({
  /** `YYYY-MM-DD` in the user's own timezone. */
  date: z.string(),
  due: z.number().int(),
  /** What will actually be offered that day, after the cap. */
  capped: z.number().int(),
})
export type UpcomingDay = z.infer<typeof upcomingDaySchema>

export const completeRevisionRequestSchema = z.object({
  outcome: revisionOutcomeSchema,
  /** Present when a graded submission backs the outcome. */
  submissionId: z.uuid().optional(),
})
export type CompleteRevisionRequest = z.infer<typeof completeRevisionRequestSchema>

export const completeRevisionResponseSchema = z.object({
  state: revisionStateSchema,
  dueAt: z.iso.datetime(),
})
export type CompleteRevisionResponse = z.infer<typeof completeRevisionResponseSchema>
