import { expect, test, type Page } from '@playwright/test'
import { STORAGE_STATE } from './paths'

const PROBLEM = 'pair-sums-to-target'

/**
 * The mentor's answers open in a floating window.
 *
 * What only a browser can say: the answers no longer push the workspace into a
 * page scroll, the window can be dragged by its header, each answer keeps its
 * own tab and is drawn rather than only written, the keyboard reaches all of
 * it — from inside Monaco too — and Escape closes it. The AI endpoints are
 * stubbed: this is about the window, not the model.
 */
test.describe.configure({ mode: 'serial' })

let page: Page

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ storageState: STORAGE_STATE })
  page = await context.newPage()
  await page.route('**/ai/hint', (route) =>
    route.fulfill({ json: { hint: 'Think about what the smallest of the top k looks like.', level: 1, curated: false } }),
  )
  await page.route('**/ai/explain', (route) =>
    route.fulfill({
      json: {
        intuition: 'Sort, then index.',
        example: 'Sorting them descending gives 9, 9, 5, 4, 4, 2, 1. The 3rd element is 5.',
        implementation: 'Read every value. Keep a min-heap of size k. Print its top.',
        complexity: 'O(n log k) time and O(k) space.',
        commonMistakes: ['Off by one on k.', 'Dropping duplicates.'],
      },
    }),
  )
  await page.route('**/ai/analyze-code', (route) =>
    route.fulfill({
      json: {
        correctness: 'incorrect',
        issues: [{ severity: 'error', description: 'Nothing is read from input.' }],
        timeComplexity: 'O(1)',
        spaceComplexity: 'O(1)',
        suggestions: ['Read n and k. Push into a heap.'],
        concepts: [],
      },
    }),
  )
  await page.goto(`/problems/${PROBLEM}`)
  // The first visit can wait on `next dev` compiling the route.
  await expect(page.getByRole('heading', { name: 'Mentor' })).toBeVisible({ timeout: 45_000 })
})

test.afterAll(async () => {
  await page.context().close()
})

const mentorWindow = () => page.getByRole('dialog', { name: 'Mentor answers' })

test('mentor - a hint opens in a floating window without scrolling the page', async () => {
  await page.getByRole('button', { name: 'Get hint' }).click()
  await expect(mentorWindow()).toBeVisible()
  await expect(mentorWindow().getByText('smallest of the top k')).toBeVisible()
  await expect(mentorWindow().getByRole('img', { name: 'Hint 1 of 4' })).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('mentor - a second answer gets its own tab and is drawn, the first stays', async () => {
  await page.getByRole('button', { name: 'Explain concept' }).click()
  await expect(mentorWindow().getByRole('tab', { name: 'Concept' })).toHaveAttribute('aria-selected', 'true')
  // The run of numbers is an array, the big-O sits on the scale, the steps are a list.
  await expect(mentorWindow().getByRole('img', { name: '9, 9, 5, 4, 4, 2, 1' })).toBeVisible()
  await expect(mentorWindow().getByRole('img', { name: 'Complexity: O(n log n)' })).toBeVisible()
  await expect(mentorWindow().getByText('Keep a min-heap of size k.')).toBeVisible()
  await expect(mentorWindow().getByText('Dropping duplicates.')).toBeVisible()

  await mentorWindow().getByRole('tab', { name: 'Hints' }).click()
  await expect(mentorWindow().getByText('smallest of the top k')).toBeVisible()
})

test('mentor - the window drags by its header', async () => {
  const before = await mentorWindow().boundingBox()
  const handle = mentorWindow().getByLabel('Move the mentor window with the arrow keys')
  const grip = await handle.boundingBox()
  if (!before || !grip) throw new Error('mentor window has no box')

  // Grab the empty middle of the header, away from the tabs and the buttons.
  const startX = grip.x + grip.width / 2
  const startY = grip.y + grip.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX - 200, startY + 120, { steps: 8 })
  await page.mouse.up()

  const after = await mentorWindow().boundingBox()
  expect(after?.x).toBeCloseTo(before.x - 200, -1)
  expect(after?.y).toBeCloseTo(before.y + 120, -1)
})

test('mentor - maximize fills the screen, restore puts it back', async () => {
  const before = await mentorWindow().boundingBox()
  await mentorWindow().getByRole('button', { name: 'Maximize the mentor window' }).click()
  const viewport = page.viewportSize()
  const big = await mentorWindow().boundingBox()
  expect(big?.width).toBeGreaterThan((viewport?.width ?? 0) - 40)

  await mentorWindow().getByRole('button', { name: 'Restore the mentor window' }).click()
  const after = await mentorWindow().boundingBox()
  expect(after?.x).toBeCloseTo(before?.x ?? 0, -1)
})

test('mentor - Escape closes the window and the answers can be reopened', async () => {
  await mentorWindow().getByRole('tab', { name: 'Hints' }).focus()
  await page.keyboard.press('Escape')
  await expect(mentorWindow()).toHaveCount(0)

  await page.getByRole('button', { name: /Open answers \(2\)/ }).click()
  await expect(mentorWindow()).toBeVisible()
})

test('mentor - shortcuts work from inside the editor', async () => {
  // The open window sits over the editor at this width; focus Monaco directly.
  await page.locator('.monaco-editor textarea').focus()

  await page.keyboard.press('Alt+0')
  await expect(mentorWindow()).toHaveCount(0)
  await page.keyboard.press('Alt+0')
  await expect(mentorWindow()).toBeVisible()

  // The open window sits over the editor at this width; focus Monaco directly.
  await page.locator('.monaco-editor textarea').focus()
  await page.keyboard.press('Alt+3')
  await expect(mentorWindow().getByRole('tab', { name: 'Analysis' })).toHaveAttribute('aria-selected', 'true')
  await expect(mentorWindow().getByText('Nothing is read from input.')).toBeVisible()

  // The solution never comes from one keystroke: Alt+4 asks first, in the window.
  await page.keyboard.press('Alt+4')
  await expect(mentorWindow().getByRole('button', { name: 'Reveal solution' })).toBeFocused()
  await mentorWindow().getByRole('button', { name: 'Keep trying' }).click()
  await expect(mentorWindow().getByRole('tab', { name: 'Solution' })).toHaveCount(0)
})
