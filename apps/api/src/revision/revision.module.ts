import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { QueueService } from './queue.service'
import { RevisionController } from './revision.controller'
import { RevisionService } from './revision.service'

/**
 * When a solved problem comes back.
 *
 * `RevisionService` is also provided by `ExecutionModule`: scheduling happens
 * inside the submission transaction, so that module owns the instance doing the
 * writing, the same arrangement `ProgressService` has.
 */
@Module({
  imports: [AuthModule],
  controllers: [RevisionController],
  providers: [RevisionService, QueueService],
  exports: [RevisionService, QueueService],
})
export class RevisionModule {}
