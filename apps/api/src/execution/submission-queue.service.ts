import { Injectable, type OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Queue } from 'bullmq'
import { SUBMISSION_JOB_ATTEMPTS, SUBMISSION_QUEUE, type RunnerJob } from '@guruji/types'
import type { Env } from '../config/env'

/**
 * The only thing standing between a burst of submissions and the API's request
 * handlers.
 *
 * `POST /submissions` writes a row and pushes a job; it never waits for a
 * container. The cost is that Redis is on the submission critical path — a
 * submission failing while Redis is down is honest and visible, which is the
 * trade docs/code-execution.md accepts.
 */
@Injectable()
export class SubmissionQueueService implements OnApplicationShutdown {
  private readonly queue: Queue<RunnerJob>

  constructor(config: ConfigService<Env, true>) {
    this.queue = new Queue<RunnerJob>(SUBMISSION_QUEUE, {
      // Its own connection, not the cache client. BullMQ blocks on reads and
      // wants `maxRetriesPerRequest: null` for them; forcing that on the shared
      // client would make every cache read hang instead of failing fast.
      connection: { url: config.get('REDIS_URL', { infer: true }) },
      defaultJobOptions: {
        attempts: SUBMISSION_JOB_ATTEMPTS,
        backoff: { type: 'exponential', delay: 1000 },
        // A completed job's payload is the user's source code. Keeping it in
        // Redis after the verdict is a second copy of something we already
        // store once, in a place with no access control on it.
        removeOnComplete: true,
        // Failures are kept briefly, because a dead-lettered job is the thing
        // you want to look at.
        removeOnFail: { age: 24 * 60 * 60, count: 1000 },
      },
    })
  }

  async enqueue(job: RunnerJob): Promise<void> {
    await this.queue.add('judge', job, { jobId: job.submissionId })
  }

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close()
  }
}
