import { expect, test, type Page } from '@playwright/test'
import { STORAGE_STATE } from './paths'

/**
 * Revision and the progress dashboard, in a real browser.
 *
 * The scheduler and the queue are tested against the database elsewhere. What
 * only a browser can say is whether the numbers reach the screen at all — the
 * failure Phase 3 hit was a page that rendered nothing while every other check
 * passed.
 */
test.describe.configure({ mode: 'serial' })

let page: Page
let errors: string[]

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ storageState: STORAGE_STATE })
  page = await context.newPage()

  errors = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text())
    }
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })
})

test.afterAll(async () => {
  await page.context().close()
})

test('the dashboard renders real mastery, not a placeholder', async () => {
  await page.goto('/dashboard')

  await expect(page.getByRole('heading', { name: 'Mastery' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Revision due' })).toBeVisible()

  // The streak panel says days are counted in UTC, because the server buckets
  // them there — two devices in two time zones have to agree on yesterday.
  await expect(page.getByText(/Days are counted in UTC/)).toBeVisible()
})

test('a mastery bar opens to show why the score is what it is', async () => {
  await page.goto('/dashboard')

  const bars = page.getByRole('button', { expanded: false })
  const count = await bars.count()
  test.skip(count === 0, 'nothing solved yet on this account, so no bars to open')

  await bars.first().click()

  // "Why is my Graphs score 40?" has to have an answer. A score nobody can take
  // apart is indistinguishable from one that was made up.
  await expect(page.getByText('Right first time').first()).toBeVisible()
  await expect(page.getByText('Leaned on hints').first()).toBeVisible()
})

test('the revision page loads its queue and its week', async () => {
  await page.goto('/revision')

  await expect(page.getByRole('heading', { name: 'Revision' })).toBeVisible()
  await expect(page.getByText(/just before you would have forgotten/)).toBeVisible()

  // Either a queue or the empty state — both are correct, and a page that shows
  // neither is the bug worth catching here.
  await expect(
    page.getByText('Nothing due today.').or(page.getByText('Due today')).first(),
  ).toBeVisible()
})

test('the mistake journal loads', async () => {
  await page.goto('/mistakes')

  await expect(page.getByRole('heading', { name: 'Mistake journal' })).toBeVisible()
  await expect(page.getByText(/The value is in what repeats/)).toBeVisible()
})

test('logged nothing to the console along the way', () => {
  expect(errors).toEqual([])
})
