import { createHash } from 'node:crypto'
import { HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { prisma, type Profile, type User } from '@guruji/database'
import type { AuthSession, Me, PublicProfile, PublicUser } from '@guruji/types'
import { AppError } from '../common/app-error'
import { durationToMs } from '../common/duration'
import type { Env } from '../config/env'
import { PasswordService } from './password.service'
import { RefreshTokenService, type TokenContext } from './refresh-token.service'

export interface SessionResult {
  session: AuthSession
  refreshToken: string
  refreshExpiresAt: Date
}

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly jwt: JwtService,
    private readonly passwords: PasswordService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  static hashIp(ip: string | undefined): string | undefined {
    // The raw address is personal data and is never needed again — only the
    // ability to compare two sessions.
    return ip ? createHash('sha256').update(ip).digest('hex') : undefined
  }

  async register(
    input: { email: string; password: string; displayName: string },
    context: TokenContext,
  ): Promise<SessionResult> {
    const passwordHash = await this.passwords.hash(input.password)

    const existing = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    })

    if (existing) {
      throw new AppError(
        'EMAIL_ALREADY_REGISTERED',
        'That email is already registered.',
        HttpStatus.CONFLICT,
      )
    }

    // User and Profile are one unit: a user without a profile has no language,
    // no timezone and no streak, and every dashboard query would have to guess.
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        profile: { create: { displayName: input.displayName } },
      },
      include: { profile: true },
    })

    return this.startSession(user, user.profile as Profile, context)
  }

  async login(
    input: { email: string; password: string },
    context: TokenContext,
  ): Promise<SessionResult> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: { profile: true },
    })

    // One message for both "no such email" and "wrong password". Distinguishing
    // them turns this route into an account-enumeration oracle.
    const invalid = new AppError(
      'INVALID_CREDENTIALS',
      'Email or password is incorrect.',
      HttpStatus.UNAUTHORIZED,
    )

    if (!user || user.deletedAt !== null || !user.profile) {
      // Still spend the time a real verification costs, so the response time
      // does not reveal whether the account exists.
      await this.passwords.verify(
        '$argon2id$v=19$m=19456,t=2,p=1$aaaaaaaaaaaaaaaa$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        input.password,
      )
      throw invalid
    }

    if (!(await this.passwords.verify(user.passwordHash, input.password))) {
      throw invalid
    }

    return this.startSession(user, user.profile, context)
  }

  async refresh(token: string, context: TokenContext): Promise<SessionResult> {
    const rotated = await this.refreshTokens.rotate(token, context)

    const user = await prisma.user.findUnique({
      where: { id: rotated.userId },
      include: { profile: true },
    })

    if (!user || user.deletedAt !== null || !user.profile) {
      throw new UnauthorizedException('Refresh token is not valid.')
    }

    return {
      session: {
        accessToken: await this.signAccessToken(user),
        user: toPublicUser(user),
        profile: toPublicProfile(user.profile),
      },
      refreshToken: rotated.token,
      refreshExpiresAt: rotated.expiresAt,
    }
  }

  async logout(token: string | undefined): Promise<void> {
    if (token) {
      await this.refreshTokens.revoke(token)
    }
  }

  async me(userId: string): Promise<Me> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    })

    if (!user || user.deletedAt !== null || !user.profile) {
      throw new UnauthorizedException('Session is no longer valid.')
    }

    return { user: toPublicUser(user), profile: toPublicProfile(user.profile) }
  }

  private async startSession(
    user: User,
    profile: Profile,
    context: TokenContext,
  ): Promise<SessionResult> {
    const issued = await this.refreshTokens.issue(user.id, context)

    return {
      session: {
        accessToken: await this.signAccessToken(user),
        user: toPublicUser(user),
        profile: toPublicProfile(profile),
      },
      refreshToken: issued.token,
      refreshExpiresAt: issued.expiresAt,
    }
  }

  private signAccessToken(user: User): Promise<string> {
    return this.jwt.signAsync(
      { sub: user.id, role: user.role },
      {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        // Seconds, not "15m": the JWT typings only accept a number or their own
        // template-literal type, and we already have a parser for the env format.
        expiresIn: durationToMs(this.config.get('JWT_ACCESS_TTL', { infer: true })) / 1000,
      },
    )
  }
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  }
}

function toPublicProfile(profile: Profile): PublicProfile {
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
