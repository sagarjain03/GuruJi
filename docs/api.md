# GuruJi — API Design

> NestJS 12 · REST + one WebSocket namespace
> Base path: `/api` · Last updated: 2026-09-18

---

## Conventions

| Aspect | Decision |
|---|---|
| Casing | `camelCase` JSON both directions. Web and API share `packages/types`, so there is nothing to convert |
| Dates | ISO-8601 UTC with `Z`. Always. Never a local time, never an offset |
| Ids | UUID strings |
| Auth | `Authorization: Bearer <accessToken>`; refresh token in an httpOnly cookie |
| Validation | `class-validator` DTOs at the controller edge; Zod at the `packages/types` boundary |
| Versioning | None yet. Single client, one repo. Adding `/v1` before a second consumer exists is speculative |

### Why `camelCase` on the wire

A snake_case wire format plus interceptors is a common pattern, and it is the
right call when the backend cannot share types with the frontend. Here it can.
Shared types make the conversion layer pure overhead — and conversion layers are
a classic source of "field silently arrived as `undefined`" bugs. One format,
one definition, compile-time enforcement.

---

## Response envelope

Success returns the resource directly. Collections are wrapped for pagination:

```jsonc
// GET /api/problems?limit=20
{
  "items": [ /* ... */ ],
  "nextCursor": "eyJpZCI6IjAxOTIt...",
  "hasMore": true
}
```

Errors are uniform, produced by one global exception filter:

```jsonc
{
  "error": {
    "code": "PROBLEM_NOT_FOUND",
    "message": "Problem not found.",
    "details": null,
    "requestId": "01925f3c-..."
  }
}
```

`code` is a stable machine-readable string the client branches on; `message` is
human-readable and safe to display. Internal errors never leak a stack trace,
a query, or a provider message — the filter logs those against `requestId` and
returns a generic message.

### Pagination

Cursor-based, not offset. Problem lists and submission history are both ordered
by `createdAt desc` and both grow; offset pagination skips or repeats rows when
new entries land mid-scroll, and gets slower the deeper you go.

---

## Modules and routes

### `auth`

| Method | Route | Notes |
|---|---|---|
| POST | `/auth/register` | Creates `User` + `Profile` + first `DailyGoal` in one transaction |
| POST | `/auth/login` | Rate-limited per IP and per email |
| POST | `/auth/refresh` | Rotates the refresh token; reuse of a rotated token revokes the chain |
| POST | `/auth/logout` | Revokes the current refresh token |
| GET | `/auth/me` | Current user + profile |

Login failures return one message for both "unknown email" and "wrong password".
Distinguishing them turns the endpoint into an account-enumeration oracle.

### `topics` / `patterns` / `roadmap`

| Method | Route | Notes |
|---|---|---|
| GET | `/topics` | Cached; includes the caller's mastery when authenticated |
| GET | `/topics/:slug` | Topic detail with prerequisites and problems |
| GET | `/patterns` | Cached |
| GET | `/roadmap` | Full tree from `RoadmapNode`, cached, overlaid with user progress |

### `problems`

| Method | Route | Notes |
|---|---|---|
| GET | `/problems` | Filter by `topic`, `pattern`, `difficulty`, `status`, `q`; cursor pagination |
| GET | `/problems/:slug` | Statement, examples, **sample test cases only** |
| GET | `/problems/:slug/hints` | Curated hints, returned one level at a time |
| GET | `/problems/:slug/submissions` | Caller's own history for this problem |

Hidden test cases are excluded in the repository layer, not the controller — a
new endpoint cannot accidentally expose them.

### `submissions`

| Method | Route | Notes |
|---|---|---|
| POST | `/submissions` | `{ problemId, language, code, isRun, timeSpentMs }` → `202 Accepted` with a submission id |
| GET | `/submissions/:id` | Ownership-checked |
| GET | `/submissions` | Caller's history, cursor-paginated |

`POST` returns immediately; the verdict arrives over WebSocket. Code size is
capped (64 KB) and the language must be in the supported enum — both validated
before anything is enqueued.

### `revision`

| Method | Route | Notes |
|---|---|---|
| GET | `/revision/due` | Items due now, ordered by `dueAt` |
| GET | `/revision/upcoming` | Next 7 days, for the calendar |
| POST | `/revision/:id/complete` | `{ outcome: SOLVED_EASILY \| SOLVED_WITH_EFFORT \| STRUGGLED \| FAILED }` → new `dueAt` |

### `mistakes`

| Method | Route | Notes |
|---|---|---|
| POST | `/mistakes` | Log a mistake against a submission |
| GET | `/mistakes` | Filter by category |
| GET | `/mistakes/patterns` | Aggregated: "3 sliding-window problems, same off-by-one" |

### `recommendations`

| Method | Route | Notes |
|---|---|---|
| GET | `/recommendations/next` | The **TRAIN NOW** endpoint — one best next activity, with a reason |
| GET | `/recommendations` | Ranked list with scores and reasons |
| POST | `/recommendations/:id/dismiss` | Feedback signal |

Every response carries `reason`. A recommendation the user cannot interrogate is
indistinguishable from a random pick.

### `analytics`

| Method | Route | Notes |
|---|---|---|
| GET | `/analytics/overview` | Dashboard summary |
| GET | `/analytics/activity` | Daily counts over a range, for the heatmap |
| GET | `/analytics/topics` | Per-topic mastery and accuracy |
| GET | `/analytics/trends` | Accuracy and solve-time over time |

Range parameters are bounded server-side. An unbounded `from`/`to` is a
cheap way to ask the database for everything.

### `ai`

| Method | Route | Notes |
|---|---|---|
| POST | `/ai/hint` | `{ problemId, level }` — escalates one step at a time |
| POST | `/ai/explain` | `{ topic \| patternId }` |
| POST | `/ai/analyze-code` | `{ problemId, language, code }` → structured analysis |
| POST | `/ai/explain-wrong-answer` | `{ submissionId }` |
| POST | `/ai/generate-problem` | Admin-only; output enters the validation pipeline, never the live table |

Every AI route is rate-limited per user, not just per IP — these cost money and
are the obvious abuse target. Requests carry a `problemId`, never problem text.

### `contests`

`POST /contests` (start), `GET /contests/:id`, `POST /contests/:id/finish`,
`GET /contests/:id/report`.

### `health`

`GET /health` (liveness), `GET /health/ready` (readiness — checks Postgres,
Redis and the runner). Neither requires auth; neither reveals versions or
internals.

---

## WebSocket

One namespace: `/ws`. Authenticated with the access token at handshake, then
joined to a per-user room. Events are server → client only:

| Event | Payload |
|---|---|
| `submission:status` | `{ submissionId, status }` |
| `submission:result` | `{ submissionId, verdict, passedCount, totalCount, runtimeMs, memoryKb }` |
| `mastery:updated` | `{ topicId, masteryScore }` |

The socket carries notifications, never commands. Everything that mutates state
goes through an authorised, validated, rate-limited HTTP route.

---

## Authorisation

Two rules, applied without exception:

1. **`userId` comes from the verified token.** Never from a body, query or path
   parameter. A route that accepts a `userId` from the client is a bug.
2. **Ownership is checked in the query, not after it.** `findFirst({ where: { id, userId } })`
   rather than fetch-then-compare — the latter leaks existence through timing
   and through careless error handling.

Admin-only routes (`/ai/generate-problem`, problem review) are guarded by role
*and* re-checked in the service.

---

## Rate limits

| Scope | Limit |
|---|---|
| Global per IP | 100 req / min |
| `/auth/login`, `/auth/register` | 5 / 15 min per IP, and per email |
| `POST /submissions` | 10 / min per user |
| `/ai/*` | 20 / min per user, plus a daily token budget |

Limits live in Redis so they hold across API instances.

---

## Caching

| Cached | TTL | Invalidated by |
|---|---|---|
| Topic and pattern lists | 1 hour | admin content change |
| Roadmap tree | 1 hour | admin content change |
| Problem metadata (list page) | 10 min | problem publish/update |
| Recommendations per user | 15 min | any submission by that user |

User-specific overlays (mastery, solved status) are never served from a shared
cache key. The cache key includes `userId` where the response varies by user —
the alternative is one user seeing another's progress, which is the worst
possible caching bug.

---

## Documentation

OpenAPI is generated from the DTOs via `@nestjs/swagger` and served at
`/api/docs` in non-production environments only. Hand-written API docs drift;
generated ones cannot.
