import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common'
import { AccessTokenGuard, type AuthenticatedUser } from '../auth/guards/access-token.guard'
import { NotFoundError } from '../common/app-error'
import { CurrentUser } from '../common/decorators/current-user'
import {
  RecommendationsService,
  type RecommendationView,
  type TrainNowView,
} from './recommendations.service'

@Controller('recommendations')
@UseGuards(AccessTokenGuard)
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}

  /** The whole batch, for the dashboard panel. */
  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<RecommendationView[]> {
    return this.recommendations.batch(user.id)
  }

  /**
   * One activity, for the single button.
   *
   * Declared before nothing that could shadow it — there is no `:id` route on
   * this controller, deliberately: a single recommendation is never useful on
   * its own, and the batch already carries it.
   */
  @Get('next')
  next(@CurrentUser() user: AuthenticatedUser): Promise<TrainNowView> {
    return this.recommendations.trainNow(user.id)
  }

  @Post(':id/dismiss')
  @HttpCode(HttpStatus.NO_CONTENT)
  async dismiss(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const dismissed = await this.recommendations.dismiss(user.id, id)

    // 404, not 403: confirming the id exists is itself a disclosure.
    if (!dismissed) {
      throw new NotFoundError('RECOMMENDATION_NOT_FOUND', 'That recommendation does not exist.')
    }
  }
}
