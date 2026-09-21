import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { AccessTokenGuard } from './guards/access-token.guard'
import { PasswordService } from './password.service'
import { ProfileController } from './profile.controller'
import { RateLimitService } from './rate-limit.service'
import { RefreshTokenService } from './refresh-token.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController, ProfileController],
  providers: [
    AuthService,
    PasswordService,
    RefreshTokenService,
    RateLimitService,
    AccessTokenGuard,
  ],
  // JwtModule travels with the guard: a module that imports AuthModule to use
  // AccessTokenGuard cannot construct it without JwtService.
  exports: [AccessTokenGuard, JwtModule],
})
export class AuthModule {}
