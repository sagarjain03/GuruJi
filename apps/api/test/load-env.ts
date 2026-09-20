import path from 'node:path'
import Redis from 'ioredis'
import { beforeAll } from 'vitest'

// The suites boot the real application, which reads the same .env the dev server does.
process.loadEnvFile(path.resolve(__dirname, '../../../.env'))
process.env.NODE_ENV = 'test'
// Request logs would bury the assertion output.
process.env.LOG_LEVEL = 'fatal'

/**
 * Clears the auth rate-limit counters before each spec file.
 *
 * Registration is capped at five attempts per IP per fifteen minutes, which is
 * correct for production and far below what a dozen end-to-end files need —
 * every one of them creates its own users, from one address, in under a minute.
 * Without this the later files fail on 429 and the failure looks like a bug in
 * whatever they were actually testing.
 *
 * Only the *counters* are cleared, never the limit itself. The limiter is still
 * exercised directly, by the cases in `auth.e2e-spec.ts` that assert the 429 —
 * so this makes the suite runnable without making it dishonest.
 */
beforeAll(async () => {
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 2,
  })

  try {
    const keys = await redis.keys('rl:*')
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  } catch {
    // Redis being unreachable is a problem the suites themselves will report,
    // with a better message than this file could give.
  } finally {
    await redis.quit()
  }
})
