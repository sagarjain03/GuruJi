import { expect, test, type Page } from '@playwright/test'
import { STORAGE_STATE } from './paths'

const PROBLEM = 'pair-sums-to-target'

/**
 * The dry-run board beside the editor.
 *
 * What only a browser can say: the board opens over the editor with the sample
 * case in view, its data structures can be placed and worked by hand, a pen
 * stroke lands on the canvas, and all of it is still there after a reload.
 */
test.describe.configure({ mode: 'serial' })

let page: Page
let errors: string[]

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

const board = () => page.getByRole('dialog', { name: 'Board' })
const block = (kind: string) => board().locator(`[data-block-kind="${kind}"]`)

async function openBoard(): Promise<void> {
  await page.getByRole('button', { name: 'Board' }).click()
  await expect(board()).toBeVisible()
}

test('board - opens from the editor with the sample case on top', async () => {
  await page.goto(`/problems/${PROBLEM}`)
  await expect(page.locator('.monaco-editor .view-lines').first()).toBeVisible({ timeout: 30_000 })
  // A clean board for this run; earlier runs may have left one behind.
  await page.evaluate((slug) => {
    localStorage.removeItem(`guruji:board:${slug}`)
  }, PROBLEM)

  await openBoard()
  await expect(board().getByRole('tab', { name: 'Example 1' })).toHaveAttribute('aria-selected', 'true')
  await expect(board().getByTestId('board-case-input')).toContainText('5 9')
  await expect(board().getByTestId('board-case-output')).toContainText('1 2')

  await board().getByRole('tab', { name: 'Example 2' }).click()
  await expect(board().getByTestId('board-case-output')).toContainText('-1')
})

test('board - an array can be placed and filled in, with a pointer', async () => {
  await board().getByRole('button', { name: 'Add Array' }).click()
  await expect(block('array')).toHaveCount(1)

  const first = block('array').getByRole('textbox', { name: 'Cell 0' })
  await first.fill('7')
  await expect(first).toHaveValue('7')

  await block('array').getByRole('button', { name: 'Index 0' }).click()
  await expect(block('array').getByRole('button', { name: 'Index 0' })).toContainText('i')
})

test('board - a stack pushes and pops from the top', async () => {
  await board().getByRole('button', { name: 'Add Stack' }).click()
  const stack = block('stack')
  await stack.getByRole('textbox', { name: 'Value to push' }).fill('3')
  await stack.getByRole('button', { name: 'Push' }).click()
  await stack.getByRole('textbox', { name: 'Value to push' }).fill('8')
  await stack.getByRole('button', { name: 'Push' }).click()
  await expect(stack.getByTestId('stack-top')).toHaveText('8')

  await stack.getByRole('button', { name: 'Pop' }).click()
  await expect(stack.getByTestId('stack-top')).toHaveText('3')
})

test('board - a tree is drawn from level order', async () => {
  await board().getByRole('button', { name: 'Add Tree' }).click()
  await block('tree').getByRole('textbox', { name: 'Level order' }).fill('1,2,3,null,5')
  await expect(block('tree').locator('[data-tree-node]')).toHaveCount(4)
})

test('board - the pen draws a stroke and undo takes it back', async () => {
  await board().getByRole('button', { name: 'Pen (P)' }).click()
  const canvas = board().getByTestId('board-canvas')
  const box = await canvas.boundingBox()
  if (box === null) throw new Error('no canvas')
  await page.mouse.move(box.x + box.width - 200, box.y + box.height - 200)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 150, box.y + box.height - 160, { steps: 5 })
  await page.mouse.move(box.x + box.width - 100, box.y + box.height - 180, { steps: 5 })
  await page.mouse.up()
  await expect(board().locator('[data-stroke]')).toHaveCount(1)

  await board().getByRole('button', { name: 'Undo (Ctrl+Z)' }).click()
  await expect(board().locator('[data-stroke]')).toHaveCount(0)
  await board().getByRole('button', { name: 'Redo (Ctrl+Shift+Z)' }).click()
  await expect(board().locator('[data-stroke]')).toHaveCount(1)
})

test('board - Escape closes it, and everything is still there after a reload', async () => {
  await page.keyboard.press('Escape')
  await expect(board()).toBeHidden()

  await page.reload()
  await expect(page.locator('.monaco-editor .view-lines').first()).toBeVisible({ timeout: 30_000 })
  await openBoard()
  await expect(block('array').getByRole('textbox', { name: 'Cell 0' })).toHaveValue('7')
  await expect(block('stack').getByTestId('stack-top')).toHaveText('3')
  await expect(block('tree').locator('[data-tree-node]')).toHaveCount(4)
  await expect(board().locator('[data-stroke]')).toHaveCount(1)
})

test('board - no console errors along the way', () => {
  expect(errors).toEqual([])
})
