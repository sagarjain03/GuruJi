import type { AuthSession, ErrorEnvelope, Me } from '@guruji/types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

/** An error that carries the API's own code, so callers can branch on it. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly requestId: string | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

let accessToken: string | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  /** Set on the refresh call itself, so a failed refresh cannot recurse. */
  skipRefresh?: boolean
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const payload = (await response.json()) as ErrorEnvelope
    return new ApiError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.error.requestId,
    )
  } catch {
    return new ApiError('INTERNAL_ERROR', 'Something went wrong.', response.status)
  }
}

async function send<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    // The refresh token rides along as an httpOnly cookie and is never read here.
    credentials: 'include',
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  })

  if (response.status === 401 && !options.skipRefresh) {
    // The access token lives 15 minutes. One silent refresh is the difference
    // between a session that feels permanent and one that logs you out mid-task.
    const refreshed = await refreshSession()
    if (refreshed) {
      return send<T>(path, { ...options, skipRefresh: true })
    }
  }

  if (!response.ok) {
    throw await parseError(response)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export const authApi = {
  register: (body: { email: string; password: string; displayName: string }) =>
    send<AuthSession>('/auth/register', { method: 'POST', body, skipRefresh: true }),

  login: (body: { email: string; password: string }) =>
    send<AuthSession>('/auth/login', { method: 'POST', body, skipRefresh: true }),

  refresh: () => send<AuthSession>('/auth/refresh', { method: 'POST', skipRefresh: true }),

  logout: () => send<void>('/auth/logout', { method: 'POST', skipRefresh: true }),

  me: () => send<Me>('/auth/me'),
}

/**
 * Trades the refresh cookie for a new access token.
 *
 * Returns false rather than throwing: "no session" is a normal state on a cold
 * page load, not an error the UI should report.
 */
export async function refreshSession(): Promise<AuthSession | null> {
  try {
    const session = await authApi.refresh()
    setAccessToken(session.accessToken)
    return session
  } catch {
    setAccessToken(null)
    return null
  }
}
