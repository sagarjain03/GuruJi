import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import {
  analyticsRangeQuerySchema,
  type ActivityResponse,
  type AnalyticsOverview,
  type AnalyticsRangeQuery,
  type TopicAnalytics,
  type TrendsResponse,
} from '@guruji/types'
import { AccessTokenGuard, type AuthenticatedUser } from '../auth/guards/access-token.guard'
import { AppError } from '../common/app-error'
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

  /** Daily counts for the heatmap. At most a year and a day. */
  @Get('activity')
  activity(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown): Promise<ActivityResponse> {
    return this.analytics.activityRange(user.id, parseRange(query))
  }

  /** Per-topic and per-pattern performance, and the difficulty split. */
  @Get('topics')
  topics(@CurrentUser() user: AuthenticatedUser): Promise<TopicAnalytics> {
    return this.analytics.topicAnalytics(user.id)
  }

  /** Weekly accuracy and solve time. At most a year and a day. */
  @Get('trends')
  trends(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown): Promise<TrendsResponse> {
    return this.analytics.trends(user.id, parseRange(query))
  }
}

function parseRange(query: unknown): AnalyticsRangeQuery {
  const parsed = analyticsRangeQuerySchema.safeParse(query)
  if (!parsed.success) {
    throw new AppError('INVALID_RANGE', '`from` and `to` must be dates written YYYY-MM-DD.')
  }
  return parsed.data
}
