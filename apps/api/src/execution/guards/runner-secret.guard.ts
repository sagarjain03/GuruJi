import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { timingSafeEqual } from 'node:crypto'
import type { Request } from 'express'
import { RUNNER_SECRET_HEADER } from '@guruji/types'
import type { Env } from '../../config/env'

/**
 * The callback route has no user session behind it, so this header is the only
 * thing between "the runner reported a verdict" and "anybody on the network
 * marked their own submission accepted".
 *
 * Network isolation is the other half — the runner is on an internal network
 * and this route is never exposed publicly — but a secret that is checked is
 * worth having even when the network says it should not be reachable.
 */
@Injectable()
export class RunnerSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    const provided = request.headers[RUNNER_SECRET_HEADER]
    const expected = this.config.get('CODE_RUNNER_SHARED_SECRET', { infer: true })

    if (typeof provided !== 'string' || !constantTimeEquals(provided, expected)) {
      throw new UnauthorizedException('Not authorised.')
    }

    return true
  }
}

/**
 * `===` on a secret leaks its prefix through how long the comparison takes.
 * The length check is separate because `timingSafeEqual` throws on a mismatch,
 * and a length difference is not the part worth hiding.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  return left.length === right.length && timingSafeEqual(left, right)
}
