import { Module } from '@nestjs/common'
import { ProgressService } from './progress.service'
import { ReconciliationService } from './reconciliation.service'

/**
 * How well the user is doing, and the guard that says so honestly.
 *
 * `ProgressService` is also provided by `ExecutionModule`, deliberately: the
 * counters move inside the submission transaction, so that module owns the
 * instance doing the writing. This module owns the one that checks it.
 */
@Module({
  providers: [ProgressService, ReconciliationService],
  exports: [ProgressService, ReconciliationService],
})
export class MasteryModule {}
