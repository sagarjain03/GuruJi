import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common'
import type { Request } from 'express'
import type { AuthenticatedUser } from '../../auth/guards/access-token.guard'

/** The authenticated user, as established by `AccessTokenGuard`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<Request>()
    if (!request.user) {
      throw new UnauthorizedException('Authentication required.')
    }
    return request.user
  },
)
