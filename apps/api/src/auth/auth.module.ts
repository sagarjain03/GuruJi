import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { AccessTokenGuard } from './guards/access-token.guard'
import { PasswordService } from './password.service'
import { RateLimitService } from './rate-limit.service'
import { RefreshTokenService } from './refresh-token.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    RefreshTokenService,
    RateLimitService,
    AccessTokenGuard,
  ],
  exports: [AccessTokenGuard],
})
export class AuthModule {}
