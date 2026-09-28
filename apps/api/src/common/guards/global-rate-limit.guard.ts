import { Injectable, SetMetadata, type CanActivate, type ExecutionContext } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { RateLimitService } from '../../auth/rate-limit.service'
import type { Env } from '../../config/env'

const SKIP = 'skipGlobalRateLimit'

/**
 * Exempts a controller or route from the per-IP baseline: the health check
 * (a load balancer must always be answered) and the runner's callback (an
 * internal service behind its own secret, not a client).
 */
export const SkipGlobalRateLimit = (): ClassDecorator & MethodDecorator => SetMetadata(SKIP, true)

const WINDOW_MS = 60_000

/**
 * The baseline from docs/security.md: every route, signed in or not, is
 * limited per IP before anything else runs. Expensive routes keep their own,
 * stricter, per-user limits on top — per IP alone is defeated by one account
 * in a loop, and would punish a shared network for it.
 *
 * Behind a reverse proxy, `request.ip` is the proxy unless Express is told to
 * trust it; set `trust proxy` at deploy time or every user shares one bucket.
 */
@Injectable()
export class GlobalRateLimitGuard implements CanActivate {
  private readonly limit: number

  constructor(
    private readonly rateLimit: RateLimitService,
    private readonly reflector: Reflector,
    config: ConfigService<Env, true>,
  ) {
    this.limit = config.get('RATE_LIMIT_GLOBAL_PER_MINUTE', { infer: true })
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP, [context.getHandler(), context.getClass()])
    if (skip === true) return true

    const ip = context.switchToHttp().getRequest<Request>().ip ?? 'unknown'
    await this.rateLimit.hit(`rl:global:ip:${ip}`, this.limit, WINDOW_MS)
    return true
  }
}
