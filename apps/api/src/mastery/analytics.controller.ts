import { Controller, Get, UseGuards } from '@nestjs/common'
import type { AnalyticsOverview } from '@guruji/types'
import { AccessTokenGuard, type AuthenticatedUser } from '../auth/guards/access-token.guard'
import { CurrentUser } from '../common/decorators/current-user'
import { AnalyticsService } from './analytics.service'

@Controller('analytics')
@UseGuards(AccessTokenGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** Everything the dashboard needs, in one request rather than five. */
  @Get('overview')
  overview(@CurrentUser() user: AuthenticatedUser): Promise<AnalyticsOverview> {
    return this.analytics.overview(user.id)
  }
}
