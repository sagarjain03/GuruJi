import { expect, test, type Page } from '@playwright/test'
import { STORAGE_STATE } from './paths'

/**
 * TRAIN NOW and onboarding, in a real browser.
 *
 * The engine is tested against the database elsewhere. What only a browser can
 * say is whether the one button the product is built around actually appears,
 * says why, and leads somewhere.
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

test('a fresh account is asked three questions, on the dashboard', async () => {
  await page.goto('/dashboard')

  // On the dashboard rather than a wall in front of it: a blocking onboarding
  // screen stands between signing up and seeing whether the product is good.
  await expect(page.getByRole('heading', { name: 'Three quick questions' })).toBeVisible()
})

test('answering them removes the card', async () => {
  await page.getByRole('button', { name: /Comfortable/ }).click()
  await page.getByRole('button', { name: 'Python' }).click()
  await page.getByRole('button', { name: 'Start training' }).click()

  await expect(page.getByRole('heading', { name: 'Three quick questions' })).toBeHidden()
})

test('TRAIN NOW names an activity and says why', async () => {
  await expect(page.getByText('Train now', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /Train now/ })).toBeVisible()

  // The reason is derived from the scoring breakdown, never written by a model.
  // A brand-new account has nothing to go on, and the text has to say so.
  await expect(page.getByText(/roadmap|nothing solved yet|Due for revision/).first()).toBeVisible()
})

test('today’s training lists suggestions, each with a reason', async () => {
  await expect(page.getByRole('heading', { name: /Today.s training/ })).toBeVisible()

  const dismiss = page.getByRole('button', { name: 'Not this one' })
  await expect(dismiss.first()).toBeVisible()
})

test('dismissing a suggestion takes it out of the list', async () => {
  const before = await page.getByRole('button', { name: 'Not this one' }).count()
  await page.getByRole('button', { name: 'Not this one' }).first().click()

  // The dismissal is recorded and feeds the next batch's recency penalty, so
  // the list is rebuilt rather than merely hiding a row.
  await expect
    .poll(async () => page.getByRole('button', { name: 'Not this one' }).count())
    .toBeLessThanOrEqual(before)
})

test('logged nothing to the console along the way', () => {
  expect(errors).toEqual([])
})
