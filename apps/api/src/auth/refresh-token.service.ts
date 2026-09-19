import { createHash, randomBytes } from 'node:crypto'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { prisma } from '@guruji/database'
import { durationToMs } from '../common/duration'
import type { Env } from '../config/env'

export interface TokenContext {
  userAgent?: string | undefined
  ipHash?: string | undefined
}

export interface IssuedToken {
  id: string
  token: string
  expiresAt: Date
}

/**
 * Refresh tokens: high-entropy random strings, stored only as a SHA-256 digest.
 *
 * Argon2 is the right tool for passwords, which are low-entropy and guessable.
 * These are 384 random bits — there is nothing to brute-force, and a slow hash
 * on every refresh would only cost latency.
 */
@Injectable()
export class RefreshTokenService {
  private readonly ttlMs: number

  constructor(config: ConfigService<Env, true>) {
    this.ttlMs = durationToMs(config.get('JWT_REFRESH_TTL', { infer: true }))
  }

  static digest(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  async issue(userId: string, context: TokenContext = {}): Promise<IssuedToken> {
    const token = randomBytes(48).toString('base64url')
    const expiresAt = new Date(Date.now() + this.ttlMs)

    const record = await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: RefreshTokenService.digest(token),
        expiresAt,
        userAgent: context.userAgent ?? null,
        ipHash: context.ipHash ?? null,
      },
      select: { id: true },
    })

    return { id: record.id, token, expiresAt }
  }

  /**
   * Exchanges a refresh token for a new one.
   *
   * A token that has already been rotated or revoked being presented again means
   * someone is replaying a stolen copy. Every live token for that user is then
   * revoked — the legitimate session dies too, which is the point.
   */
  async rotate(
    token: string,
    context: TokenContext = {},
  ): Promise<IssuedToken & { userId: string }> {
    const existing = await prisma.refreshToken.findUnique({
      where: { tokenHash: RefreshTokenService.digest(token) },
    })

    if (!existing) {
      throw new UnauthorizedException('Refresh token is not valid.')
    }

    if (existing.revokedAt !== null || existing.replacedById !== null) {
      await this.revokeAllForUser(existing.userId)
      throw new UnauthorizedException('Refresh token is not valid.')
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token is not valid.')
    }

    const replacement = randomBytes(48).toString('base64url')
    const expiresAt = new Date(Date.now() + this.ttlMs)

    // One transaction: a crash between the two writes would either strand the
    // old token as usable or leave the user with no session at all.
    const created = await prisma.$transaction(async (tx) => {
      const record = await tx.refreshToken.create({
        data: {
          userId: existing.userId,
          tokenHash: RefreshTokenService.digest(replacement),
          expiresAt,
          userAgent: context.userAgent ?? null,
          ipHash: context.ipHash ?? null,
        },
        select: { id: true },
      })

      await tx.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date(), replacedById: record.id },
      })

      return record
    })

    return { id: created.id, token: replacement, expiresAt, userId: existing.userId }
  }

  async revoke(token: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: RefreshTokenService.digest(token), revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }
}
