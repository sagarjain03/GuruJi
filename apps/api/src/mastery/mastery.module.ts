import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AnalyticsController } from './analytics.controller'
import { AnalyticsService } from './analytics.service'
import { MistakesController } from './mistakes.controller'
import { MistakesService } from './mistakes.service'
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
  // For `AccessTokenGuard`, which AuthModule exports.
  imports: [AuthModule],
  controllers: [MistakesController, AnalyticsController],
  providers: [ProgressService, ReconciliationService, MistakesService, AnalyticsService],
  exports: [ProgressService, ReconciliationService],
})
export class MasteryModule {}
