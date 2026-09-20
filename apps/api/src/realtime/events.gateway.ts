import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import {
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
} from '@nestjs/websockets'
import type { Server, Socket } from 'socket.io'
import type { SubmissionResultEvent, SubmissionStatusEvent } from '@guruji/types'
import { parseOrigins, type Env } from '../config/env'

type OriginCallback = (error: Error | null, allow?: boolean) => void

/** One room per user. Nothing is ever broadcast to everyone. */
function roomFor(userId: string): string {
  return `user:${userId}`
}

/**
 * The one WebSocket namespace, and it is server → client only.
 *
 * Nothing here mutates state. Everything that does goes through an authorised,
 * validated, rate-limited HTTP route — a socket that accepts commands is a
 * second API surface with none of that in front of it. See docs/api.md.
 */
@Injectable()
@WebSocketGateway({
  namespace: '/ws',
  cors: {
    /*
     * Same allow-list as the REST routes, and `*` is not an option — the
     * handshake carries a token.
     *
     * A function rather than an array because this decorator is evaluated when
     * the module is imported, which is before ConfigModule has loaded `.env`.
     * The function runs per handshake, by which time it has.
     */
    origin: (origin: string | undefined, callback: OriginCallback): void => {
      const allowed = parseOrigins(process.env.CORS_ORIGINS ?? '')
      callback(null, origin === undefined || allowed.includes(origin))
    },
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server!: Server

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Authentication happens at the handshake, not on the first message.
   *
   * A socket that connects first and authenticates later is a socket that is
   * joined to no room but is still holding a connection, and every subsequent
   * handler has to remember to re-check. Failing the handshake keeps that
   * ambiguity from existing.
   */
  async handleConnection(client: Socket): Promise<void> {
    const token = readToken(client)

    if (token === null) {
      client.disconnect(true)
      return
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      })
      await client.join(roomFor(payload.sub))
    } catch {
      client.disconnect(true)
    }
  }

  emitStatus(userId: string, event: SubmissionStatusEvent): void {
    this.server.to(roomFor(userId)).emit('submission:status', event)
  }

  emitResult(userId: string, event: SubmissionResultEvent): void {
    this.server.to(roomFor(userId)).emit('submission:result', event)
  }
}

/**
 * The browser cannot set headers on a WebSocket upgrade, so the token comes in
 * the handshake `auth` payload. The header form is accepted too, for anything
 * that is not a browser.
 */
function readToken(client: Socket): string | null {
  const fromAuth = (client.handshake.auth as { token?: unknown }).token
  if (typeof fromAuth === 'string' && fromAuth.length > 0) {
    return fromAuth
  }

  const header = client.handshake.headers.authorization
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length)
  }

  return null
}
