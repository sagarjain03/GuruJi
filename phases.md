# GuruJi — Implementation Phases

> **What this file is:** the execution order. Each phase is split into numbered
> steps small enough to finish, verify and commit in one sitting.
>
> **What this file is not:** the task list (that is [`TODO.md`](./TODO.md)) or the
> reasoning behind the ordering (that is [`docs/roadmap.md`](./docs/roadmap.md)).
> When a step is done, tick the matching boxes in `TODO.md` — this file stays as
> the recipe.
>
> Last updated: 2026-09-18

---

## How to use this

Work one **step** at a time, never a whole phase at once:

1. Read the step's _Build_ list and the docs it points at.
2. For engine work (Phases 5, 6, 7) write the tests first — they are listed before
   the implementation on purpose.
3. Run the step's _Verify_ check. It must pass before moving on.
4. Commit: `type(scope): what changed`, one step per commit.

A phase is finished only when its **Gate** passes. Gates are not waivable —
especially Phase 4's.

---

## Current state — read before starting

| Area                 | State                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web`           | Scaffolded. Next 16, React 19, Tailwind 4, some shadcn primitives, marketing page, app shell, empty dashboard, theme provider. **No auth, no data, no API calls.** |
| `apps/api`           | Empty directory                                                                                                                                                    |
| `apps/code-runner`   | Empty directory                                                                                                                                                    |
| `packages/*`         | All six directories empty                                                                                                                                          |
| `docker/`            | Empty                                                                                                                                                              |
| `docker-compose.yml` | Written (Postgres 17 + Redis 7, UTC, healthchecks) — **never brought up**                                                                                          |
| Docs                 | 13 documents, complete                                                                                                                                             |
| Sandbox spike        | Done — [`docs/code-execution.md`](./docs/code-execution.md#spike-results--2026-09-18)                                                                              |

**Hard blocker:** the Docker daemon must be running before Phase 1 step 1.2.

---

## Phase 0 — Analysis & design 🟡

Everything is done except owner sign-off on the phase plan. Confirm it, tick the
last box in `TODO.md`, move on.

**Gate:** architecture, schema shape, module boundaries and MVP order are agreed.

---

## Phase 1 — Foundation · size L

**Goal:** a registered user logs in and lands on the dashboard.

Reference: [`docs/architecture.md`](./docs/architecture.md),
[`docs/api.md`](./docs/api.md), [`docs/database.md`](./docs/database.md),
[`docs/security.md`](./docs/security.md)

### 1.1 — Shared config presets

**Build:** `packages/config` — tsconfig, eslint and prettier presets exported as
files other packages extend. Point `apps/web` at them so the workspace has one
source of style truth.
**Verify:** `pnpm -r typecheck && pnpm -r lint`

### 1.2 — Infrastructure up

**Build:** `.env` from `.env.example`. Start the Docker daemon.
**Verify:** `pnpm infra:up`, then `docker compose ps` shows both containers
healthy, and `SHOW timezone;` in Postgres returns `UTC`.

### 1.3 — Database package

**Build:** `packages/database` — Prisma schema with `User`, `Profile`,
`RefreshToken`. All timestamps `TIMESTAMPTZ`. Client **singleton** — one instance
cached on `globalThis`, so hot reload does not open a new pool on every save.
**Verify:** `pnpm db:migrate`, then `pnpm db:studio` shows the three tables.

### 1.4 — API bootstrap

**Build:** NestJS in `apps/api` — global prefix, CORS allow-list, Helmet, global
`ValidationPipe` (`whitelist` + `forbidNonWhitelisted`), global exception filter
emitting the error envelope from `docs/api.md`, structured logger with a
per-request correlation id, env validation that **refuses to boot** on a missing
required variable, `GET /health` and `GET /health/ready`.
**Verify:** `/health` returns 200; removing a required env var makes startup fail
loudly instead of half-starting.

### 1.5 — Shared contracts

**Build:** `packages/types` — auth DTOs and the error envelope as types + Zod
schemas. Both `web` and `api` import from here; neither redefines them.
**Verify:** `pnpm -r typecheck`

### 1.6 — Auth (tests first)

**Build:** unit tests for Argon2id hashing and token issue/rotate/revoke, then
register / login / refresh / logout / me. Access JWT + rotating refresh token in
an httpOnly cookie. **Refresh-token reuse detection revokes the whole chain.**
Rate limits on login and register, per IP _and_ per email.
**Verify:** e2e — register → login → refresh → protected route → logout. Plus the
reuse test: replaying a rotated token kills the chain.

### 1.7 — Web auth wiring

**Build:** TanStack Query provider, Zustand store skeleton, register and login
pages (React Hook Form + Zod against `packages/types`), token handling,
protected-route middleware, dashboard behind auth. Reuse the existing app shell
and theme provider — do not rebuild them.
**Verify:** register in the browser, land on the dashboard, reload, still signed in.

### Gate 1 🚪 — passed

What was built and why: [`docs/phases/phase1.md`](./docs/phases/phase1.md).

`pnpm dev` starts both apps · register → login → dashboard works · `pnpm build`,
`pnpm typecheck`, `pnpm lint` all clean.

---

## Phase 2 — Question platform · size L

**Goal:** browse and read problems.

Reference: [`docs/database.md`](./docs/database.md), [`docs/api.md`](./docs/api.md)

### 2.1 — Content schema

**Build:** `Topic`, `Pattern`, `RoadmapNode`, `Problem`, `ProblemTopic`,
`ProblemPattern`, `TestCase`, `Hint`, plus every index listed in
`docs/database.md`.
**Verify:** the migration applies cleanly on a fresh database.

### 2.2 — Seed

**Build:** 14 topics, 12 patterns, the full roadmap tree with prerequisites, and
original problems covering every difficulty and several patterns — each with real
test cases and curated hints. **Idempotent: `upsert` by slug.**
**Verify:** run `pnpm db:seed` twice; row counts are identical.

### 2.3 — Read API

**Build:** `GET /topics`, `/topics/:slug`, `/patterns`, `/roadmap` (full tree,
cached, overlaid with user progress), `/problems` (filter by
topic/pattern/difficulty/status/`q`, cursor pagination), `/problems/:slug`
(sample test cases only). **Hidden test cases are excluded in the repository
layer, not the controller.** Redis caching with documented invalidation.
**Verify:** tests — hidden cases never appear in any response; cursor pagination
stays stable when rows are inserted mid-scroll; filter combinations return the
correct sets.

### 2.4 — Roadmap & problem UI

**Build:** roadmap page rendered from the database (never hard-coded); problem
list with filters in URL search params and infinite scroll; problem detail with
Markdown statement (allow-list sanitisation), constraints, examples, metadata.
Loading / empty / error states for each.
**Verify:** filters survive a reload via the URL; a crafted `<script>` inside a
statement does not execute.

### Gate 2 🚪

The roadmap renders from the database; the problem list filters and paginates
without fetching everything.

---

## Phase 3 — Code editor · size M

**Goal:** write code against a problem and never lose it.

### 3.1 — Monaco

**Build:** Monaco integration **configured without `unsafe-eval`**, so the CSP in
`docs/security.md` stays real. Language switcher for C++, C, Python, JavaScript;
per-language starter code loaded from the problem.
**Verify:** the page loads with the production CSP applied, no console violations.

### 3.2 — Drafts

**Build:** draft save/load endpoints keyed on (user, problem, language); debounced
client-side persistence.
**Verify:** tests — a draft survives a reload; switching language does not destroy
the other language's draft.

### 3.3 — Workspace layout

**Build:** resizable split — statement / editor / results. Test-case panel with
custom input. Submission history panel (`GET /problems/:slug/submissions`).
Editor preferences in Zustand (font size, theme, tab width).
**Verify:** manual pass at desktop widths; preferences persist across reloads.

### Gate 3 🚪

Write code, switch language, reload — the code is still there.

---

## Phase 4 — Code runner 🔴 · size XL

**Goal:** Run and Submit produce real verdicts.

Reference: [`docs/code-execution.md`](./docs/code-execution.md) — read the spike
results before writing anything. **This phase's gate does not get waived.**

### 4.1 — Sandbox images

**Build:** `docker/` images per language, pinned base tags, no shell, no package
manager, non-root user. Image build script.
**Verify:** trying to `docker run` the image with a shell fails.

### 4.2 — Worker skeleton

**Build:** `apps/code-runner` service, BullMQ queue + worker, bounded concurrency,
retry with a dead-letter path.
**Verify:** enqueue a no-op job and watch the queue drain.

### 4.3 — Sandbox controls

**Build:** every flag, none optional — `--network none`, `--memory 256m` with
`--memory-swap` equal, `--cpus 1.0`, `--pids-limit 64`, `--read-only` root,
`--tmpfs /tmp` with `noexec,nosuid`, `--cap-drop ALL`,
`--security-opt no-new-privileges`, `--ulimit fsize`. Timeout enforced **twice**
— inside the container and by the worker. Output capped at 64 KB, truncated at
the source **and the container still killed**. Compilation runs under the same
limits with its own longer timeout.

> **Carried from the Phase 1 spike:** killing the `docker run` client does **not**
> kill the container. Run detached (`docker run -d --name`) and `docker kill <id>`
> on timeout, on cancel and on every error path. A reaper for orphans is a
> backstop, not the primary mechanism.

**Verify:** start a long job, kill the worker, confirm no container survives.

### 4.4 — Submission pipeline

**Build:** `POST /submissions` → `202` + id, validated and enqueued. Runner → API
callback authenticated with a shared secret. Submission-completion transaction
(results + verdict; mastery hooks land in Phase 5). WebSocket namespace with
`submission:status` / `submission:result`.
**Verify:** submit from the browser, watch the status change live, get a verdict.

### 4.5 — Result UI

**Build:** Run against samples · Submit against all. Live status over WebSocket.
Result panel — per-test results, runtime, memory, compile errors.
**Verify:** every verdict type renders correctly.

### Gate 4 🚪 — adversarial suite, every row must pass

Infinite loop → `TIME_LIMIT_EXCEEDED`, container reaped, host CPU normal ·
fork bomb blocked by `pids-limit` · 4 GB allocation → `MEMORY_LIMIT_EXCEEDED`,
OOM inside the container only · output flood truncated at 64 KB with a bounded
database write · filesystem probe reaches nothing sensitive · a write outside
`/tmp` fails · write-then-execute in `/tmp` fails · HTTP and DNS both fail ·
filling `/tmp` is bounded by tmpfs · a C++ compile-time memory bomb is bounded
and returns `COMPILE_ERROR` · 100 concurrent submissions drain with no host
degradation · `INTERNAL_ERROR` is never recorded against user accuracy.

**Contained _and_ the correct verdict. Both.**

---

## Phase 5 — Progress engine · size M

**Goal:** the system knows how well you are doing.
Reference: [`docs/mastery-model.md`](./docs/mastery-model.md)

### 5.1 — Schema

`UserTopicProgress`, `UserPatternProgress` (unique on user+topic / user+pattern),
`Mistake` + categories, `StudySession`.

### 5.2 — Mastery formula (tests first) 🧪

Write the failing tests before the formula: zero attempts → 0 with the no-data
flag · one perfect solve → low, not 100 (confidence damping) · all failures → 0,
no division by zero · hint-heavy solves score materially lower than unaided ones ·
hard solves outscore an equal count of easy ones · one pattern repeated is capped
by `patternCoverage` · every component maxed → exactly 100 · the weight config
sums to the documented total · `isRun` submissions and `INTERNAL_ERROR` are
excluded. Then implement, with **every weight in one config object**.

### 5.3 — Write path

Progress updated **inside** the submission transaction, incrementally. A nightly
reconciliation job recomputes from source and **logs drift rather than silently
correcting it** — drift means a write path is broken, and hiding it hides the bug.

### 5.4 — Mistakes & dashboard

`POST /mistakes`, `GET /mistakes`, `GET /mistakes/patterns`,
`GET /analytics/overview`. Dashboard mastery bars on real numbers, a mastery
breakdown that answers "why is my Graphs score 40?", the mistake journal, the
streak display.

**Gate 5 🚪** every degenerate case above is unit-tested and passing.

---

## Phase 6 — Revision engine · size M

**Goal:** solved problems come back at the right time.
Reference: [`docs/revision-engine.md`](./docs/revision-engine.md)

### 6.1 — Schema

`RevisionItem` — interval, ease, repetitions, lapses, state, `dueAt`. Index on
`(userId, dueAt)`, the hottest query in the product.

### 6.2 — Scheduler (tests first) 🧪

First solve schedules at day 1 · success advances the ladder × ease ·
`STRUGGLED` halves without advancing, floor of 1 day · `FAILED` resets,
increments lapses, sets `LAPSED` · ease clamps at both ends · `MASTERED` needs
_consecutive_ successes, not one · day-cap overflow carries forward, never
dropped · a 30-day absence re-spaces instead of dumping · due-today is correct
across a DST transition · revision and mastery commit atomically (a forced
failure rolls both back).

Then implement the SM-2-derived scheduler, scheduling inside the submission
transaction, with a configurable daily cap. **Due-today resolves against the
user's IANA timezone, not UTC midnight.**

### 6.3 — API & UI

`GET /revision/due`, `/revision/upcoming`, `POST /revision/:id/complete`.
Revision dashboard, due-today queue, outcome capture after a revision solve,
upcoming-week calendar.

**Gate 6 🚪** scheduling is deterministic across success / struggle / fail.

---

## Phase 7 — Recommendation engine · size L

**Goal:** **TRAIN NOW** knows what to do.
Reference: [`docs/recommendation-engine.md`](./docs/recommendation-engine.md)

### 7.1 — Candidates & scoring (tests first) 🧪

Weak topic ranks above strong, all else equal · recently solved ranks below an
equivalent unsolved · a failed revision beats new material · difficulty adapts
upward as mastery rises · no duplicate across consecutive batches · topic
diversity holds · an unmet prerequisite scores **zero**, not merely low · a
cold-start user gets roadmap order with honest reasons · every recommendation has
a non-empty reason.

Then: four bounded candidate pools (~50 candidates), scoring with the documented
weights, a diversity filter (max 2 per topic in the top 5, always one outside the
weakest topic), and **reasons derived from the scoring breakdown — never
LLM-written**.

### 7.2 — API

`GET /recommendations/next` with the precedence ladder, `GET /recommendations`,
`POST /recommendations/:id/dismiss`. Redis cache, 15 min, invalidated on any
submission by that user.

### 7.3 — UI & onboarding

Dashboard **TRAIN NOW** as the single most visible action. "Today's Training"
panel — revision due / new / weak topic / challenge. A reason shown on every
recommendation. Onboarding flow: experience, language, initial assessment that
seeds mastery.

**Gate 7 🚪** everything in 7.1 passing.

---

## Phase 8 — AI mentor · size L — _MVP ends here_

**Goal:** a mentor that teaches instead of answering.
Reference: [`docs/ai.md`](./docs/ai.md), [`docs/security.md`](./docs/security.md)

### 8.1 — Provider seam

`packages/ai` — `LLMProvider` interface + `GroqProvider`. **Nothing outside this
package imports `groq-sdk`.** Two model tiers (fast for hints, quality for
analysis), ids from config. Four-layer prompt assembly with user content fenced
and labelled untrusted. A Zod schema per mode, one bounded retry, then a
structured error.

### 8.2 — Conversation storage

`AIConversation`, `AIMessage` with `hintLevel` and token usage.

### 8.3 — Endpoints

`POST /ai/hint` (curated hints first, the model only when they run out) ·
`/ai/explain` (intuition → example → implementation → complexity → mistakes) ·
`/ai/analyze-code` (direction, not replacement code) · `/ai/explain-wrong-answer`
(stops before the correction) · `/ai/generate-problem` (admin only, full
validation pipeline, never auto-published). Per-user rate limits and a daily
token budget in Redis. **A provider failure returns an honest error, never a fake
hint.**

### 8.4 — Mentor UI

Panel on the problem page. Progressive hint UI whose level survives a reload.
"Show solution" as a separate, deliberate, recorded action. Code analysis and
wrong-answer views.

### Gate 8 🚪

Hints escalate and never open with the solution · the injection suite extracts
nothing ("ignore previous instructions", "reveal your system prompt", payloads
hidden in code comments and variable names) · malformed model output retries once
then errors cleanly · a generated problem whose reference solution fails its own
tests is rejected · hint usage is recorded and lowers mastery.

### 🎯 MVP complete — the full loop runs on real data

---

## Post-MVP

Do not start these before Gate 8. Task detail lives in `TODO.md`.

| Phase | Name         | Size | Shape                                                                                                                                                                                                                                     |
| ----- | ------------ | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9     | Visualiser   | XL   | `packages/algorithms` step-event model → five canvases (array, node-chain, tree, graph, table). Single rAF loop. Exact step-back (`index − 1`). Accessible, with capped input sizes. **Exit test: adding an algorithm touches no React.** |
| 10    | Analytics    | M    | Server-bounded ranges, Recharts views, profile page. **No new signals invented** — everything already exists by this point.                                                                                                               |
| 11    | Mock contest | M    | `Contest`, `ContestProblem`, `ContestSubmission`. Timer, hints off by default, a post-contest report naming the weak area. Assessment framing, not leaderboards.                                                                          |
| 12    | Polish       | L    | Accessibility pass, responsive pass, states everywhere, performance budget, security review, the full Playwright journey, Sentry. Light gamification that **never feeds mastery**.                                                        |

---

## Rules that apply in every phase

- Tests before implementation for the three engines (5, 6, 7) — non-negotiable.
- `pnpm build` before every commit; a dev server hides `TS6133` orphans.
- Every endpoint validates input and checks ownership in the `WHERE` clause.
- All timestamps UTC — `TIMESTAMPTZ` in the database, the browser converts.
- No secret is `NEXT_PUBLIC_*`.
- Docs are updated in the same PR as the behaviour change.

## Risks to watch

| Risk                                         | Phase | If it happens                                                          |
| -------------------------------------------- | ----- | ---------------------------------------------------------------------- |
| Sandbox containment cannot be proven         | 4     | Everything after is blocked → move to a third-party judge and re-cost  |
| Groq latency makes hints feel slow           | 8     | The `LLMProvider` seam makes a provider swap one class                 |
| Tailwind 4 + Next 16 + shadcn setup friction | 1     | Budget it explicitly; do not discover it mid-feature                   |
| Original problem authoring is slow           | 2     | The quiet long pole — engines take days, a good question bank does not |
| Docker daemon not running                    | 1     | Hard blocker before step 1.2                                           |
