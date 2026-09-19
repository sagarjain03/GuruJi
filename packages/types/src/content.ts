import { z } from 'zod'
import { languageSchema } from './auth'
import { cursorQuerySchema } from './pagination'

/**
 * Wire-level copies of the content enums, for the same reason as the auth ones:
 * this package is imported by the browser, and importing the Prisma client here
 * would ship the ORM to the client.
 */
export const difficultySchema = z.enum(['EASY', 'MEDIUM', 'HARD'])
export type Difficulty = z.infer<typeof difficultySchema>

export const roadmapSectionSchema = z.enum([
  'FOUNDATION',
  'DATA_STRUCTURES',
  'TREES',
  'GRAPHS',
  'ADVANCED',
])
export type RoadmapSection = z.infer<typeof roadmapSectionSchema>

export const tagRelevanceSchema = z.enum(['PRIMARY', 'SECONDARY'])
export type TagRelevance = z.infer<typeof tagRelevanceSchema>

/** How a problem got here. `EXTERNAL_REFERENCE` statements are never republished. */
export const problemSourceSchema = z.enum([
  'ORIGINAL',
  'LICENSED',
  'EXTERNAL_REFERENCE',
  'AI_GENERATED',
])
export type ProblemSource = z.infer<typeof problemSourceSchema>

/* -------------------------------------------------------------------------- */
/* Topics and patterns                                                        */
/* -------------------------------------------------------------------------- */

/** Just enough to render a chip or a link. */
export const taxonomyRefSchema = z.object({
  slug: z.string(),
  name: z.string(),
  relevance: tagRelevanceSchema,
})
export type TaxonomyRef = z.infer<typeof taxonomyRefSchema>

export const topicSummarySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  displayOrder: z.number().int(),
  problemCount: z.number().int(),
  prerequisiteSlugs: z.array(z.string()),
})
export type TopicSummary = z.infer<typeof topicSummarySchema>

export const patternSummarySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  displayOrder: z.number().int(),
  problemCount: z.number().int(),
})
export type PatternSummary = z.infer<typeof patternSummarySchema>

/* -------------------------------------------------------------------------- */
/* Problems                                                                   */
/* -------------------------------------------------------------------------- */

export const problemExampleSchema = z.object({
  input: z.string(),
  output: z.string(),
  explanation: z.string().nullable(),
})
export type ProblemExample = z.infer<typeof problemExampleSchema>

/** Starter code per language. Partial: a problem may not support all four. */
export const starterCodeSchema = z.partialRecord(languageSchema, z.string())
export type StarterCode = z.infer<typeof starterCodeSchema>

/** A row in the problem list. No statement — that is a detail-page payload. */
export const problemListItemSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  difficulty: difficultySchema,
  estimatedMinutes: z.number().int(),
  // Null until someone has submitted against it. Not zero — zero would read as
  // "nobody has ever solved this", which is a different and discouraging claim.
  acceptanceRate: z.number().nullable(),
  topics: z.array(taxonomyRefSchema),
  patterns: z.array(taxonomyRefSchema),
})
export type ProblemListItem = z.infer<typeof problemListItemSchema>

/**
 * A sample test case. Hidden cases have no wire representation at all — there is
 * deliberately no schema they could be serialised into.
 */
export const sampleTestCaseSchema = z.object({
  id: z.uuid(),
  input: z.string(),
  expectedOutput: z.string(),
  displayOrder: z.number().int(),
})
export type SampleTestCase = z.infer<typeof sampleTestCaseSchema>

export const problemDetailSchema = problemListItemSchema.extend({
  statement: z.string(),
  constraints: z.string(),
  examples: z.array(problemExampleSchema),
  starterCode: starterCodeSchema,
  timeLimitMs: z.number().int(),
  memoryLimitMb: z.number().int(),
  source: problemSourceSchema,
  sourceUrl: z.string().nullable(),
  sampleTestCases: z.array(sampleTestCaseSchema),
  // The count, not the hints. Hints are fetched one level at a time so that
  // opening a problem cannot spoil it.
  hintCount: z.number().int(),
})
export type ProblemDetail = z.infer<typeof problemDetailSchema>

export const hintSchema = z.object({
  level: z.number().int(),
  content: z.string(),
})
export type Hint = z.infer<typeof hintSchema>

/**
 * Problem list filters.
 *
 * `status` (solved / attempted / unsolved) is absent on purpose: it is derived
 * from submissions, which do not exist until Phase 4. Accepting the parameter
 * now and ignoring it would be a filter that silently lies.
 */
export const problemQuerySchema = cursorQuerySchema.extend({
  topic: z.string().max(80).optional(),
  pattern: z.string().max(80).optional(),
  difficulty: difficultySchema.optional(),
  q: z.string().trim().max(120).optional(),
})
export type ProblemQuery = z.infer<typeof problemQuerySchema>

/* -------------------------------------------------------------------------- */
/* Roadmap                                                                    */
/* -------------------------------------------------------------------------- */

export interface RoadmapNode {
  id: string
  section: RoadmapSection
  displayOrder: number
  estimatedHours: number
  topic: TopicSummary
  children: RoadmapNode[]
}

// Recursive shape, so the type is declared above and the schema refers back to
// it through z.lazy — zod cannot infer a cycle on its own.
export const roadmapNodeSchema: z.ZodType<RoadmapNode> = z.lazy(() =>
  z.object({
    id: z.uuid(),
    section: roadmapSectionSchema,
    displayOrder: z.number().int(),
    estimatedHours: z.number().int(),
    topic: topicSummarySchema,
    children: z.array(roadmapNodeSchema),
  }),
)

/** The whole tree, grouped by section in curriculum order. */
export const roadmapSchema = z.object({
  sections: z.array(
    z.object({
      section: roadmapSectionSchema,
      nodes: z.array(roadmapNodeSchema),
    }),
  ),
})
export type Roadmap = z.infer<typeof roadmapSchema>

export const topicDetailSchema = topicSummarySchema.extend({
  prerequisites: z.array(z.object({ slug: z.string(), name: z.string() })),
  problems: z.array(problemListItemSchema),
})
export type TopicDetail = z.infer<typeof topicDetailSchema>
