import { expect, test, type Page } from '@playwright/test'
import { STORAGE_STATE } from './paths'

/**
 * The visualiser, in a real browser.
 *
 * The event streams are unit-tested in `packages/algorithms`. What only a
 * browser can say is whether every structure actually reaches the screen, and
 * whether step-back lands on exactly the state it left.
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

const canvas = () => page.locator('[role="img"][tabindex="0"]')
const counter = () => page.getByText(/^Step \d+ \/ \d+$/)
// Next.js adds its own role="alert" route announcer, so scope to the input's message.
const inputError = () => page.locator('form [role="alert"]')

test('visualizer - loads bubble sort on the array canvas', async () => {
  await page.goto('/visualizer')

  await expect(page.getByRole('heading', { name: 'Bubble Sort' })).toBeVisible()
  await expect(canvas()).toHaveAttribute('aria-label', /^Array: 8, 3, 6, 1, 5, 2, 7, 4\.$/)
  await expect(counter()).toHaveText(/^Step 1 \/ \d+$/)
})

test('visualizer - step back returns exactly to the previous state', async () => {
  const before = await canvas().getAttribute('aria-label')

  await page.getByRole('button', { name: 'Next step' }).click()
  await page.getByRole('button', { name: 'Next step' }).click()
  await expect(counter()).toHaveText(/^Step 3 \//)
  const moved = await canvas().getAttribute('aria-label')
  expect(moved).not.toBe(before)

  await page.getByRole('button', { name: 'Previous step' }).click()
  await page.getByRole('button', { name: 'Previous step' }).click()
  await expect(counter()).toHaveText(/^Step 1 \//)
  await expect(canvas()).toHaveAttribute('aria-label', before ?? '')
})

test('visualizer - keyboard steps and jumps', async () => {
  await canvas().focus()
  await page.keyboard.press('ArrowRight')
  await expect(counter()).toHaveText(/^Step 2 \//)
  await page.keyboard.press('End')
  await expect(page.getByText('The array is sorted.')).toBeVisible()
  await expect(canvas()).toHaveAttribute('aria-label', /^Array: 1 \(done\), 2 \(done\)/)
  await page.keyboard.press('Home')
  await expect(counter()).toHaveText(/^Step 1 \//)
})

test('visualizer - play advances on its own and pause stops it', async () => {
  await page.getByRole('button', { name: 'Play' }).click()
  await expect(counter()).not.toHaveText(/^Step 1 \//, { timeout: 5_000 })
  await page.getByRole('button', { name: 'Pause' }).click()
  const paused = await counter().textContent()
  await page.waitForTimeout(1_500)
  await expect(counter()).toHaveText(paused ?? '')
})

const STRUCTURES = [
  { name: 'Reverse Linked List', label: /^Linked list: 1 → 2 → 3 → 4 → 5 → null\.$/ },
  { name: 'In-order Traversal', label: /^Tree\. 8 \(visited\): left 4, right 12/ },
  { name: "Dijkstra's Shortest Path", label: /^Graph\. Nodes: A \[0\]/ },
  { name: '0/1 Knapsack', label: /^Table with columns 0, 1, 2/ },
]

for (const structure of STRUCTURES) {
  test(`visualizer - ${structure.name} renders its structure`, async () => {
    await page.getByRole('combobox', { name: 'Algorithm' }).selectOption({ label: structure.name })

    await expect(page.getByRole('heading', { name: structure.name })).toBeVisible()
    await expect(canvas()).toHaveAttribute('aria-label', structure.label)
    await canvas().focus()
    await page.keyboard.press('End')
    await expect(page.getByText('DONE', { exact: true })).toBeVisible()

    await page.screenshot({ path: `test-results/visualizer-${structure.name.replace(/\W+/g, '-').toLowerCase()}.png`, fullPage: true })
  })
}

test('visualizer - an over-cap input shows a clear message instead of freezing', async () => {
  await page.getByRole('combobox', { name: 'Algorithm' }).selectOption({ label: 'Bubble Sort' })
  const tooMany = Array.from({ length: 51 }, (_, index) => index).join(', ')
  await page.getByRole('textbox', { name: 'Input' }).fill(tooMany)
  await page.getByRole('button', { name: 'Run' }).click()

  await expect(inputError()).toHaveText('The array is limited to 50 values; got 51.')
  await expect(page.getByRole('button', { name: 'Next step' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Example' }).click()
  await expect(inputError()).toHaveCount(0)
  await expect(canvas()).toHaveAttribute('aria-label', /^Array: /)
})

test('visualizer - no console errors along the way', () => {
  expect(errors).toEqual([])
})
