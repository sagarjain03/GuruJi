import { z } from 'zod'

/**
 * What TRAIN NOW decided to do — an activity, not merely a problem.
 *
 * The answer to "what should I do now" is sometimes "clear your revision
 * queue", and a product that can only answer with a problem cannot say that.
 */
export const recommendationKindSchema = z.enum([
  'REVISION',
  'WEAK_TOPIC',
  'NEW_PATTERN',
  'NEW_PROBLEM',
  'MOCK_CHALLENGE',
])
export type RecommendationKind = z.infer<typeof recommendationKindSchema>

export const RECOMMENDATION_KIND_LABEL: Record<RecommendationKind, string> = {
  REVISION: 'Revise',
  WEAK_TOPIC: 'Shore up a weak area',
  NEW_PATTERN: 'Learn a new technique',
  NEW_PROBLEM: 'Keep moving',
  MOCK_CHALLENGE: 'Test yourself under time',
}

export const recommendationSchema = z.object({
  id: z.uuid(),
  kind: recommendationKindSchema,
  /** Null for a challenge, which is an activity rather than one problem. */
  problemId: z.uuid().nullable(),
  slug: z.string().nullable(),
  title: z.string().nullable(),
  difficulty: z.string().nullable(),
  score: z.number(),
  /**
   * Derived from the scoring breakdown, never written by a model.
   *
   * It is the user's only window into the engine. A plausible invented
   * explanation would be worse than none — it teaches them to trust something
   * that is guessing.
   */
  reason: z.string().min(1),
})
export type Recommendation = z.infer<typeof recommendationSchema>

export const trainNowSchema = z.object({
  kind: recommendationKindSchema,
  recommendation: recommendationSchema.nullable(),
  reason: z.string(),
})
export type TrainNow = z.infer<typeof trainNowSchema>
