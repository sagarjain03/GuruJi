import { z } from 'zod'
import { cursorQuerySchema } from './pagination'

/**
 * A closed set, not free text.
 *
 * The journal's whole value is aggregation — "you have made this mistake in
 * three sliding-window problems" only works if two people describing the same
 * mistake pick the same word. Free text would make every entry a category of
 * one, and the feature would be a diary instead of a diagnosis.
 */
export const mistakeCategorySchema = z.enum([
  'LOGIC',
  'SYNTAX',
  'EDGE_CASE',
  'COMPLEXITY',
  'IMPLEMENTATION',
  'MISREAD_PROBLEM',
  'WRONG_PATTERN',
  'OFF_BY_ONE',
  'OVERFLOW',
])
export type MistakeCategory = z.infer<typeof mistakeCategorySchema>

/** What each category means, in the words the interface shows. */
export const MISTAKE_CATEGORY_LABEL: Record<MistakeCategory, string> = {
  LOGIC: 'Logic',
  SYNTAX: 'Syntax',
  EDGE_CASE: 'Edge case',
  COMPLEXITY: 'Too slow',
  IMPLEMENTATION: 'Implementation',
  MISREAD_PROBLEM: 'Misread the problem',
  WRONG_PATTERN: 'Wrong approach',
  OFF_BY_ONE: 'Off by one',
  OVERFLOW: 'Overflow',
}

export const MISTAKE_TEXT_MAX = 4000

export const createMistakeRequestSchema = z.object({
  problemId: z.uuid(),
  /** Optional: a mistake can be logged from reflection, not only from a verdict. */
  submissionId: z.uuid().optional(),
  category: mistakeCategorySchema,
  whatWentWrong: z.string().min(1).max(MISTAKE_TEXT_MAX),
  correctIdea: z.string().max(MISTAKE_TEXT_MAX).optional(),
})
export type CreateMistakeRequest = z.infer<typeof createMistakeRequestSchema>

export const mistakeSchema = z.object({
  id: z.uuid(),
  problemId: z.uuid(),
  problemSlug: z.string(),
  problemTitle: z.string(),
  submissionId: z.uuid().nullable(),
  category: mistakeCategorySchema,
  whatWentWrong: z.string(),
  correctIdea: z.string().nullable(),
  /** Written by the mentor in Phase 8. It never overwrites what the user wrote. */
  aiAnalysis: z.string().nullable(),
  createdAt: z.iso.datetime(),
})
export type Mistake = z.infer<typeof mistakeSchema>

export const mistakeQuerySchema = cursorQuerySchema.extend({
  category: mistakeCategorySchema.optional(),
  problemId: z.uuid().optional(),
})
export type MistakeQuery = z.infer<typeof mistakeQuerySchema>

/**
 * The aggregation the journal exists for.
 *
 * Not "you have 14 mistakes" — a count is a scoreboard, and nobody acts on a
 * scoreboard. "Six of your last fourteen were off-by-one, four of them in
 * binary search" is a thing to go and practise.
 */
export const mistakePatternSchema = z.object({
  category: mistakeCategorySchema,
  count: z.number().int(),
  /** The topics it keeps happening in, most frequent first. */
  topics: z.array(z.object({ slug: z.string(), name: z.string(), count: z.number().int() })),
  lastSeenAt: z.iso.datetime(),
})
export type MistakePattern = z.infer<typeof mistakePatternSchema>

export const mistakePatternsResponseSchema = z.object({
  patterns: z.array(mistakePatternSchema),
  total: z.number().int(),
})
export type MistakePatternsResponse = z.infer<typeof mistakePatternsResponseSchema>
