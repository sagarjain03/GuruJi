import { Body, Controller, Put, UseGuards } from '@nestjs/common'
import { prisma } from '@guruji/database'
import { onboardingRequestSchema, type PublicProfile } from '@guruji/types'
import { AppError } from '../common/app-error'
import { CurrentUser } from '../common/decorators/current-user'
import { AccessTokenGuard, type AuthenticatedUser } from './guards/access-token.guard'

/**
 * Where stated experience seeds the engine, before there is any real history.
 *
 * Only `difficultyTolerance` is seeded, and deliberately nothing else. Mastery
 * is **not** written from a questionnaire: a score invented from "I am
 * intermediate" is fabricated data, and the recommendation engine would then
 * reason confidently from something nobody measured. Real mastery arrives the
 * way it always does — through solved problems.
 *
 * Tolerance is different because it is exactly what a self-report can honestly
 * set: where to aim the first problems. It is overwritten by evidence as soon
 * as there is any.
 */
const TOLERANCE_BY_LEVEL = {
  BEGINNER: 0.15,
  INTERMEDIATE: 0.45,
  ADVANCED: 0.75,
} as const

@Controller('profile')
@UseGuards(AccessTokenGuard)
export class ProfileController {
  @Put('onboarding')
  async onboarding(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<PublicProfile> {
    const parsed = onboardingRequestSchema.safeParse(body)
    if (!parsed.success) {
      throw new AppError('INVALID_ONBOARDING', 'Some of those answers are not valid.')
    }

    // A timezone the runtime does not know is refused here, at the edge,
    // rather than silently falling back to UTC later and moving the user's day.
    try {
      new Intl.DateTimeFormat('en-CA', { timeZone: parsed.data.timezone })
    } catch {
      throw new AppError('INVALID_TIMEZONE', 'That timezone is not recognised.')
    }

    const profile = await prisma.profile.update({
      where: { userId: user.id },
      data: {
        experienceLevel: parsed.data.experienceLevel,
        preferredLanguage: parsed.data.preferredLanguage,
        dailyGoalMinutes: parsed.data.dailyGoalMinutes,
        timezone: parsed.data.timezone,
        difficultyTolerance: TOLERANCE_BY_LEVEL[parsed.data.experienceLevel],
        onboardingCompletedAt: new Date(),
      },
    })

    return {
      displayName: profile.displayName,
      preferredLanguage: profile.preferredLanguage,
      experienceLevel: profile.experienceLevel,
      dailyGoalMinutes: profile.dailyGoalMinutes,
      timezone: profile.timezone,
      currentStreak: profile.currentStreak,
      longestStreak: profile.longestStreak,
      onboardingCompletedAt: profile.onboardingCompletedAt?.toISOString() ?? null,
    }
  }
}
