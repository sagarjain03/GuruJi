import { defineConfig, devices } from '@playwright/test'
import { STORAGE_STATE } from './e2e/paths'

const WEB = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

/**
 * Browser tests.
 *
 * These are the only tests in the project that prove a page actually renders.
 * Everything else — unit, API e2e, the build — can pass while the editor shows
 * nothing at all, which is exactly what happened at the end of Phase 3.
 *
 * They expect `pnpm dev` to already be running: the API and the web app are two
 * processes with a database and a Redis behind them, and starting that stack per
 * test run is slower and less reliable than reusing the one on screen.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: WEB,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // One registration for the whole run. Signing up per test trips the API's
    // own rate limiter, which is working correctly when it happens.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
  ],
})
