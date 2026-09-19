import { Inject, Injectable } from '@nestjs/common'
import { prisma } from '@guruji/database'
import type Redis from 'ioredis'
import { REDIS } from '../redis/redis.module'

export type CheckState = 'up' | 'down'

export interface ReadinessReport {
  status: 'ready' | 'not_ready'
  checks: Record<string, CheckState>
}

@Injectable()
export class HealthService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async readiness(): Promise<ReadinessReport> {
    const [postgres, redis] = await Promise.all([this.checkPostgres(), this.checkRedis()])

    // The code runner joins this list in Phase 4, when it exists.
    const checks: Record<string, CheckState> = { postgres, redis }
    const status = Object.values(checks).every((c) => c === 'up') ? 'ready' : 'not_ready'

    return { status, checks }
  }

  private async checkPostgres(): Promise<CheckState> {
    try {
      await prisma.$queryRaw`SELECT 1`
      return 'up'
    } catch {
      return 'down'
    }
  }

  private async checkRedis(): Promise<CheckState> {
    try {
      const reply = await this.redis.ping()
      return reply === 'PONG' ? 'up' : 'down'
    } catch {
      return 'down'
    }
  }
}
