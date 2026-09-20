import { expect, test as setup } from '@playwright/test'
import { STORAGE_STATE } from './paths'

/**
 * One account for the whole run.
 *
 * Registering per test is what the API's rate limiter is there to stop — five
 * attempts per IP per fifteen minutes — so a suite that signs up in every
 * `beforeEach` fails on its own sixth test and blames the page.
 */
setup('create an account', async ({ page }) => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`

  await page.goto('/register')
  await page.getByLabel('Name').fill('Editor Tester')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('a-long-enough-password')
  await page.getByRole('button', { name: 'Create account' }).click()

  await page.waitForURL('**/dashboard')

  /**
   * Reload, and wait for the refresh call to *finish* before capturing state.
   *
   * The refresh token rotates on every use. `SessionGate` exchanges it on mount,
   * so capturing the cookie jar while that request is in flight saves the token
   * the server has already consumed — and replaying a consumed token is treated
   * as theft, which revokes the chain and signs the whole suite out. Waiting for
   * the response means the jar holds the new, unused cookie.
   */
  const refreshed = page.waitForResponse(
    (response) => response.url().includes('/auth/refresh') && response.status() === 200,
  )
  await page.reload()
  await refreshed
  await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible()

  await page.context().storageState({ path: STORAGE_STATE })

  // Close immediately. The refresh token rotates on use, so anything this page
  // does after the state is captured — a dev-server reload, a background
  // refresh — invalidates the cookie that was just written to disk.
  await page.close()
})
