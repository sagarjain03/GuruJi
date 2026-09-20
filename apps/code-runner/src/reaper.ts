import { reapOrphans } from './sandbox/docker'
import type { RunnerEnv } from './config/env'
import type { Logger } from 'pino'

/**
 * Backstop, not the primary mechanism.
 *
 * `runSandboxed` kills by name on every path out, including timeouts and
 * errors. This exists for the one case that cannot: the runner process itself
 * dying between `docker create` and its own `finally`. Anything it finds is a
 * bug somewhere above it, so it logs loudly rather than quietly tidying up.
 */
export function startReaper(env: RunnerEnv, logger: Logger): () => void {
  const timer = setInterval(() => {
    void reapOrphans(env.REAPER_MAX_AGE_MS)
      .then((reaped) => {
        if (reaped > 0) {
          logger.warn({ reaped }, 'reaped orphaned sandbox containers')
        }
      })
      .catch((error: unknown) => {
        logger.error({ error }, 'orphan sweep failed')
      })
  }, env.REAPER_INTERVAL_MS)

  // Without this the interval alone keeps the process alive forever, and a
  // shutdown that never completes looks exactly like a hung worker.
  timer.unref()

  return () => {
    clearInterval(timer)
  }
}
