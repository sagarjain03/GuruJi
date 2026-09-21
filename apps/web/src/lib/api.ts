import type {
  AnalyticsOverview,
  AuthSession,
  CompleteRevisionRequest,
  CompleteRevisionResponse,
  CreateMistakeRequest,
  DueQueue,
  ErrorEnvelope,
  UpcomingDay,
  Draft,
  DraftsResponse,
  Hint,
  Mistake,
  MistakeCategory,
  MistakePatternsResponse,
  OnboardingRequest,
  PublicProfile,
  Recommendation,
  TrainNow,
  Language,
  Me,
  Paginated,
  PatternSummary,
  ProblemDetail,
  ProblemListItem,
  ProblemQuery,
  Roadmap,
  Submission,
  SubmissionAccepted,
  SubmissionDetail,
  SubmitRequest,
  TopicDetail,
  TopicSummary,
} from '@guruji/types'

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
  method?: 'GET' | 'POST' | 'PUT'
  body?: unknown
  /** Set on the refresh call itself, so a failed refresh cannot recurse. */
  skipRefresh?: boolean
  /**
   * Let the request outlive the page.
   *
   * Without this a `fetch` started while the tab is closing is cancelled with
   * it. Used by the draft autosave flush, which exists precisely for that
   * moment. The browser caps keepalive bodies at 64KB, which is under the
   * server's own draft limit.
   */
  keepalive?: boolean
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
    ...(options.keepalive ? { keepalive: true } : {}),
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
 * Content reads.
 *
 * These work signed out — the roadmap and the problem bank are public, so the
 * calls go through the same `send` helper but never depend on a token.
 */
export const contentApi = {
  topics: () => send<TopicSummary[]>('/topics'),

  topic: (slug: string) => send<TopicDetail>(`/topics/${encodeURIComponent(slug)}`),

  patterns: () => send<PatternSummary[]>('/patterns'),

  roadmap: () => send<Roadmap>('/roadmap'),

  problems: (query: Partial<ProblemQuery> = {}) =>
    send<Paginated<ProblemListItem>>(`/problems${toQueryString(query)}`),

  problem: (slug: string) => send<ProblemDetail>(`/problems/${encodeURIComponent(slug)}`),

  hint: (slug: string, level: number) =>
    send<Hint>(`/problems/${encodeURIComponent(slug)}/hints/${String(level)}`),
}

/**
 * Unsubmitted code. Every call here needs a session — a draft belongs to one
 * person and there is no anonymous read of one.
 */
export const draftApi = {
  /** Every language's draft for a problem, in one request. */
  list: (slug: string) => send<DraftsResponse>(`/problems/${encodeURIComponent(slug)}/drafts`),

  save: (slug: string, language: Language, code: string, keepalive = false) =>
    send<Draft>(`/problems/${encodeURIComponent(slug)}/drafts/${language}`, {
      method: 'PUT',
      body: { code },
      ...(keepalive ? { keepalive: true } : {}),
    }),
}

/**
 * Running code.
 *
 * `submit` answers with an id and nothing else — the verdict arrives on the
 * socket. `get` exists for the case the socket missed it: a tab that was
 * asleep, a reconnect, or a page opened fresh on a submission from yesterday.
 */
export const submissionApi = {
  submit: (body: SubmitRequest) =>
    send<SubmissionAccepted>('/submissions', { method: 'POST', body }),

  get: (id: string) => send<SubmissionDetail>(`/submissions/${encodeURIComponent(id)}`),

  list: (query: { problemId?: string; cursor?: string; limit?: number } = {}) =>
    send<Paginated<Submission>>(`/submissions${toQueryString(query)}`),
}

/**
 * How well you are doing.
 *
 * One call for the whole dashboard rather than five. It is the first screen
 * after signing in, and a waterfall of requests there is the difference between
 * an app that feels ready and one that assembles itself while you watch.
 */
export const analyticsApi = {
  overview: () => send<AnalyticsOverview>('/analytics/overview'),
}

/** The mistake journal. Every call needs a session; nothing here is public. */
export const mistakeApi = {
  create: (body: CreateMistakeRequest) =>
    send<Mistake>('/mistakes', { method: 'POST', body }),

  list: (query: { category?: MistakeCategory; problemId?: string; limit?: number } = {}) =>
    send<Paginated<Mistake>>(`/mistakes${toQueryString(query)}`),

  /** The aggregation — what keeps happening, and in which topics. */
  patterns: () => send<MistakePatternsResponse>('/mistakes/patterns'),
}

/**
 * What to revise, and when.
 *
 * The queue arrives already ordered and already capped — the server decides
 * both, because the ordering *is* the product and a client that re-sorted it
 * would quietly undo the reasoning behind it.
 */
export const revisionApi = {
  due: () => send<DueQueue>('/revision/due'),

  upcoming: (days = 7) => send<UpcomingDay[]>(`/revision/upcoming?days=${String(days)}`),

  complete: (id: string, body: CompleteRevisionRequest) =>
    send<CompleteRevisionResponse>(`/revision/${encodeURIComponent(id)}/complete`, {
      method: 'POST',
      body,
    }),

  /** Spreads a backlog forward. A POST because it rewrites `dueAt` on many rows. */
  respace: () => send<{ moved: number }>('/revision/respace', { method: 'POST' }),
}

/**
 * What to do next.
 *
 * `next` is the single button; `list` is the panel behind it. Both arrive
 * already ordered and already explained — the client never re-ranks, because
 * the ordering *is* the reasoning and a client that sorted it again would
 * quietly undo the engine.
 */
export const profileApi = {
  onboarding: (body: OnboardingRequest) =>
    send<PublicProfile>('/profile/onboarding', { method: 'PUT', body }),
}

export const recommendationApi = {
  list: () => send<Recommendation[]>('/recommendations'),

  next: () => send<TrainNow>('/recommendations/next'),

  dismiss: (id: string) =>
    send<void>(`/recommendations/${encodeURIComponent(id)}/dismiss`, { method: 'POST' }),
}

/**
 * Undefined and empty values are dropped rather than sent as empty strings: the
 * API validates with `forbidNonWhitelisted`, and `?q=` is not the same request
 * as one with no `q` at all.
 */
function toQueryString(query: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && String(value).length > 0) {
      params.set(key, String(value))
    }
  }
  const text = params.toString()
  return text.length > 0 ? `?${text}` : ''
}

/**
 * Trades the refresh cookie for a new access token.
 *
 * Returns false rather than throwing: "no session" is a normal state on a cold
 * page load, not an error the UI should report.
 */
/**
 * In flight, if one is. Every caller waits on the same exchange.
 *
 * The refresh token **rotates on use**, and presenting a spent one is treated
 * as theft — which revokes the whole chain and signs the user out. So two
 * refreshes running at once do not merely waste a request, they destroy the
 * session.
 *
 * That is not hypothetical. `SessionGate` refreshes on mount, and the
 * dashboard's own queries fire at the same moment; the first of those to get a
 * 401 calls `refreshSession` again while the gate's exchange is still open. The
 * second presents the token the server has just spent, and the user lands on
 * the login page with nothing in the console to explain it. Caught by the
 * Phase 6 browser suite, which was the first test to load a page that queries
 * during its own sign-in.
 */
let pendingRefresh: Promise<AuthSession | null> | null = null

export async function refreshSession(): Promise<AuthSession | null> {
  // Already exchanging. Wait for that one rather than spending the token twice.
  pendingRefresh ??= (async () => {
    try {
      const session = await authApi.refresh()
      setAccessToken(session.accessToken)
      return session
    } catch {
      setAccessToken(null)
      return null
    } finally {
      // Cleared inside the same promise so the next caller after it settles
      // starts a fresh exchange rather than reusing a resolved one.
      pendingRefresh = null
    }
  })()

  return pendingRefresh
}
