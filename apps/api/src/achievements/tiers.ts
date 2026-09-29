import type { AchievementTier, Unlock } from '@guruji/types'
import type { TierDefinition } from './catalog'

const RANK: Record<AchievementTier, number> = { BRONZE: 1, SILVER: 2, GOLD: 3, PLATINUM: 4, DIAMOND: 5 }

export interface ResolvedTier {
  /** Highest tier earned, or null. */
  tier: AchievementTier | null
  /** Every tier earned, lowest first. */
  earned: AchievementTier[]
  /** The next tier to aim for; null at the top. */
  next: TierDefinition | null
}

/** Where a value sits on a badge's ladder. Reaching a threshold exactly earns it. */
export function resolveTier(value: number, tiers: readonly TierDefinition[]): ResolvedTier {
  const earned = tiers.filter((tier) => value >= tier.threshold)
  const next = tiers.find((tier) => value < tier.threshold) ?? null
  return {
    tier: earned.at(-1)?.tier ?? null,
    earned: earned.map((tier) => tier.tier),
    next: next === null ? null : { tier: next.tier, threshold: next.threshold },
  }
}

/**
 * The unlocks worth a moment: the highest new tier of each badge, in the order
 * the badges were first seen. Lower tiers crossed at the same time are still
 * recorded — just not celebrated one by one.
 */
export function momentsToShow(unlocks: readonly Unlock[]): Unlock[] {
  const best = new Map<string, Unlock>()
  for (const unlock of unlocks) {
    const current = best.get(unlock.badge)
    if (current === undefined || RANK[unlock.tier] > RANK[current.tier]) best.set(unlock.badge, unlock)
  }
  return [...best.values()]
}
