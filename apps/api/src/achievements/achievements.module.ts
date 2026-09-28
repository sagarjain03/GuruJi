import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AchievementsController } from './achievements.controller'
import { AchievementsService } from './achievements.service'

/**
 * Deliberately exports nothing: no other module may depend on achievements.
 * That is how "gamification never feeds mastery" stays true by construction.
 */
@Module({
  imports: [AuthModule],
  controllers: [AchievementsController],
  providers: [AchievementsService],
})
export class AchievementsModule {}
