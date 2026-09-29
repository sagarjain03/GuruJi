import { expect, test, type Browser, type Page } from '@playwright/test'
import { STORAGE_STATE } from './paths'

/**
 * Phone and tablet widths. The editor is desktop-first by design, but no page
 * may scroll sideways: a row that is wider than the screen hides its end, and
 * on a phone nobody finds it. The shell scrolls inside <main>, so both the
 * document and <main> are measured.
 *
 * Screenshots land in test-results/responsive for a person to look at; a
 * layout can fit and still be wrong.
 */
const VIEWPORTS = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
]

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

async function overflow(page: Page) {
  return page.evaluate(() => {
    const measure = (element: Element | null) => (element === null ? 0 : element.scrollWidth - element.clientWidth)
    // Name the widest offenders, so a failure says where to look.
    const width = document.documentElement.clientWidth
    const culprits = [...document.querySelectorAll('main *, body > *')]
      .filter((element) => {
        const box = element.getBoundingClientRect()
        return box.width > 0 && box.right > width + 1
      })
      .filter((element) => {
        // Only the outermost: a child of an offender says nothing new, and
        // anything inside a scroller of its own is allowed to be wide.
        for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
          const style = getComputedStyle(parent)
          if (style.overflowX === 'auto' || style.overflowX === 'scroll' || style.overflowX === 'hidden') return false
        }
        return true
      })
      .slice(0, 5)
      .map((element) => `${element.tagName.toLowerCase()}.${String(element.className).split(' ').slice(0, 3).join('.')}`)
    return { document: measure(document.documentElement), main: measure(document.querySelector('main')), culprits }
  })
}

async function check(page: Page, route: string, viewport: (typeof VIEWPORTS)[number]) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height })
  await page.goto(route)
  await expect(page).toHaveURL((url) => url.pathname === route, { timeout: 30_000 })
  // The session gate renders before the page does; measuring it measures nothing.
  await expect(page.getByText('Checking your session')).toHaveCount(0, { timeout: 30_000 })
  await expect(page.locator('[data-slot="skeleton"], .animate-pulse')).toHaveCount(0, { timeout: 30_000 })
  const slug = route === '/' ? 'home' : route.slice(1).replace(/\//g, '-')
  await page.screenshot({ path: `test-results/responsive/${viewport.name}-${slug}.png` })
  // Soft, so one run lists every page that overflows rather than the first.
  expect.soft(await overflow(page), `${route} at ${viewport.width}px`).toEqual({ document: 0, main: 0, culprits: [] })
}

test.describe('responsive - public', () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  for (const viewport of VIEWPORTS) {
    for (const route of PUBLIC) {
      test(`responsive - ${route} fits a ${viewport.name}`, async ({ page }) => {
        await check(page, route, viewport)
      })
    }
  }
})

// One page for the signed-in half: every load rotates the refresh token, and a
// second context from the same saved state would sign the user out.
test.describe('responsive - signed in', () => {
  test.describe.configure({ mode: 'serial' })
  let page: Page

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE })
    page = await context.newPage()
  })

  test.afterAll(async () => {
    await page.context().close()
  })

  for (const viewport of VIEWPORTS) {
    test(`responsive - every signed-in page fits a ${viewport.name}`, async () => {
      test.setTimeout(SIGNED_IN.length * 45_000)
      for (const route of SIGNED_IN) {
        await check(page, route, viewport)
      }
    })
  }
})
