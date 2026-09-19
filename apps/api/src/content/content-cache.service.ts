import { Inject, Injectable } from '@nestjs/common'
import type Redis from 'ioredis'
import { REDIS } from '../redis/redis.module'

/** TTLs from the caching table in docs/api.md. */
export const CACHE_TTL = {
  /** Topic list, pattern list, roadmap tree. */
  taxonomy: 60 * 60,
  /** Problem list metadata. */
  problemList: 10 * 60,
} as const

/**
 * Read-through cache for content responses.
 *
 * The key is passed in whole by the caller rather than assembled here, because
 * the rule that matters is a caller-side one: a key must include every input the
 * response varies by. Nothing cached in Phase 2 varies by user — mastery
 * overlays arrive in Phase 5, and those keys will have to carry the user id.
 *
 * A Redis outage degrades to a cache miss rather than a failed request: content
 * reads are the least important thing in the product to fail hard.
 */
@Injectable()
export class ContentCache {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async wrap<T>(key: string, ttlSeconds: number, produce: () => Promise<T>): Promise<T> {
    const cached = await this.read<T>(key)
    if (cached !== null) {
      return cached
    }

    const fresh = await produce()

    try {
      await this.redis.set(key, JSON.stringify(fresh), 'EX', ttlSeconds)
    } catch {
      // Losing the write only costs the next caller a database read.
    }

    return fresh
  }

  private async read<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key)
      return raw === null ? null : (JSON.parse(raw) as T)
    } catch {
      return null
    }
  }
}
