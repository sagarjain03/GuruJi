import { expect, test, type Page } from '@playwright/test'
import { STORAGE_STATE } from './paths'

const PROBLEM = 'pair-sums-to-target'

/**
 * One browser context for the whole file, and the tests run in order.
 *
 * Not a style choice. The refresh token **rotates** on every use, and presenting
 * a rotated one is treated as theft — it revokes the whole chain. A fresh
 * context per test replays the same saved cookie, so the second test would sign
 * itself out and every test after it would fail on a login page. That is the
 * Phase 1 reuse detection doing exactly its job.
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

/** The Monaco text area. Waiting for this is waiting for the editor to paint. */
function editor() {
  return page.locator('.monaco-editor .view-lines').first()
}

async function openProblem(): Promise<void> {
  await page.goto(`/problems/${PROBLEM}`)
  await expect(editor()).toBeVisible()
}

async function typeInEditor(text: string): Promise<void> {
  await editor().click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.type(text)
}

test.describe('code editor', () => {
  test('Monaco renders, with no CSP violation and no page error', async () => {
    await openProblem()

    // The starter code arrives from the problem, so the editor is not empty.
    await expect(page.locator('.monaco-editor')).toContainText('TODO')

    const blocked = errors.filter((text) => /Content Security Policy|CSP/i.test(text))
    expect(blocked, `CSP blocked something: ${blocked.join(' | ')}`).toEqual([])
    expect(errors, `page errors: ${errors.join(' | ')}`).toEqual([])
  })

  test('loads Monaco from our own origin, never a CDN', async () => {
    const external: string[] = []
    const watch = (request: { url: () => string }): void => {
      const { hostname } = new URL(request.url())
      if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        external.push(request.url())
      }
    }

    page.on('request', watch)
    await page.reload()
    await expect(editor()).toBeVisible()
    page.off('request', watch)

    expect(external, `requests left our origin: ${external.join(' | ')}`).toEqual([])
  })

  test('the statement sits beside the editor, and the split resizes from the keyboard', async () => {
    await openProblem()
    await expect(page.getByRole('heading', { name: 'Pair Sums to Target' })).toBeVisible()

    const statement = page.locator('div[style*="flex-basis"]').first()
    const before = (await statement.boundingBox())?.width ?? 0

    // A handle only reachable with a pointer is a handle some people cannot use.
    await page.getByRole('separator', { name: 'Resize the statement panel' }).focus()
    for (let i = 0; i < 5; i += 1) {
      await page.keyboard.press('ArrowRight')
    }

    const after = (await statement.boundingBox())?.width ?? 0
    expect(after).toBeGreaterThan(before)
  })

  test('the exit criterion: type, switch language, reload, the code is still there', async () => {
    await openProblem()

    // Exactly "saved" — `/saved/i` also matches "unsaved", so the loose version
    // of this assertion passes before anything has been written at all.
    await typeInEditor('int cpp_marker = 1;')
    await expect(page.getByRole('status')).toHaveText('saved')

    await page.getByRole('button', { name: 'Python', exact: true }).click()
    await typeInEditor('python_marker = 2')
    await expect(page.getByRole('status')).toHaveText('saved')

    // Back to C++ — the other language must not have been overwritten.
    await page.getByRole('button', { name: 'C++', exact: true }).click()
    await expect(page.locator('.monaco-editor')).toContainText('cpp_marker')

    // The whole point of the phase.
    await page.reload()
    await expect(editor()).toBeVisible()
    await expect(page.locator('.monaco-editor')).toContainText('cpp_marker')

    await page.getByRole('button', { name: 'Python', exact: true }).click()
    await expect(page.locator('.monaco-editor')).toContainText('python_marker')
  })

  test('the test panel shows samples and takes custom input', async () => {
    await openProblem()

    await expect(page.getByRole('button', { name: /Samples \(2\)/ })).toBeVisible()
    await page.getByRole('button', { name: 'Custom input' }).click()

    const box = page.getByLabel('Your own input')
    await box.fill('5 9\n2 7 11 15 3')
    await expect(box).toHaveValue('5 9\n2 7 11 15 3')
  })

  // Last, because it changes a preference the other tests read as a default.
  test('editor preferences survive a reload', async () => {
    await openProblem()

    await expect(page.getByText('14px')).toBeVisible()
    await page.getByRole('button', { name: 'Larger font' }).click()
    await page.getByRole('button', { name: 'Larger font' }).click()
    await expect(page.getByText('16px')).toBeVisible()

    await page.reload()
    await expect(editor()).toBeVisible()
    await expect(page.getByText('16px')).toBeVisible()
  })
})
