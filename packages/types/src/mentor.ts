import { z } from 'zod'

/**
 * The mentor history: what the mentor has already told someone, newest first,
 * so an explanation or a revealed solution is not lost when the tab closes.
 */

export const mentorHistoryModeSchema = z.enum([
  'HINT',
  'EXPLAIN',
  'ANALYZE_CODE',
  'EXPLAIN_WRONG_ANSWER',
  'SHOW_SOLUTION',
])
export type MentorHistoryMode = z.infer<typeof mentorHistoryModeSchema>

export const mentorHistorySectionSchema = z.object({
  title: z.string(),
  text: z.string(),
})
export type MentorHistorySection = z.infer<typeof mentorHistorySectionSchema>

export const mentorHistoryEntrySchema = z.object({
  id: z.string(),
  mode: mentorHistoryModeSchema,
  createdAt: z.iso.datetime(),
  /** Null when the problem has since been removed. */
  problem: z.object({ slug: z.string(), title: z.string() }).nullable(),
  /** Set for hints only. */
  hintLevel: z.number().int().nullable(),
  /** The answer in labelled parts, in the order the mentor panel shows them. */
  sections: z.array(mentorHistorySectionSchema),
  /** A revealed solution's code; null otherwise. */
  code: z.string().nullable(),
})
export type MentorHistoryEntry = z.infer<typeof mentorHistoryEntrySchema>

export const mentorHistoryResponseSchema = z.object({
  entries: z.array(mentorHistoryEntrySchema),
})
export type MentorHistoryResponse = z.infer<typeof mentorHistoryResponseSchema>
