import { z } from 'zod'

/**
 * Achievements: badges for how someone learns, never for how much. Nothing
 * here is an input to mastery, recommendations or revision.
 */

// DIAMOND exists for the long-haul streak badge; most badges stop at PLATINUM.
export const achievementTierSchema = z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'])
export type AchievementTier = z.infer<typeof achievementTierSchema>

export const badgeTierSchema = z.object({
  tier: achievementTierSchema,
  threshold: z.number().int(),
  /** When this tier was first observed; null while locked. */
  unlockedAt: z.iso.datetime().nullable(),
})
export type BadgeTier = z.infer<typeof badgeTierSchema>

export const badgeSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  /** Which glyph the medallion draws. */
  icon: z.string(),
  /** The metric's current value. */
  value: z.number().int(),
  /** Highest tier earned, or null. */
  tier: achievementTierSchema.nullable(),
  /** The next tier to aim for; null once the top tier is earned. */
  next: z.object({ tier: achievementTierSchema, threshold: z.number().int() }).nullable(),
  tiers: z.array(badgeTierSchema),
})
export type Badge = z.infer<typeof badgeSchema>

export const unlockSchema = z.object({
  badge: z.string(),
  tier: achievementTierSchema,
})
export type Unlock = z.infer<typeof unlockSchema>

export const trophyCaseSchema = z.object({
  badges: z.array(badgeSchema),
  /**
   * Unlocks not yet shown, at most one per badge (its highest). Lower tiers
   * crossed at the same time are recorded but not celebrated separately.
   */
  new: z.array(unlockSchema),
})
export type TrophyCase = z.infer<typeof trophyCaseSchema>

export const markSeenRequestSchema = z
  .object({ unlocks: z.array(unlockSchema).max(64) })
  .strict()
export type MarkSeenRequest = z.infer<typeof markSeenRequestSchema>
