import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { RealtimeModule } from '../realtime/realtime.module'
import { RateLimitService } from '../auth/rate-limit.service'
import { ProgressService } from '../mastery/progress.service'
import { RunnerCallbackController } from './runner-callback.controller'
import { RunnerSecretGuard } from './guards/runner-secret.guard'
import { SubmissionEventsService } from './submission-events.service'
import { SubmissionQueueService } from './submission-queue.service'
import { SubmissionsController } from './submissions.controller'
import { SubmissionsService } from './submissions.service'

/**
 * Everything on the API side of running code: the queue it is pushed to, the
 * callback it comes back through, and the routes that read the history.
 *
 * The sandbox itself lives in `apps/code-runner`, on the other side of Redis.
 * Nothing in this module executes user code — that boundary is the whole design.
 */
@Module({
  imports: [AuthModule, RealtimeModule],
  controllers: [SubmissionsController, RunnerCallbackController],
  providers: [
    SubmissionsService,
    SubmissionQueueService,
    SubmissionEventsService,
    RateLimitService,
    RunnerSecretGuard,
    // The counters move in the same transaction as the verdict. That is the
    // whole reason this lives here rather than behind an event.
    ProgressService,
  ],
})
export class ExecutionModule {}
