import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { CandidatesService } from './candidates.service'
import { RecommendationsController } from './recommendations.controller'
import { RecommendationsService } from './recommendations.service'

/**
 * The brain of the product.
 *
 * `RecommendationsService` is exported because the submission path has to drop
 * its cache: a recommendation that survives a submission is a recommendation
 * that contradicts what the user just did.
 */
@Module({
  imports: [AuthModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService, CandidatesService],
  // CandidatesService for contests: they pick weak topics by the same measure.
  exports: [RecommendationsService, CandidatesService],
})
export class RecommendationsModule {}
