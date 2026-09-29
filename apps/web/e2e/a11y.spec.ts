import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Browser, type Page } from '@playwright/test'
import { STORAGE_STATE } from './paths'

/**
 * Accessibility, measured rather than promised.
 *
 * axe checks every page against WCAG 2.1 A and AA: contrast, names on
 * controls, landmarks, heading order, ARIA that means what it says. It cannot
 * judge whether a page makes sense to a screen reader user — the keyboard
 * tests below cover the paths that matter most — but it does catch the
 * regressions that creep in one component at a time.
 */
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

const PUBLIC = ['/', '/login', '/register']
const SIGNED_IN = [
  '/dashboard',
  '/roadmap',
  '/problems',
  '/problems/pair-sums-to-target',
  '/revision',
  '/mistakes',
  '/visualizer',
  '/analytics',
  '/profile',
  '/contest',
]

async function audit(page: Page, route: string) {
  await page.goto(route)
  // A lost session lands on /login, whose audit would pass for the wrong page.
  await expect(page).toHaveURL((url) => url.pathname === route, { timeout: 30_000 })
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {
    // A socket keeps the network busy on some pages; the audit still runs.
  })
  // The session gate renders before the page does; measuring it measures nothing.
  await expect(page.getByText('Checking your session')).toHaveCount(0, { timeout: 30_000 })
  // Skeletons are replaced by content; audit what a person actually reads.
  await expect(page.locator('[data-slot="skeleton"], .animate-pulse')).toHaveCount(0, { timeout: 30_000 })
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze()
  const summary = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help}\n` +
      violation.nodes
        .slice(0, 5)
        .map((node) => `    ${node.target.join(' ')} — ${node.failureSummary?.split('\n')[1]?.trim() ?? ''}`)
        .join('\n'),
  )
  expect(summary, `axe violations on ${route}`).toEqual([])
}

test.describe('a11y - public pages', () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  for (const route of PUBLIC) {
    test(`a11y - ${route} has no WCAG A/AA violations`, async ({ page }) => {
      // A cold marketing page on this host can take most of a minute to settle.
      test.setTimeout(120_000)
      await audit(page, route)
    })
  }
})

/*
 * Signed in, everything shares one page. Every load of the app spends the
 * refresh token and receives a new one; a second context started from the same
 * saved state would present the spent token, which the server treats as theft
 * and answers by signing the user out everywhere.
 */
test.describe('a11y - signed in', () => {
  test.describe.configure({ mode: 'serial' })
  let page: Page

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE })
    page = await context.newPage()
  })

  test.afterAll(async () => {
    await page.context().close()
  })

  for (const route of SIGNED_IN) {
    test(`a11y - ${route} has no WCAG A/AA violations`, async () => {
      await audit(page, route)
    })
  }

  test('a11y - the first Tab offers a skip link that jumps past the navigation', async () => {
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 })

    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Skip to content' })
    await expect(skip).toBeFocused()
    await expect(skip).toBeInViewport()

    await page.keyboard.press('Enter')
    await page.keyboard.press('Tab')
    // The next stop is inside the page, not the icon rail it skipped.
    expect(await page.evaluate(() => document.activeElement?.closest('main')?.id ?? null)).toBe('content')
  })

  for (const route of ['/dashboard', '/problems', '/profile']) {
    test(`a11y - every keyboard stop on ${route} shows where focus is`, async () => {
      await page.goto(route)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 })

      const invisible: string[] = []
      for (let stop = 0; stop < 30; stop += 1) {
        await page.keyboard.press('Tab')
        const focus = await page.evaluate(() => {
          const element = document.activeElement as HTMLElement | null
          // The dev-only Next.js overlay is not part of the product.
          if (element === null || element === document.body || element.tagName === 'NEXTJS-PORTAL') return null
          const focused = getComputedStyle(element)
          const ring = focused.outlineStyle !== 'none' && parseFloat(focused.outlineWidth) > 0
          const shadow = focused.boxShadow !== 'none'
          // A border or background that changes on focus counts too: compare
          // against a clone that has never been focused.
          const twin = element.cloneNode(false) as HTMLElement
          twin.style.position = 'absolute'
          twin.style.visibility = 'hidden'
          element.parentElement?.appendChild(twin)
          const resting = getComputedStyle(twin)
          const changed = resting.borderColor !== focused.borderColor || resting.backgroundColor !== focused.backgroundColor
          twin.remove()
          const label = element.getAttribute('aria-label') ?? element.getAttribute('name') ?? element.textContent ?? ''
          return { visible: ring || shadow || changed, label: `${element.tagName.toLowerCase()} "${label.trim().slice(0, 40)}"` }
        })
        if (focus !== null && !focus.visible) invisible.push(focus.label)
      }
      expect([...new Set(invisible)], 'focused elements with no visible focus indicator').toEqual([])
    })
  }
})
