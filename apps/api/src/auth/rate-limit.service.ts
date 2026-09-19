import { HttpStatus, Inject, Injectable } from '@nestjs/common'
import type Redis from 'ioredis'
import { AppError } from '../common/app-error'
import { REDIS } from '../redis/redis.module'

/**
 * A fixed-window counter in Redis.
 *
 * Redis rather than memory because the limit has to hold across API instances —
 * a per-process counter means N instances allow N times the traffic.
 */
@Injectable()
export class RateLimitService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async hit(key: string, limit: number, windowMs: number): Promise<void> {
    const count = await this.redis.incr(key)

    if (count === 1) {
      await this.redis.pexpire(key, windowMs)
    }

    if (count > limit) {
      throw new AppError(
        'RATE_LIMITED',
        'Too many attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }
  }

  /** Called after a successful login so one good attempt clears the counter. */
  async reset(key: string): Promise<void> {
    await this.redis.del(key)
  }
}
