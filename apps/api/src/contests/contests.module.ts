import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { ExecutionModule } from '../execution/execution.module'
import { RecommendationsModule } from '../recommendations/recommendations.module'
import { ContestsController } from './contests.controller'
import { ContestsService } from './contests.service'

@Module({
  imports: [AuthModule, ExecutionModule, RecommendationsModule],
  controllers: [ContestsController],
  providers: [ContestsService],
  // For the AI mentor's hint gate.
  exports: [ContestsService],
})
export class ContestsModule {}
