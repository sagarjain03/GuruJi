import { expect, test, type Page } from '@playwright/test'

/**
 * The critical journey, end to end, as a brand-new person meets it:
 *
 *   register → sign out → sign in → onboarding → open a problem → code →
 *   run → submit → result → recommendation → revision
 *
 * Every other browser spec starts from a saved session and checks one page.
 * This one starts from an empty browser and walks the whole road once, so a
 * change anywhere along it — auth, the editor, the judge, the socket, the
 * engines — shows up here even when each page still passes on its own.
 *
 * Needs the whole stack: web, API, code runner, Postgres, Redis and Docker.
 */
test.describe.configure({ mode: 'serial' })
// No saved session: the journey begins signed out.
test.use({ storageState: { cookies: [], origins: [] } })

const PROBLEM_TITLE = 'Pair Sums to Target'
const PASSWORD = 'a-long-enough-password'
const EMAIL = `journey-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`

const SOLUTION = [
  'import sys',
  'data = sys.stdin.read().split()',
  'n, target = int(data[0]), int(data[1])',
  'seen = {}',
  'answer = "-1"',
  'for i in range(n):',
  'v = int(data[2 + i])',
  'if target - v in seen:',
  'answer = f"{seen[target - v] + 1} {i + 1}"',
  'break',
  'seen.setdefault(v, i)',
  'print(answer)',
]

let page: Page
let errors: string[]
/** Every 4xx/5xx the page saw, by URL — a console "Failed to load resource" does not say which. */
let failedRequests: string[]

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  page = await context.newPage()

  errors = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  failedRequests = []
  page.on('response', (response) => {
    if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.request().method()} ${response.url()}`)
  })
})

test.afterAll(async () => {
  await page.context().close()
})

/**
 * Types the solution line by line, pressing Home before each so Monaco's
 * auto-indent after `for:` and `if:` is replaced by the indentation we mean.
 */
async function typeSolution(): Promise<void> {
  const indent: Record<string, number> = {
    'v = int(data[2 + i])': 1,
    'if target - v in seen:': 1,
    'answer = f"{seen[target - v] + 1} {i + 1}"': 2,
    break: 2,
    'seen.setdefault(v, i)': 1,
  }
  await page.locator('.monaco-editor .view-lines').first().click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.press('Delete')
  for (const [index, line] of SOLUTION.entries()) {
    if (index > 0) await page.keyboard.press('Enter')
    // Clear whatever indentation Monaco inserted, then write our own.
    await page.keyboard.press('Shift+Home')
    await page.keyboard.press('Delete')
    await page.keyboard.insertText('    '.repeat(indent[line] ?? 0) + line)
  }
}

test('journey - register a new account', async () => {
  await page.goto('/register')
  await page.getByLabel('Name').fill('Journey Tester')
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 })
})

test('journey - sign out, then sign back in', async () => {
  // The dashboard's session content renders only on the client, after the
  // session is known — so once it shows, the page is hydrated and "Sign out"
  // has its handler. Clicking earlier lands on server HTML and does nothing.
  await expect(page.getByRole('heading', { name: 'Three quick questions' })).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login/)

  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 })
})

test('journey - onboarding asks three questions and goes away', async () => {
  await expect(page.getByRole('heading', { name: 'Three quick questions' })).toBeVisible()
  await page.getByRole('button', { name: /Comfortable/ }).click()
  await page.getByRole('button', { name: 'Python' }).click()
  await page.getByRole('button', { name: 'Start training' }).click()

  await expect(page.getByRole('heading', { name: 'Three quick questions' })).toBeHidden()
})

test('journey - open a problem from the list', async () => {
  await page.goto('/problems')
  await page.getByRole('link', { name: PROBLEM_TITLE }).first().click()

  await expect(page.getByRole('heading', { name: PROBLEM_TITLE })).toBeVisible()
  await expect(page.locator('.monaco-editor .view-lines').first()).toBeVisible({ timeout: 60_000 })
})

test('journey - write code and run it against the samples', async () => {
  await page.getByRole('button', { name: 'Python', exact: true }).click()
  await typeSolution()
  await page.getByRole('button', { name: 'Run' }).click()

  await expect(page.getByText('Accepted', { exact: true }).first()).toBeVisible({ timeout: 120_000 })
  await expect(page.getByText('2 / 2')).toBeVisible()
})

test('journey - submit it and get a verdict on every case', async () => {
  await page.getByRole('button', { name: 'Submit' }).click()

  // Every hidden case, not just the samples.
  await expect(page.getByText('8 / 8')).toBeVisible({ timeout: 120_000 })
  await expect(page.getByText('Every test case passed inside the limits.')).toBeVisible()

  await page.screenshot({ path: 'test-results/journey-result.png', fullPage: true })
})

test('journey - the dashboard counts the solve and recommends what is next', async () => {
  await page.goto('/dashboard')

  const hero = page.locator('section').filter({ has: page.getByRole('heading', { name: /^Welcome,/ }) })
  await expect(hero.getByText('Its pick for you is right below.')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('link', { name: /Train now/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Today.s training/ })).toBeVisible()

  await page.screenshot({ path: 'test-results/journey-dashboard.png', fullPage: true })
})

test('journey - the solved problem is scheduled for revision', async () => {
  await page.goto('/revision')

  await expect(page.getByRole('heading', { name: 'The week ahead' })).toBeVisible({ timeout: 30_000 })
  // A first solve comes back for revision within the week; the calendar is
  // what the learner sees of that schedule.
  const counts = await page.locator('section').filter({ has: page.getByRole('heading', { name: 'The week ahead' }) })
    .locator('ol > li > span:first-child')
    .allTextContents()
  expect(counts.reduce((total, count) => total + Number(count), 0)).toBeGreaterThanOrEqual(1)
})

/**
 * One known, harmless warning is set aside — by its exact text, so anything
 * else still fails.
 *
 * `Providers` (and next-themes inside it) is mounted per route group, in
 * `(app)/layout.tsx` and `(auth)/layout.tsx`, on purpose: the landing page must
 * not load Tailwind. Crossing between the groups client-side — signing out,
 * signing in — mounts a fresh ThemeProvider, whose no-flash inline `<script>`
 * React 19 reports in development. The theme is already applied by then, so
 * nothing visible breaks. Removing it means one shared layout for `(app)` and
 * `(auth)`; until then, only this journey crosses the groups and sees it.
 */
const KNOWN_THEME_SCRIPT_WARNING = 'Encountered a script tag while rendering React component.'

test('journey - no console errors along the whole road', () => {
  expect(
    errors.filter((message) => !message.startsWith(KNOWN_THEME_SCRIPT_WARNING)),
    `failed requests along the way:\n${failedRequests.join('\n')}`,
  ).toEqual([])
})
