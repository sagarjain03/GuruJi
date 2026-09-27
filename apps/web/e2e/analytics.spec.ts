import { expect, test, type Page } from '@playwright/test'
import { STORAGE_STATE } from './paths'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

/**
 * Analytics and the profile, in a real browser.
 *
 * The ranges, buckets and bounds are tested against the database in the API
 * suite. What only a browser can say is whether each chart reaches the screen,
 * and whether each empty state says something rather than drawing blank axes.
 */
test.describe.configure({ mode: 'serial' })

let page: Page
let errors: string[]

test.beforeAll(async ({ browser }) => {
  // A real judge run happens below: container start-up on this host alone can take tens of seconds.
  test.setTimeout(180_000)
  const context = await browser.newContext({ storageState: STORAGE_STATE })
  page = await context.newPage()

  errors = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  // Give the fresh account something to chart. The refresh goes through the
  // page's own cookie jar, so the rotated token is the one the app uses next.
  const session = await page.request.post(`${API_URL}/auth/refresh`)
  expect(session.status()).toBe(200)
  const { accessToken } = (await session.json()) as { accessToken: string }
  const problems = await page.request.get(`${API_URL}/problems?limit=1`)
  const { items } = (await problems.json()) as { items: { id: string }[] }
  const problemId = items[0]?.id ?? ''

  for (const category of ['OFF_BY_ONE', 'OFF_BY_ONE', 'EDGE_CASE']) {
    const logged = await page.request.post(`${API_URL}/mistakes`, {
      headers: { authorization: `Bearer ${accessToken}` },
      data: { problemId, category, whatWentWrong: 'Written by the analytics browser test.' },
    })
    expect(logged.status()).toBe(201)
  }

  // One real graded submission, judged by the real runner, so the heatmap and
  // the trend lines have a point to draw. It fails on purpose, and fast: a
  // wrong answer that loops or waits on stdin would sit out the time limit on
  // every case, which made this hook slower than its own timeout.
  const submitted = await page.request.post(`${API_URL}/submissions`, {
    headers: { authorization: `Bearer ${accessToken}` },
    data: { problemId, language: 'PYTHON', code: 'raise SystemExit(1)\n', isRun: false, timeSpentMs: 90_000 },
  })
  expect(submitted.status()).toBe(202)
  const { id } = (await submitted.json()) as { id: string }
  await expect
    .poll(
      async () => {
        const detail = await page.request.get(`${API_URL}/submissions/${id}`, {
          headers: { authorization: `Bearer ${accessToken}` },
        })
        return ((await detail.json()) as { status: string }).status
      },
      { timeout: 150_000, intervals: [1_000] },
    )
    .toBe('COMPLETED')
})

test.afterAll(async () => {
  await page.context().close()
})

test('analytics - the rail links to a working page', async () => {
  await page.goto('/dashboard')
  await page.getByRole('link', { name: 'Analytics' }).first().click()

  await expect(page).toHaveURL(/\/analytics$/)
  await expect(page.getByRole('heading', { name: 'Your progress, measured' })).toBeVisible()
})

test('analytics - the heatmap marks today as attempted', async () => {
  const today = new Date().toISOString().slice(0, 10)
  const heatmap = page.getByRole('img', { name: /^1 active day and 0 solves between / })

  await expect(heatmap).toBeVisible()
  // Level 1 is "attempted, none solved" — shown by the legend in words, not just a shade.
  await expect(heatmap.locator(`rect[data-date="${today}"]`)).toHaveAttribute('data-level', '1')
  await expect(page.getByText('attempted, none solved')).toBeVisible()
})

test('analytics - trends and difficulty chart the one graded submission', async () => {
  const accuracy = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Accuracy', exact: true }) })
  // One week of data is one point: a dot, not a line segment.
  await expect(accuracy.locator('.recharts-line-dots circle').first()).toBeVisible()
  await accuracy.getByText('Show data').click()
  await expect(accuracy.getByRole('row', { name: /0%\s+0 \/ 1/ })).toBeVisible()

  // Nothing accepted, so the solve-time chart says so rather than drawing a flat line.
  await expect(page.getByText('No accepted submissions in this range.')).toBeVisible()

  const difficulty = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Difficulty' }) })
  await expect(difficulty.locator('.recharts-surface').first()).toBeVisible()
})

test('analytics - the mistakes chart draws the journal, with its numbers as a table', async () => {
  const panel = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Mistakes by category' }) })

  await expect(panel.locator('.recharts-surface').first()).toBeVisible()
  await panel.getByText('Show data').click()
  await expect(panel.getByRole('row', { name: /Off by one\s+2/ })).toBeVisible()
  await expect(panel.getByRole('row', { name: /Edge case\s+1/ })).toBeVisible()

  await page.screenshot({ path: 'test-results/analytics-page.png', fullPage: true })
})

test('analytics - the trend range switches without losing the page', async () => {
  const wide = page.getByRole('button', { name: '52w' })
  await wide.click()

  await expect(wide).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: '12w' })).toHaveAttribute('aria-pressed', 'false')
  // A year still holds today's submission.
  await expect(page.getByText('No graded submissions in this range.')).toHaveCount(0)
})

test('profile - reachable from the header, with the account and its numbers', async () => {
  // The header name, not the rail avatar: it is the only route to the profile on a phone.
  await page.getByRole('link', { name: 'Editor Tester', exact: true }).click()

  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByRole('heading', { name: 'Editor Tester', level: 1 })).toBeVisible()
  await expect(page.getByText(/@example\.com · joined /)).toBeVisible()
  await expect(page.getByText('Solved', { exact: true })).toBeVisible()
  await expect(page.getByText('Preferred language')).toBeVisible()

  await page.screenshot({ path: 'test-results/profile-page.png', fullPage: true })

  await page.getByRole('link', { name: 'See full analytics' }).click()
  await expect(page).toHaveURL(/\/analytics$/)
})

test('analytics - no console errors along the way', () => {
  expect(errors).toEqual([])
})
