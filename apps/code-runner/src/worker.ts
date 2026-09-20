import { Worker, type Job } from 'bullmq'
import {
  SUBMISSION_JOB_ATTEMPTS,
  SUBMISSION_QUEUE,
  runnerJobSchema,
  type RunnerJob,
} from '@guruji/types'
import { postResult } from './callback'
import { judge } from './judge'
import type { RunnerEnv } from './config/env'
import type { Logger } from 'pino'

export interface RunningWorker {
  close: () => Promise<void>
}

/**
 * One job is one submission, and one submission is one container per test case.
 *
 * Concurrency is bounded here rather than by the queue: at 256 MB a container,
 * the limit that matters is host memory, and the queue is what absorbs the
 * burst while the workers stay at a size the host can actually run.
 */
export function startWorker(env: RunnerEnv, logger: Logger): RunningWorker {
  const worker = new Worker(
    SUBMISSION_QUEUE,
    async (job: Job<unknown>) => {
      const parsed = runnerJobSchema.parse(job.data)
      // A malformed job is our bug, not the user's, and no amount of retrying
      // will make it parse. It fails the job and lands on the dead-letter path
      // below, which reports INTERNAL_ERROR — never counted against accuracy.
      const bounded = clampToHostLimits(parsed, env)

      logger.info(
        { submissionId: bounded.submissionId, language: bounded.language, cases: bounded.testCases.length },
        'judging',
      )

      const result = await judge(bounded)
      await postResult(env, result)

      logger.info({ submissionId: bounded.submissionId, verdict: result.verdict }, 'judged')
    },
    {
      // BullMQ opens its own connection from this. It blocks on reads, so it
      // needs settings a shared client should not have.
      connection: { url: env.REDIS_URL },
      concurrency: env.CODE_RUNNER_MAX_CONCURRENCY,
    },
  )

  /**
   * The dead-letter path.
   *
   * A submission whose job exhausted its attempts must not sit at QUEUED
   * forever: to the person waiting, a stuck spinner is indistinguishable from a
   * lost submission. The API is told `INTERNAL_ERROR`, which is deliberately
   * *our* failure and is never counted against the user's accuracy.
   */
  worker.on('failed', (job, error) => {
    const attempts = job?.opts.attempts ?? SUBMISSION_JOB_ATTEMPTS
    logger.error({ jobId: job?.id, attempt: job?.attemptsMade, error: error.message }, 'job failed')

    if (job === undefined || job.attemptsMade < attempts) {
      return
    }

    const submissionId = readSubmissionId(job.data)
    if (submissionId === null) {
      logger.error({ jobId: job.id }, 'dead-lettered job carries no submission id')
      return
    }

    void postResult(env, {
      submissionId,
      verdict: 'INTERNAL_ERROR',
      runtimeMs: null,
      memoryKb: null,
      compileOutput: null,
      results: [],
    }).catch((cause: unknown) => {
      logger.error({ submissionId, cause }, 'could not report the dead-lettered job')
    })
  })

  worker.on('error', (error) => {
    logger.error({ error: error.message }, 'worker error')
  })

  return {
    close: async () => {
      await worker.close()
    },
  }
}

/**
 * A problem's limits are a maximum the host agrees to, not an instruction.
 *
 * The API sets them from the problem row, so a bad row — or a future admin
 * route that writes one — cannot ask this host for a 60 second, 4 GB run.
 */
function clampToHostLimits(job: RunnerJob, env: RunnerEnv): RunnerJob {
  return {
    ...job,
    timeLimitMs: Math.min(job.timeLimitMs, env.CODE_RUNNER_TIMEOUT_MS),
    memoryLimitMb: Math.min(job.memoryLimitMb, env.CODE_RUNNER_MEMORY_MB),
  }
}

/** The payload failed validation, so read the one field defensively. */
function readSubmissionId(data: unknown): string | null {
  if (typeof data === 'object' && data !== null && 'submissionId' in data) {
    const value = (data as { submissionId: unknown }).submissionId
    return typeof value === 'string' ? value : null
  }
  return null
}
