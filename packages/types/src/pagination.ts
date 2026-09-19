import { z } from 'zod'

/**
 * The collection envelope from docs/api.md.
 *
 * Cursor-based, not offset: problem lists and submission history are both
 * ordered by `createdAt desc` and both grow, and offset pagination skips or
 * repeats rows when new entries land mid-scroll.
 */
export function paginatedSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    // Null means this page is the last one; `hasMore` says the same thing more
    // readably at a call site that only needs a boolean.
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  })
}

export interface Paginated<T> {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}

/** Shared by every cursor-paginated query. */
export const cursorQuerySchema = z.object({
  cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})
export type CursorQuery = z.infer<typeof cursorQuerySchema>
