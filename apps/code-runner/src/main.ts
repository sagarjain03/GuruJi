import path from 'node:path'
import { pino } from 'pino'
import { loadEnv } from './config/env'
import { startReaper } from './reaper'
import { startWorker } from './worker'

// One .env at the repo root, same as the API. The runner never keeps its own.
process.loadEnvFile(path.resolve(__dirname, '../../../../.env'))

const env = loadEnv()

const logger = pino({
  level: env.LOG_LEVEL,
  ...(env.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
})

const worker = startWorker(env, logger)
const stopReaper = startReaper(env, logger)

logger.info({ concurrency: env.CODE_RUNNER_MAX_CONCURRENCY }, 'code runner ready')

/**
 * A shutdown that does not drain leaves containers running on the host and a
 * submission at QUEUED with nothing left to pick it up. `worker.close()` waits
 * for the jobs in flight, and each of those goes through the kill in
 * `runSandboxed`'s `finally`.
 */
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    logger.info({ signal }, 'draining')
    stopReaper()
    void worker
      .close()
      .catch((error: unknown) => {
        logger.error({ error }, 'unclean shutdown')
      })
      .finally(() => {
        process.exit(0)
      })
  })
}
