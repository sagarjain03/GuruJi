import { expect, test as setup } from '@playwright/test'
import { STORAGE_STATE } from './paths'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

/**
 * One account for the whole run.
 *
 * Registering per test is what the API's rate limiter is there to stop — five
 * attempts per IP per fifteen minutes — so a suite that signs up in every
 * `beforeEach` fails on its own sixth test and blames the page.
 */
setup('create an account', async ({ request }) => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`

  const response = await request.post(`${API_URL}/auth/register`, {
    data: {
      email,
      password: 'a-long-enough-password',
      displayName: 'Editor Tester',
    },
  })

  expect(response.status()).toBe(201)
  expect(response.ok()).toBe(true)

  // The request context owns the Set-Cookie response and never mounts the
  // dashboard SessionGate, so no second refresh can spend the rotated token.
  await request.storageState({ path: STORAGE_STATE })

  // Compile every page once, before any spec asserts against it. `next dev`
  // compiles a route on its first request, and a cold route on this host takes
  // longer than a 15s expectation — so a spec's first navigation to a page
  // nobody had opened yet failed on timing, not behaviour. A plain GET renders
  // on the server only: the proxy checks that the cookie exists, and nothing
  // here spends the refresh token.
  setup.setTimeout(APP_ROUTES.length * WARM_TIMEOUT_MS)
  for (const route of APP_ROUTES) {
    const page = await request.get(route, { timeout: WARM_TIMEOUT_MS, maxRedirects: 0 })
    expect(page.status(), `warming ${route}`).toBe(200)
  }
})

/** Every signed-in page. A new page added under `src/app/(app)` belongs here. */
const APP_ROUTES = [
  '/dashboard',
  '/roadmap',
  '/problems',
  '/revision',
  '/mistakes',
  '/visualizer',
  '/analytics',
  '/profile',
]

const WARM_TIMEOUT_MS = 180_000
