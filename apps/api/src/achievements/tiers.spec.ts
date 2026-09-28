import { BADGES } from './catalog'
import { momentsToShow, resolveTier } from './tiers'

const FOUR = [
  { tier: 'BRONZE', threshold: 1 },
  { tier: 'SILVER', threshold: 5 },
  { tier: 'GOLD', threshold: 15 },
  { tier: 'PLATINUM', threshold: 40 },
] as const

describe('resolveTier', () => {
  it('has no tier below the first threshold, and aims at bronze', () => {
    expect(resolveTier(0, FOUR)).toEqual({ tier: null, earned: [], next: { tier: 'BRONZE', threshold: 1 } })
  })

  it('earns every tier at or below the value and aims at the next', () => {
    expect(resolveTier(7, FOUR)).toEqual({
      tier: 'SILVER',
      earned: ['BRONZE', 'SILVER'],
      next: { tier: 'GOLD', threshold: 15 },
    })
  })

  it('counts a value exactly on a threshold as earned', () => {
    expect(resolveTier(15, FOUR).tier).toBe('GOLD')
  })

  it('has nothing next at the top', () => {
    expect(resolveTier(99, FOUR)).toEqual({
      tier: 'PLATINUM',
      earned: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'],
      next: null,
    })
  })

  it('supports a badge with fewer than four tiers', () => {
    const three = FOUR.slice(0, 3)
    expect(resolveTier(15, three)).toEqual({ tier: 'GOLD', earned: ['BRONZE', 'SILVER', 'GOLD'], next: null })
  })
})

describe('momentsToShow', () => {
  it('celebrates only the highest new tier per badge', () => {
    // An existing user's first visit can cross several tiers at once; eleven
    // popups in a row would bury the one that matters.
    expect(
      momentsToShow([
        { badge: 'sharp-first-try', tier: 'BRONZE' },
        { badge: 'sharp-first-try', tier: 'SILVER' },
        { badge: 'on-fire', tier: 'BRONZE' },
        { badge: 'sharp-first-try', tier: 'GOLD' },
      ]),
    ).toEqual([
      { badge: 'sharp-first-try', tier: 'GOLD' },
      { badge: 'on-fire', tier: 'BRONZE' },
    ])
  })

  it('shows nothing when nothing is new', () => {
    expect(momentsToShow([])).toEqual([])
  })
})

describe('the catalog', () => {
  it('has twelve badges with unique slugs', () => {
    expect(BADGES).toHaveLength(12)
    expect(new Set(BADGES.map((badge) => badge.slug)).size).toBe(12)
  })

  it('orders every badge’s tiers bronze upward with strictly rising thresholds', () => {
    const ORDER = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']
    for (const badge of BADGES) {
      expect(badge.tiers.length).toBeGreaterThanOrEqual(3)
      badge.tiers.forEach((tier, index) => {
        expect(tier.tier).toBe(ORDER[index])
        if (index > 0) expect(tier.threshold).toBeGreaterThan(badge.tiers[index - 1]?.threshold ?? 0)
      })
    }
  })

  it('never offers a badge for raw volume', () => {
    // Architecture §11: 500 problems ground out must not outrank 200 understood.
    expect(BADGES.map((badge) => badge.metric)).not.toContain('problemsSolved')
  })
})
