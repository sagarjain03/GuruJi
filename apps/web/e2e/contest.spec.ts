import { expect, test, type Page } from '@playwright/test'
import { STORAGE_STATE } from './paths'

/**
 * A mock contest, in a real browser.
 *
 * The rules — the clock, scoring, the weak-area choice — are tested against the
 * database in the API suite. What only a browser can say is whether a learner
 * can actually get from "start" to "report": the countdown shows, a problem
 * opens in contest mode without the mentor, Submit goes through the contest,
 * a reload resumes the same clock, and finishing lands on a report in words.
 */
test.describe.configure({ mode: 'serial' })

let page: Page
let errors: string[]
let deadline: string | null

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ storageState: STORAGE_STATE })
  page = await context.newPage()

  errors = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
})

test.afterAll(async () => {
  await page.context().close()
})

const countdown = () => page.locator('time[datetime]').first()

test('contest - the rail leads to the start screen', async () => {
  await page.goto('/dashboard')
  await page.getByRole('link', { name: 'Contest' }).first().click()

  await expect(page).toHaveURL(/\/contest$/)
  await expect(page.getByRole('heading', { name: 'Test yourself under time' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Start a contest' })).toBeVisible()
  // Assessment framing: no ranking anywhere on the page.
  await expect(page.getByText(/leaderboard|rank/i)).toHaveCount(0)
})

test('contest - starting shows three problems and a running clock', async () => {
  await page.getByText('60 minutes').click()
  await page.getByRole('button', { name: 'Start contest' }).click()

  await expect(countdown()).toBeVisible()
  await expect(page.getByText('Hints off')).toBeVisible()
  const problems = page.getByRole('list', { name: 'Contest problems' }).getByRole('listitem')
  await expect(problems).toHaveCount(3)
  await expect(problems.first()).toContainText('Not attempted')
  deadline = await countdown().getAttribute('datetime')

  await page.screenshot({ path: 'test-results/contest-active.png', fullPage: true })
})

test('contest - a reload resumes the same contest and the same deadline', async () => {
  await page.reload()

  await expect(countdown()).toBeVisible()
  await expect(countdown()).toHaveAttribute('datetime', deadline ?? '')
})

test('contest - a problem opens in contest mode, without the mentor, and submits through the contest', async () => {
  await page.getByRole('list', { name: 'Contest problems' }).getByRole('link').first().click()

  await expect(page).toHaveURL(/\/problems\/[^?]+\?contest=/)
  await expect(page.getByRole('link', { name: 'Back to contest' })).toBeVisible()
  await expect(page.getByText('Mock contest · hints off')).toBeVisible()
  await expect(countdown()).toHaveAttribute('datetime', deadline ?? '')
  // Hints off: the mentor is not rendered at all.
  await expect(page.getByRole('heading', { name: 'Mentor' })).toHaveCount(0)

  await page.screenshot({ path: 'test-results/contest-editor.png', fullPage: true })

  const submitted = page.waitForResponse(
    (response) => /\/contests\/[^/]+\/submissions$/.test(response.url()) && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Submit' }).click()
  expect((await submitted).status()).toBe(202)
})

test('contest - the contest page shows the attempt, and finishing opens the report', async () => {
  await page.getByRole('link', { name: 'Back to contest' }).click()
  await expect(page).toHaveURL(/\/contest$/)

  const first = page.getByRole('list', { name: 'Contest problems' }).getByRole('listitem').first()
  await expect(first).toContainText(/Attempted|Solved/)

  // Finishing asks for confirmation in a toast, not a native dialog.
  await page.getByRole('button', { name: 'Finish contest' }).click()
  await page.getByRole('button', { name: 'Finish', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Your last contest' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /^Weak area/ })).toBeVisible()
  await expect(page.getByText('You finished early.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start a new contest' })).toBeVisible()

  await page.screenshot({ path: 'test-results/contest-report.png', fullPage: true })
})

test('contest - no console errors along the way', () => {
  expect(errors).toEqual([])
})
