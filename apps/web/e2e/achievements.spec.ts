import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type Route } from '@playwright/test'
import type { AchievementTier, Badge, TrophyCase, Unlock } from '@guruji/types'
import { STORAGE_STATE } from './paths'

/**
 * Badges in the browser.
 *
 * The trophy case is served from a fixture: which tiers a learner holds is the
 * API's job and is proven against the real database in the API suite. Here the
 * question is only what the screens do with it — the unlock moment queues,
 * acknowledges each one it shows and never replays it; the profile shows every
 * badge with its standing; the dashboard picks the closest ones.
 */
test.describe.configure({ mode: 'serial' })

const TIERS: AchievementTier[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']

function badge(slug: string, name: string, icon: string, thresholds: number[], value: number): Badge {
  const tiers = thresholds.map((threshold, index) => ({
    tier: TIERS[index] as AchievementTier,
    threshold,
    unlockedAt: value >= threshold ? '2026-09-28T10:00:00.000Z' : null,
  }))
  const held = tiers.filter((tier) => tier.unlockedAt !== null).at(-1)
  const next = tiers.find((tier) => tier.unlockedAt === null)
  return {
    slug,
    name,
    description: `The ${name.toLowerCase()} badge.`,
    icon,
    value,
    tier: held?.tier ?? null,
    next: next ? { tier: next.tier, threshold: next.threshold } : null,
    tiers,
  }
}

const BADGES: Badge[] = [
  badge('sharp-first-try', 'Sharp first try', 'zap', [1, 5, 15, 40], 20),
  badge('hard-mode', 'Hard mode', 'skull', [1, 2, 5, 10], 1),
  badge('on-fire', 'On fire', 'flame', [3, 7, 14, 30], 2),
  badge('polyglot', 'Polyglot', 'languages', [2, 3, 4], 4),
  badge('memory-keeper', 'Memory keeper', 'brain', [1, 5, 20, 50], 0),
  badge('explorer', 'Explorer', 'compass', [2, 4, 8, 12], 3),
]

const NEW: Unlock[] = [
  { badge: 'sharp-first-try', tier: 'GOLD' },
  { badge: 'hard-mode', tier: 'BRONZE' },
]

let page: Page
let acknowledged: Unlock[][]

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ storageState: STORAGE_STATE })
  page = await context.newPage()
})

test.afterAll(async () => {
  await page.context().close()
})

async function serve(fresh: Unlock[]) {
  acknowledged = []
  await page.unroute(/\/api\/achievements/)
  await page.route(/\/api\/achievements(\/seen)?$/, async (route: Route) => {
    if (route.request().method() === 'POST') {
      acknowledged.push((route.request().postDataJSON() as { unlocks: Unlock[] }).unlocks)
      return route.fulfill({ status: 204 })
    }
    // Deliberately keeps returning the same `new` list after each
    // acknowledgement: the page must not replay a moment it already showed.
    const body: TrophyCase = { badges: BADGES, new: fresh }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
}

test('achievements - the unlock moment shows each new tier once, and acknowledges it', async () => {
  await serve(NEW)
  await page.goto('/dashboard')

  const moment = page.getByTestId('unlock-moment')
  await expect(moment.getByRole('heading', { name: 'Sharp first try' })).toBeVisible({ timeout: 30_000 })
  await expect(moment.getByText('Gold earned')).toBeVisible()
  await page.screenshot({ path: 'test-results/achievements/unlock.png' })
  // The dialog is only in the page while it is open, so the page-level audit never sees it.
  const audit = await new AxeBuilder({ page }).include('[data-testid="unlock-moment"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(audit.violations.map((violation) => violation.id)).toEqual([])
  await expect(moment.getByRole('button', { name: 'Next badge (1 more)' })).toBeFocused()

  await moment.getByRole('button', { name: 'Next badge (1 more)' }).click()
  await expect(moment.getByRole('heading', { name: 'Hard mode' })).toBeVisible()
  await moment.getByRole('button', { name: 'Keep going' }).click()

  await expect(moment).toBeHidden()
  await expect.poll(() => acknowledged).toEqual([[NEW[0]], [NEW[1]]])
  // The refetch after acknowledging still lists them; they stay dismissed.
  await page.waitForTimeout(1_000)
  await expect(moment).toBeHidden()
})

test('achievements - Escape dismisses the moment like the button does', async () => {
  await serve([NEW[1] as Unlock])
  await page.goto('/dashboard')

  const moment = page.getByTestId('unlock-moment')
  await expect(moment.getByRole('heading', { name: 'Hard mode' })).toBeVisible({ timeout: 30_000 })
  await page.keyboard.press('Escape')

  await expect(moment).toBeHidden()
  await expect.poll(() => acknowledged).toEqual([[NEW[1]]])
})

test('achievements - the dashboard shows the badges closest to their next tier', async () => {
  await serve([])
  await page.goto('/dashboard')

  const nextUp = page.getByTestId('next-up')
  await expect(nextUp).toBeVisible({ timeout: 30_000 })
  // Explorer 3 of 4, On fire 2 of 3, Sharp first try 20 of 40. Polyglot is
  // at its top tier, so it has nothing next.
  const names = nextUp.getByRole('listitem')
  await expect(names).toHaveCount(3)
  await expect(names.nth(0)).toContainText('Explorer')
  await expect(names.nth(0)).toContainText('3 / 4 to Silver')
  await expect(names.nth(1)).toContainText('On fire')
  await expect(nextUp).not.toContainText('Polyglot')
  await expect(page.getByTestId('streak-week').getByRole('listitem')).toHaveCount(7)
  // The shell scrolls inside <main>, so a full-page shot would miss these.
  await nextUp.screenshot({ path: 'test-results/achievements/next-up.png' })
  await page.getByTestId('streak-week').locator('..').screenshot({ path: 'test-results/achievements/streak.png' })
})

test('achievements - the profile shows every badge with its standing', async () => {
  await serve([])
  await page.goto('/profile')

  await expect(page.getByText(`4 of ${BADGES.length} earned`)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('badge-sharp-first-try')).toHaveAttribute('data-tier', 'GOLD')
  await expect(page.getByTestId('badge-sharp-first-try')).toContainText('Gold · 20 / 40 to Platinum')
  await expect(page.getByTestId('badge-polyglot')).toContainText('Gold · top tier')
  await expect(page.getByTestId('badge-memory-keeper')).toHaveAttribute('data-tier', 'LOCKED')
  await expect(page.getByTestId('badge-memory-keeper')).toContainText('0 / 1 to Bronze')
  await page.screenshot({ path: 'test-results/achievements/profile.png', fullPage: true })
})
