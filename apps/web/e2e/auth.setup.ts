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
   * Wait for the token to stop moving, then capture it. No reload.
   *
   * The refresh token rotates on every use, and `SessionGate` exchanges it the
   * moment it mounts on the dashboard. Capturing the jar while that request is
   * open saves a token the server has already spent — and replaying a spent
   * token is treated as theft, which revokes the chain and signs the whole
   * suite out on a login page with nothing obviously wrong.
   *
   * This used to reload and wait for a second exchange, which only widened the
   * window: the reload aborts the first exchange *after* the server rotated but
   * *before* the browser stored the replacement. It passed most of the time and
   * failed under load. Letting the network settle once removes the race instead
   * of timing around it, and the heading below proves the session is live.
   */
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible()

  await page.context().storageState({ path: STORAGE_STATE })

  // Close immediately. The refresh token rotates on use, so anything this page
  // does after the state is captured — a dev-server reload, a background
  // refresh — invalidates the cookie that was just written to disk.
  await page.close()
})
