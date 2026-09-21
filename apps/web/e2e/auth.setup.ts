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
})
