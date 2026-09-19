import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'
import type { Env } from '../../config/env'

export interface AuthenticatedUser {
  id: string
  role: string
}

declare module 'express' {
  interface Request {
    user?: AuthenticatedUser
  }
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const header = request.headers.authorization

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication required.')
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; role: string }>(
        header.slice('Bearer '.length),
        { secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }) },
      )
      // The user id always comes from the verified token, never from the request.
      request.user = { id: payload.sub, role: payload.role }
      return true
    } catch {
      throw new UnauthorizedException('Authentication required.')
    }
  }
}
