import { expect, test, type Page } from '@playwright/test'
import { STORAGE_STATE } from './paths'

const PROBLEM = 'pair-sums-to-target'

/**
 * Run and Submit, in a real browser, against the real runner.
 *
 * Everything below the API is exercised by the adversarial suite in
 * `apps/code-runner`. What this file proves is the part nothing else can: that
 * pressing the button produces a verdict on screen, over the WebSocket, without
 * a reload.
 *
 * Needs the API, the code runner and Docker all running. It is slow by nature —
 * a container start is a container start — so the timeouts are generous.
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

async function openProblem(): Promise<void> {
  await page.goto(`/problems/${PROBLEM}`)
  await expect(page.locator('.monaco-editor .view-lines').first()).toBeVisible({ timeout: 30_000 })
}

/** Replaces whatever is in the editor with `code`. */
async function typeSolution(code: string): Promise<void> {
  await page.locator('.monaco-editor .view-lines').first().click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.press('Delete')
  // Monaco auto-closes brackets, so pasting through the clipboard would fight
  // the editor. Typing with `delay: 0` is slower but produces exactly the text.
  await page.keyboard.insertText(code)
}

test('switches to Python and runs the samples', async () => {
  await openProblem()

  await page.getByRole('button', { name: 'Python' }).click()
  await typeSolution(
    [
      'n = int(input())',
      'nums = list(map(int, input().split()))',
      'target = int(input())',
      'seen = {}',
      'for i, value in enumerate(nums):',
      '    if target - value in seen:',
      '        print(seen[target - value], i)',
      '        break',
      '    seen[value] = i',
    ].join('\n'),
  )

  await page.getByRole('button', { name: 'Run' }).click()

  // The Result tab opens on the click, not when the verdict lands — a spinner
  // the user cannot see is the same as no feedback at all.
  await expect(page.getByRole('button', { name: 'Result' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  // Deliberately not asserting on `role="status"` here. The autosave indicator
  // carries one too, so the locator matches two elements — and by the time it
  // is evaluated the verdict may already have replaced the queued message
  // anyway. The tab state above is the claim: the panel opens on the click, not
  // when the answer turns up.

  // The verdict arrives over the socket. No reload, no navigation.
  await expect(page.getByText(/Accepted|Wrong answer|Runtime error/)).toBeVisible({
    timeout: 90_000,
  })
})

test('reports a wrong answer as a wrong answer, with the sample that failed', async () => {
  await openProblem()

  await page.getByRole('button', { name: 'Python' }).click()
  await typeSolution('print("definitely not the answer")')

  await page.getByRole('button', { name: 'Run' }).click()

  await expect(page.getByText('Wrong answer')).toBeVisible({ timeout: 90_000 })
  // A failing *sample* shows its input, what was expected and what came back.
  // A hidden case never does. `.first()` because every failing sample gets its
  // own panel, and a wrong answer usually fails more than one.
  await expect(page.getByText('Got', { exact: true }).first()).toBeVisible()
})

test('reports a compile error with the compiler output', async () => {
  await openProblem()

  await page.getByRole('button', { name: 'C++' }).click()
  await typeSolution('int main() { this is not c++ }')

  await page.getByRole('button', { name: 'Run' }).click()

  await expect(page.getByText('Compile error')).toBeVisible({ timeout: 120_000 })
  await expect(page.getByText('Compiler output').first()).toBeVisible()
})

test('logged nothing to the console along the way', () => {
  expect(errors).toEqual([])
})
