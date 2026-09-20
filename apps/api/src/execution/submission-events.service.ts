import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { QueueEvents } from 'bullmq'
import { SUBMISSION_QUEUE } from '@guruji/types'
import type { Env } from '../config/env'
import { EventsGateway } from '../realtime/events.gateway'
import { SubmissionsService } from './submissions.service'

/**
 * Turns "the worker picked the job up" into a status the browser can see.
 *
 * The runner could report this itself, but that would mean a second
 * authenticated route and a second thing the runner is trusted to say. BullMQ
 * already publishes it, and the API is already the only writer to the database
 * — so the transition is read from the queue here instead.
 */
@Injectable()
export class SubmissionEventsService implements OnApplicationShutdown {
  private readonly logger = new Logger(SubmissionEventsService.name)
  private readonly events: QueueEvents

  constructor(
    config: ConfigService<Env, true>,
    private readonly submissions: SubmissionsService,
    private readonly gateway: EventsGateway,
  ) {
    this.events = new QueueEvents(SUBMISSION_QUEUE, {
      connection: { url: config.get('REDIS_URL', { infer: true }) },
    })

    // The job id is the submission id — set at enqueue time precisely so this
    // listener does not have to fetch the payload to find out what it is about.
    this.events.on('active', ({ jobId }) => {
      void this.announceRunning(jobId)
    })

    this.events.on('error', (error: Error) => {
      this.logger.error(`queue events: ${error.message}`)
    })
  }

  private async announceRunning(submissionId: string): Promise<void> {
    try {
      const userId = await this.submissions.ownerOf(submissionId)
      if (userId === null) {
        return
      }
      await this.submissions.markRunning(submissionId)
      this.gateway.emitStatus(userId, { submissionId, status: 'RUNNING' })
    } catch (error) {
      // A missed status line is cosmetic; the verdict still arrives. It is not
      // worth failing anything over, but it is worth knowing about.
      this.logger.warn(`could not announce RUNNING for ${submissionId}: ${String(error)}`)
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.events.close()
  }
}
