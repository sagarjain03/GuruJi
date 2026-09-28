import { expect, test, type Page } from '@playwright/test'
import { STORAGE_STATE } from './paths'

/**
 * Error states, forced.
 *
 * An error state is the one screen nobody sees in normal use, so it is the one
 * most likely to be wrong — the classic bug is a failed request rendered as an
 * empty list ("nothing logged yet"), which reads as data loss. Here the API is
 * made to fail on purpose, one endpoint at a time, and each page must say so
 * and offer a retry; the retry must then recover once the API is back.
 */
test.describe.configure({ mode: 'serial' })

let page: Page

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ storageState: STORAGE_STATE })
  page = await context.newPage()
})

test.afterAll(async () => {
  await page.context().close()
})

/** Fails matching API calls with a 500 until the returned function is called. */
async function breakApi(pattern: RegExp): Promise<() => Promise<void>> {
  const handler = (route: import('@playwright/test').Route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', details: null, requestId: 'test' } }),
    })
  await page.route(pattern, handler)
  return () => page.unroute(pattern, handler)
}

test('states - the mistake journal says it failed, not that it is empty', async () => {
  const restore = await breakApi(/\/api\/mistakes(\?|$)/)
  await page.goto('/mistakes')

  await expect(page.getByText('Could not load the journal.')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/Nothing logged yet/)).toHaveCount(0)

  await restore()
  await page.getByRole('button', { name: 'Try again' }).first().click()
  await expect(page.getByText('Could not load the journal.')).toHaveCount(0)
})

test('states - the revision queue offers a retry when it cannot load', async () => {
  const restore = await breakApi(/\/api\/revision\/due/)
  await page.goto('/revision')

  await expect(page.getByText('Could not load the queue.')).toBeVisible({ timeout: 30_000 })

  await restore()
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('Could not load the queue.')).toHaveCount(0)
})

test('states - the dashboard says its numbers are not real when progress fails', async () => {
  const restore = await breakApi(/\/api\/(analytics\/overview|recommendations)/)
  await page.goto('/dashboard')

  await expect(page.getByText(/Could not load your progress/)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Could not decide right now')).toBeVisible()
  await expect(page.getByText("Could not load today's suggestions.")).toBeVisible()
  // The topics panel must not claim the learner has done nothing, and the hero
  // must not show a "…" that promises the numbers are still on their way.
  await expect(page.getByText(/Nothing submitted yet/)).toHaveCount(0)
  const hero = page.locator('section').filter({ has: page.getByRole('heading', { name: /^Welcome,/ }) })
  await expect(hero.getByText('…')).toHaveCount(0)

  await page.screenshot({ path: 'test-results/states-dashboard-error.png', fullPage: true })
  await restore()
})
