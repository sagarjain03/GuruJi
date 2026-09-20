import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common'
import { runnerCallbackSchema } from '@guruji/types'
import { AppError } from '../common/app-error'
import { EventsGateway } from '../realtime/events.gateway'
import { RunnerSecretGuard } from './guards/runner-secret.guard'
import { SubmissionsService } from './submissions.service'

/**
 * The one route the code runner is allowed to call.
 *
 * It sits under `/internal` so that the path itself says what the deployment
 * must enforce: this is reachable from the runner's network and from nowhere
 * else. The shared-secret guard is the check that holds when that is
 * misconfigured.
 */
@Controller('internal/submissions')
@UseGuards(RunnerSecretGuard)
export class RunnerCallbackController {
  constructor(
    private readonly submissions: SubmissionsService,
    private readonly gateway: EventsGateway,
  ) {}

  @Post('callback')
  @HttpCode(HttpStatus.NO_CONTENT)
  async record(@Body() body: unknown): Promise<void> {
    // Zod rather than a class-validator DTO: this payload's shape is already
    // defined once, in the contract both sides import. A second declaration of
    // it here is a second thing to keep in step.
    const parsed = runnerCallbackSchema.safeParse(body)
    if (!parsed.success) {
      throw new AppError(
        'INVALID_RUNNER_CALLBACK',
        'The runner sent a result that does not match the contract.',
        HttpStatus.BAD_REQUEST,
      )
    }

    const recorded = await this.submissions.recordResult(parsed.data)

    // Null means the submission is gone, or the verdict was already recorded —
    // both are normal for an at-least-once queue, and neither is an error the
    // runner should retry.
    if (recorded === null) {
      return
    }

    const { userId, submission } = recorded
    this.gateway.emitStatus(userId, { submissionId: submission.id, status: submission.status })
    this.gateway.emitResult(userId, { submissionId: submission.id, submission })
  }
}
