/**
 * Shared constants for the browser suite.
 *
 * Separate from `auth.setup.ts` because the Playwright config imports this, and
 * a config that imports a file calling `test()` is refused.
 */
export const STORAGE_STATE = 'e2e/.auth/user.json'
