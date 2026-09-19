import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { AuthSession, Me } from '@guruji/types'
import type { CookieOptions, Request, Response } from 'express'
import { CurrentUser } from '../common/decorators/current-user'
import type { Env } from '../config/env'
import { AuthService, type SessionResult } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'
import { AccessTokenGuard, type AuthenticatedUser } from './guards/access-token.guard'
import { RateLimitService } from './rate-limit.service'

const REFRESH_COOKIE = 'guruji_refresh'

// 5 attempts per 15 minutes, per IP and per email — see docs/security.md.
const ATTEMPT_LIMIT = 5
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly rateLimit: RateLimitService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    await this.guardAttempts('register', dto.email, request)

    const result = await this.auth.register(dto, contextFrom(request))
    this.setRefreshCookie(response, result)
    return result.session
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    const keys = await this.guardAttempts('login', dto.email, request)

    const result = await this.auth.login(dto, contextFrom(request))

    // A successful login clears the counters, so a user who mistyped twice is
    // not still one attempt from a lockout an hour later.
    await Promise.all(keys.map((key) => this.rateLimit.reset(key)))

    this.setRefreshCookie(response, result)
    return result.session
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    const token = readRefreshCookie(request)
    if (!token) {
      throw new UnauthorizedException('Refresh token is not valid.')
    }

    let result: SessionResult
    try {
      result = await this.auth.refresh(token, contextFrom(request))
    } catch (error) {
      // A token that cannot be exchanged is dead — expired, revoked, or the
      // account is gone. Leaving it in the cookie jar keeps the browser looking
      // signed in to anything that only checks whether a cookie exists.
      response.clearCookie(REFRESH_COOKIE, this.cookieOptions(0))
      throw error
    }

    this.setRefreshCookie(response, result)
    return result.session
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(readRefreshCookie(request))
    response.clearCookie(REFRESH_COOKIE, this.cookieOptions(0))
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  me(@CurrentUser() user: AuthenticatedUser): Promise<Me> {
    return this.auth.me(user.id)
  }

  private async guardAttempts(route: string, email: string, request: Request): Promise<string[]> {
    const ip = request.ip ?? 'unknown'
    const keys = [`rl:${route}:ip:${ip}`, `rl:${route}:email:${email}`]

    for (const key of keys) {
      await this.rateLimit.hit(key, ATTEMPT_LIMIT, ATTEMPT_WINDOW_MS)
    }

    return keys
  }

  private setRefreshCookie(response: Response, result: SessionResult): void {
    const maxAge = result.refreshExpiresAt.getTime() - Date.now()
    response.cookie(REFRESH_COOKIE, result.refreshToken, this.cookieOptions(maxAge))
  }

  private cookieOptions(maxAge: number): CookieOptions {
    return {
      httpOnly: true,
      // `Secure` would stop the cookie being set at all over plain http, which
      // is what local development runs on.
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge,
    }
  }
}

function readRefreshCookie(request: Request): string | undefined {
  const cookies = request.cookies as Record<string, string> | undefined
  return cookies?.[REFRESH_COOKIE]
}

function contextFrom(request: Request): { userAgent?: string; ipHash?: string } {
  const userAgent = request.headers['user-agent']
  const ipHash = AuthService.hashIp(request.ip)

  return {
    ...(userAgent ? { userAgent } : {}),
    ...(ipHash ? { ipHash } : {}),
  }
}
