import { z } from 'zod'
import { languageSchema } from './auth'

/**
 * The largest draft the server will store.
 *
 * An unbounded text column that any signed-in user can write to is a storage
 * denial vector, and 100k characters is far past any solution a human types.
 */
export const DRAFT_CODE_MAX = 100_000

export const draftSchema = z.object({
  problemId: z.uuid(),
  language: languageSchema,
  code: z.string(),
  updatedAt: z.iso.datetime(),
})
export type Draft = z.infer<typeof draftSchema>

/**
 * What autosave sends. The problem and language come from the URL, so the body
 * carries only the code — a body that could name a different problem than the
 * path is a body that has to be checked against the path.
 */
export const saveDraftSchema = z.object({
  code: z.string().max(DRAFT_CODE_MAX, 'That is too much code to save.'),
})
export type SaveDraftRequest = z.infer<typeof saveDraftSchema>

/**
 * Every draft the caller has for one problem, one per language.
 *
 * All of them are fetched together rather than one at a time: switching language
 * is a click, and a round trip per click would make the switch feel broken.
 */
export const draftsResponseSchema = z.object({
  drafts: z.array(draftSchema),
})
export type DraftsResponse = z.infer<typeof draftsResponseSchema>
