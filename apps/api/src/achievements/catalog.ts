import type { AchievementTier } from '@guruji/types'

/**
 * The badges. Code, not data: each criterion is typed, reviewed and tested,
 * rather than a JSON blob in a table nobody can unit-test.
 *
 * Every badge rewards *how* someone learns — first-try accuracy, recall,
 * breadth, persistence, working unaided. None counts raw volume: that is how
 * someone who ground out 500 problems would outrank someone who understood 200
 * (architecture §11). And none of this is ever an input to mastery.
 */

export type Metric =
  | 'firstTrySolves'
  | 'revisionsRecalled'
  | 'patternsSolved'
  | 'topicsSolved'
  | 'longestStreak'
  | 'hardSolved'
  | 'unaidedSolves'
  | 'comebacks'
  | 'journalEntries'
  | 'contestsFinished'
  | 'cleanSweeps'
  | 'languagesAccepted'

export interface TierDefinition {
  tier: AchievementTier
  threshold: number
}

export interface BadgeDefinition {
  slug: string
  name: string
  description: string
  /** The glyph the medallion draws; mapped to an icon on the web. */
  icon: string
  metric: Metric
  tiers: readonly TierDefinition[]
}

const tiers = (
  bronze: number,
  silver: number,
  gold: number,
  platinum?: number,
  diamond?: number,
): TierDefinition[] => [
  { tier: 'BRONZE', threshold: bronze },
  { tier: 'SILVER', threshold: silver },
  { tier: 'GOLD', threshold: gold },
  ...(platinum === undefined ? [] : [{ tier: 'PLATINUM' as const, threshold: platinum }]),
  ...(diamond === undefined ? [] : [{ tier: 'DIAMOND' as const, threshold: diamond }]),
]

export const BADGES: readonly BadgeDefinition[] = [
  {
    slug: 'sharp-first-try',
    name: 'Sharp First Try',
    description: 'Problems solved on the first graded submission.',
    icon: 'zap',
    metric: 'firstTrySolves',
    tiers: tiers(1, 5, 15, 40),
  },
  {
    slug: 'memory-keeper',
    name: 'Memory Keeper',
    description: 'Revisions that came back easily or with effort.',
    icon: 'brain',
    metric: 'revisionsRecalled',
    tiers: tiers(1, 5, 20, 50),
  },
  {
    slug: 'pattern-hunter',
    name: 'Pattern Hunter',
    description: 'Different techniques with at least one solve.',
    icon: 'puzzle',
    metric: 'patternsSolved',
    tiers: tiers(2, 4, 8, 15),
  },
  {
    slug: 'explorer',
    name: 'Explorer',
    description: 'Different topics with at least one solve.',
    icon: 'compass',
    metric: 'topicsSolved',
    tiers: tiers(2, 4, 8, 12),
  },
  {
    slug: 'on-fire',
    name: 'On Fire',
    description: 'Your longest run of days with a solve.',
    icon: 'flame',
    metric: 'longestStreak',
    tiers: tiers(3, 7, 14, 30),
  },
  {
    // On Fire covers the first month; this is the long haul after it. Same
    // metric — a streak is persistence, not volume.
    slug: 'unbroken',
    name: 'Unbroken',
    description: 'Your longest run of days with a solve, kept for months.',
    icon: 'infinity',
    metric: 'longestStreak',
    tiers: tiers(50, 100, 200, 365, 500),
  },
  {
    slug: 'hard-mode',
    name: 'Hard Mode',
    description: 'Hard problems solved.',
    icon: 'skull',
    metric: 'hardSolved',
    tiers: tiers(1, 2, 5, 10),
  },
  {
    slug: 'unaided',
    name: 'Unaided',
    description: 'Problems solved without taking a single hint.',
    icon: 'shield',
    metric: 'unaidedSolves',
    tiers: tiers(3, 10, 25, 60),
  },
  {
    slug: 'comeback',
    name: 'Comeback',
    description: 'Problems solved after two or more wrong attempts.',
    icon: 'rotate',
    metric: 'comebacks',
    tiers: tiers(1, 5, 15, 30),
  },
  {
    slug: 'honest-journal',
    name: 'Honest Journal',
    description: 'Mistakes written down with the idea that fixes them.',
    icon: 'notebook',
    metric: 'journalEntries',
    tiers: tiers(1, 5, 15, 30),
  },
  {
    slug: 'under-pressure',
    name: 'Under Pressure',
    description: 'Mock contests finished.',
    icon: 'timer',
    metric: 'contestsFinished',
    tiers: tiers(1, 3, 10, 25),
  },
  {
    slug: 'clean-sweep',
    name: 'Clean Sweep',
    description: 'Mock contests with all three problems solved.',
    icon: 'sparkles',
    metric: 'cleanSweeps',
    tiers: tiers(1, 3, 5, 10),
  },
  {
    slug: 'polyglot',
    name: 'Polyglot',
    description: 'Languages with an accepted solution.',
    icon: 'languages',
    metric: 'languagesAccepted',
    // Four languages exist, so there is nothing above Gold to earn.
    tiers: tiers(2, 3, 4),
  },
]
