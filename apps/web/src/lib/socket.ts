'use client'

import { io, type Socket } from 'socket.io-client'
import type { SubmissionResultEvent, SubmissionStatusEvent } from '@guruji/types'
import { getAccessToken } from '@/lib/api'

/**
 * Events are server → client only. There is no `emit` here on purpose:
 * everything that changes state goes through an authorised, validated,
 * rate-limited HTTP route. See docs/api.md.
 */
export interface ServerEvents {
  'submission:status': (event: SubmissionStatusEvent) => void
  'submission:result': (event: SubmissionResultEvent) => void
}

export type AppSocket = Socket<ServerEvents>

let socket: AppSocket | null = null

/**
 * One connection for the whole tab.
 *
 * A socket per component would mean a handshake per mount, and a verdict
 * arriving on a connection whose component had already unmounted. Components
 * subscribe to this one and unsubscribe on unmount instead.
 */
export function getSocket(): AppSocket {
  socket ??= io(socketUrl(), {
    // The browser cannot set headers on a WebSocket upgrade, so the token goes
    // in the handshake payload, where the gateway reads it.
    auth: (callback: (payload: { token: string | null }) => void) => {
      // A function, not an object: it is re-read on every reconnect, so a
      // socket that reconnects after a token refresh sends the new token
      // rather than the one it was constructed with.
      callback({ token: getAccessToken() })
    },
    transports: ['websocket'],
    withCredentials: true,
    autoConnect: true,
  })

  return socket
}

/**
 * Dropped on logout.
 *
 * The room a socket is in was decided by the token it handshook with. Leaving
 * it open across a sign-out would keep pushing the previous user's verdicts
 * into the page.
 */
export function closeSocket(): void {
  socket?.disconnect()
  socket = null
}

/** `NEXT_PUBLIC_API_URL` points at the REST prefix; the namespace is at the root. */
function socketUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'
  return `${new URL(base).origin}/ws`
}
