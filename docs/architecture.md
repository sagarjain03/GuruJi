# GuruJi — Architecture

> Status: **Phase 0 — design agreed, implementation not started.**
> Last updated: 2026-09-18

This document is the single source of truth for how GuruJi is put together and
*why*. If an implementation disagrees with this document, one of the two is a
bug — fix the disagreement, don't ignore it.

---

## 1. What we are building

GuruJi is a personal DSA training system. The product claim is not "a site with
DSA questions on it" — it is:

> This app knows what I am weak at and tells me exactly what I should practice next.

Everything in this architecture exists to serve one loop:

```
Discover problem → Understand → Think → Code → Run → Submit → Result
      ↑                                                          ↓
Next recommendation ← Schedule revision ← Update mastery ← Analyse mistake
```

Any component that does not feed this loop is out of scope for the MVP.

### Design consequences

Because the loop is the product, three things are *structural quality bars*, not
features to bolt on later:

| Bar | Why it is structural |
|---|---|
| Real code execution | Fake results would poison mastery, revision and recommendations — every downstream signal is derived from real submission outcomes. |
| Real signals | Mastery is computed from accuracy, time, hints and retention. Seeding fake numbers makes the whole engine meaningless. |
| Sandbox isolation | We execute untrusted code by design. This is the single largest security surface in the system. |

---

## 2. Repository shape

A pnpm workspace monorepo. Three deployable apps, six shared packages.

```
guruji/
├── apps/
│   ├── web/            Next.js 16 (App Router) — all UI
│   ├── api/            NestJS 12 — all business logic, the only DB writer
│   └── code-runner/    Isolated execution service — the only thing that runs user code
├── packages/
│   ├── database/       Prisma schema, client singleton, migrations, seed
│   ├── types/          Shared DTO/contract types + Zod schemas (web <-> api)
│   ├── ai/             LLM provider abstraction, prompts, response schemas
│   ├── algorithms/     Algorithm step-event generators for the visualiser
│   ├── ui/             Shared shadcn/ui-based components and design tokens
│   └── config/         Shared tsconfig / eslint / prettier presets
├── docker/             Sandbox images + service Dockerfiles
├── docs/               This folder
├── scripts/            Dev/ops scripts
└── docker-compose.yml  Local Postgres + Redis
```

### Why a monorepo and not three repos

The contract between web and api changes on almost every feature. In separate
repos that contract drifts and you find out at runtime. Here `packages/types`
holds one definition, both sides import it, and `pnpm typecheck` fails at build
time when they disagree. That is worth the monorepo tooling cost.

### Why not microservices

`code-runner` is a separate service because it has a *different trust level* and
different resource limits — that is a real reason. Nothing else has one. Auth,
problems, submissions, mastery, revision, AI: all one NestJS app, separated by
modules. Splitting them would buy distributed-transaction problems and buy
nothing back.

---

## 3. Service responsibilities

### `apps/web` — Next.js 16

Owns: rendering, routing, client state, the editor and visualiser UI.
Never owns: business rules, mastery maths, or direct database access.

- **Server Components by default.** Client Components only where interactivity
  demands it (editor, visualiser, forms, charts).
- Reads go through TanStack Query; UI-only state goes to Zustand. The split rule
  is in [section 8](#8-state-management).
- The Groq key never reaches this app. AI calls go web → api → Groq.

### `apps/api` — NestJS 12

The only process that talks to Postgres. Module boundaries mirror the domain:

```
auth  users  topics  patterns  problems  submissions
revision  mistakes  mastery  recommendations  analytics
ai  contests  achievements  health
```

Each module is `controller → service → repository`. Controllers validate and
authorise; services hold rules; repositories hold Prisma queries. A service
never imports another module's repository — it goes through that module's
service, so ownership checks cannot be bypassed.

### `apps/code-runner` — execution service

Accepts a job, runs it inside a locked-down container, returns a result. It has
no database credentials, no Groq key, and no route reachable from the public
internet. Full threat model in [code-execution.md](./code-execution.md).

---

## 4. Request flows

### Submission (the critical path)

```
Browser ──POST /submissions──▶ API
                                 │ 1. authn + ownership check
                                 │ 2. validate payload
                                 │ 3. persist Submission (status = QUEUED)
                                 │ 4. enqueue job (BullMQ on Redis)
                                 ▼
                           Redis queue
                                 │
                                 ▼
                           code-runner worker
                                 │ spawn sandbox per test-case batch
                                 │ enforce cpu / memory / pids / no-net / timeout
                                 ▼
                           results ──▶ API callback
                                          │ 5. persist SubmissionResult rows
                                          │ 6. recompute topic + pattern mastery
                                          │ 7. schedule / reschedule revision
                                          │ 8. invalidate recommendation cache
                                          ▼
                                  WebSocket push ──▶ Browser
```

Steps 5–8 run inside **one database transaction**. A submission that updates
mastery but fails to schedule revision would silently corrupt the learning
model, so it is all-or-nothing.

The browser gets the verdict over a WebSocket rather than polling — a submission
takes seconds, and polling at that granularity is wasteful and feels worse.

### AI hint

```
Browser ──POST /ai/hint──▶ API
                             │ rate-limit per user
                             │ load problem context from DB (not from the client)
                             │ build layered prompt: system / developer / context / user
                             ▼
                       packages/ai → GroqProvider
                             │
                             ▼
                       validate response with Zod
                             │ malformed → one bounded retry → else structured error
                             ▼
                       persist AIMessage, return hint
```

Problem context is loaded server-side from the database. The client sends a
problem id, never problem text — otherwise a user could rewrite the problem to
manipulate the mentor into handing over a solution.

---

## 5. Data layer

PostgreSQL 17 + Prisma. Full schema rationale in [database.md](./database.md).

Rules that apply everywhere:

- **All timestamps are `TIMESTAMPTZ`, stored in UTC.** The API emits ISO-8601
  with a `Z` suffix. Only the browser converts to local time, at render time.
- SQL identifiers are `snake_case`; TypeScript is `camelCase`; Prisma's `@map`
  bridges the two. The wire format between web and api is `camelCase` JSON —
  there is no case-conversion interceptor, because both sides import
  `packages/types` and there is nothing to translate.
- Soft-delete only where a real product requirement exists. We do not add
  `deletedAt` to every table by reflex.
- Every foreign key is declared. Every column used in a `WHERE` or `ORDER BY` on
  a hot path has an index, and each index is justified by a named query.

### Redis

Two distinct uses, which must not be confused:

1. **Queues (BullMQ)** — submission jobs, AI problem-generation jobs. Durable.
2. **Cache** — roadmap tree, topic/pattern lists, problem metadata,
   recommendation results. Disposable; every cached value has a TTL and a
   documented invalidation trigger.

Losing the cache must never lose data. Losing the queue loses in-flight
submissions, which is acceptable — the user resubmits — but nothing else goes
there.

---

## 6. The intelligence layer

Three engines. Each is pure, deterministic, unit-tested, and lives in its own
NestJS module with no framework coupling in the maths.

| Engine | Input | Output | Doc |
|---|---|---|---|
| Mastery | submissions, times, hints, retention | 0–100 score per topic and pattern | [mastery-model.md](./mastery-model.md) |
| Revision | submission outcome, prior interval, ease | next due date | [revision-engine.md](./revision-engine.md) |
| Recommendation | mastery + revision + history | ranked next activity | [recommendation-engine.md](./recommendation-engine.md) |

**These three are deliberately not AI.** They are transparent, explainable
formulas. A user must be able to ask "why was I shown this?" and get a real
answer, and we must be able to unit-test that answer. The LLM's job is teaching
and explanation — not deciding what you practise.

---

## 7. AI architecture

```
AIService                       ← business logic, rate limits, persistence
   └── LLMProvider (interface)  ← the seam
         └── GroqProvider       ← the only implementation today
```

Nothing outside `packages/ai` imports the Groq SDK. Swapping providers means
writing one class. Prompt layering and injection defence in [ai.md](./ai.md).

The mentor's behavioural rule: **progressive hints, never the answer first.**
The full solution is returned only on an explicit, separate user action, and
that action is recorded — hint dependency is a mastery input.

---

## 8. State management

| State | Home | Example |
|---|---|---|
| Server data | TanStack Query | problem list, submissions, mastery, revision queue |
| Ephemeral UI | Zustand | editor language, theme, visualiser play/pause/speed |
| Form state | React Hook Form + Zod | auth forms, mistake journal entry |
| URL state | search params | filters, pagination, active tab |

The rule: **if it came from the server, it does not go in Zustand.**
Duplicating server data into a client store is how stale UI happens.

Mutations use optimistic cache updates rather than blanket `invalidateQueries`,
so the UI never flashes on submit.

---

## 9. Security posture

Threats we are actually defending against, in priority order:

1. **Malicious submitted code** — the sandbox. See [code-execution.md](./code-execution.md).
2. **Prompt injection** — layered prompts, server-side context, schema-validated
   output. See [ai.md](./ai.md).
3. **Broken object-level authorisation** — every query touching user-owned rows
   filters by `userId` taken from the verified token, never from the request body.
4. **Credential leakage** — no secret is ever `NEXT_PUBLIC_*`. `.env.example`
   documents every variable; `.env` is git-ignored.

Passwords are hashed with Argon2id. Sessions are short-lived access JWTs plus
rotating refresh tokens in httpOnly, SameSite cookies. Detail in
[security.md](./security.md).

---

## 10. Technology choices and their trade-offs

| Choice | Alternative considered | Why this one |
|---|---|---|
| Next.js 16 App Router | Vite SPA | Server Components cut client JS on content-heavy pages (roadmap, problem list) and help first load. Cost: the editor page is aggressively client-side anyway, so we get least benefit exactly where the app is heaviest. Accepted. |
| Two CSS systems, split by route group | One system everywhere | See §13. |
| NestJS | Next.js route handlers only | ~14 modules with real service layers and background workers. Route handlers would become an unstructured pile. Cost: a second deployable. Accepted. |
| Prisma 7 (stable) | Prisma 8 (RC) | 8.x is release-candidate as of today. We do not build a foundation on an RC. Revisit when 8.x is stable. |
| PostgreSQL | MySQL | Richer types, better window functions for analytics, `TIMESTAMPTZ`. |
| BullMQ on Redis | Direct HTTP to runner | Backpressure and retries for free; the API stays responsive under a submission burst. Cost: Redis is on the critical path for submissions. |
| Groq | OpenAI / Anthropic | Latency. Hints must feel instant, and inference speed is the differentiator. Mitigated by the `LLMProvider` seam. |
| Self-hosted Docker sandbox | Third-party judge API | Control over limits, no per-execution cost, no user code leaving our infrastructure. Cost: we own the security problem. Accepted deliberately — see the threat model. |

---

## 11. Non-goals

Explicitly **not** being built, and not designed for beyond keeping the seams
clean: collaborative editing, a public community question bank, an AI mock
interviewer, a mobile app, offline mode, and contest tooling beyond a private
timed session.

Gamification stays deliberately thin. A user who solves 500 problems without
understanding must not out-rank one who deeply understands 200 — so XP and
streaks are **never** inputs to mastery.

---

## 12. Open questions

Tracked here until decided, then moved into the relevant doc.

- **Problem sourcing at scale.** Seed data is original or openly licensed only.
  Beyond that, importing third-party statements has licensing constraints.
  Current position: store metadata + source URL + our own explanation, and link
  out for the original statement.
- **Contest concurrency.** Timed sessions are single-user for the MVP; the
  schema keeps a `Contest` entity so multi-user is not blocked later.
- **Sandbox host in production.** gVisor / Firecracker vs hardened Docker. The
  MVP ships hardened Docker; revisit before any public deployment.

---

## 13. The UI stack, and why there are two CSS systems

`apps/web` is split by App Router route group, and the two halves are styled
differently on purpose.

```
src/app/
├── (marketing)/    landing page — plain per-component CSS
└── (app)/          the product — Tailwind 4 + shadcn/ui
```

### Why the landing page is plain CSS

It was built to a fixed visual specification whose measured values — type scale,
stagger delays, scrim gradient stops, breakpoints — are the design. Rewriting
those as utility classes would mean re-deriving every number, and the only thing
gained is consistency with a system the page does not otherwise use. It is one
page. It is finished. It does not get touched.

### Why the product is Tailwind + shadcn/ui

The app is roughly fifty screens that share a component vocabulary: buttons,
dialogs, dropdowns, tabs, toasts, tooltips, command palette. shadcn/ui is Radix
underneath, which means keyboard handling, focus trapping and ARIA wiring are
already correct. Hand-building forty accessible components to keep one CSS
system is the wrong trade by a wide margin — and accessibility is the thing that
quietly does not get done when every component is bespoke.

### The cost, stated plainly

Two styling idioms in one application is a real maintenance cost: a new
contributor has to know which half they are in, and a component cannot be moved
between halves without a rewrite. We accept it because the boundary is a route
group rather than a judgement call — if the file is under `(marketing)/`, it is
plain CSS; otherwise Tailwind. There is no third case, and nothing is shared
across the line.

### Motion

Framer Motion for interface motion — page transitions, list stagger, layout
shifts. Effects lifted from libraries like Aceternity are copy-pasted Tailwind
and add no dependency. `anime.js` is deliberately *not* added here; if the
algorithm visualiser (Phase 9) turns out to need a timeline primitive, that is
the moment to evaluate it, not before.
