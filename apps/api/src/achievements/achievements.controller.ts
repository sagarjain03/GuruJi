import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common'
import { markSeenRequestSchema, type TrophyCase } from '@guruji/types'
import { AccessTokenGuard, type AuthenticatedUser } from '../auth/guards/access-token.guard'
import { AppError } from '../common/app-error'
import { CurrentUser } from '../common/decorators/current-user'
import { AchievementsService } from './achievements.service'

@Controller('achievements')
@UseGuards(AccessTokenGuard)
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  /** The trophy case. Evaluates on read and records any tier crossed for the first time. */
  @Get()
  trophyCase(@CurrentUser() user: AuthenticatedUser): Promise<TrophyCase> {
    return this.achievements.trophyCase(user.id)
  }

  /** Acknowledges unlock moments so each is shown once. */
  @Post('seen')
  @HttpCode(HttpStatus.NO_CONTENT)
  async seen(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown): Promise<void> {
    const parsed = markSeenRequestSchema.safeParse(body)
    if (!parsed.success) throw new AppError('VALIDATION_FAILED', 'Send the unlocks that were shown.')
    await this.achievements.markSeen(user.id, parsed.data.unlocks)
  }
}
