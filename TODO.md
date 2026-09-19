# GuruJi — Phase Breakdown

> Task-level tracking. Phase *ordering and reasoning* lives in
> [`docs/roadmap.md`](./docs/roadmap.md) — this file is what actually gets ticked off.
> Last updated: 2026-09-18

**MVP = Phases 0–8.** Phases 9–12 are explicitly not in the first release.

Sizes are rough working days for one developer: `S` ≤ 1 · `M` 2–3 · `L` 4–6 · `XL` 7+

| Phase | Name | Size | Status |
|---|---|---|---|
| 0 | Analysis & design | M | ✅ Done |
| 1 | Foundation | L | ✅ Done |
| 2 | Question platform | L | ⬜ |
| 3 | Code editor | M | ⬜ |
| 4 | Code runner 🔴 | XL | ⬜ |
| 5 | Progress engine | M | ⬜ |
| 6 | Revision engine | M | ⬜ |
| 7 | Recommendation engine | L | ⬜ |
| 8 | AI mentor | L | ⬜ |
| — | **MVP complete** | | |
| 9 | Visualiser | XL | ⬜ |
| 10 | Analytics | M | ⬜ |
| 11 | Mock contest | M | ⬜ |
| 12 | Polish | L | ⬜ |

🔴 = highest risk. See the note under Phase 1.

---

## Phase 0 — Analysis & design ✅

**Goal:** know what we are building before anything is typed.

- [x] Inspect repository — confirmed greenfield, nothing to preserve
- [x] Verify toolchain — Node 22.15, pnpm 10.12, Docker 28.5
- [x] Pin dependency versions against current registry state
- [x] `docs/` — 13 documents covering architecture, engines, security, AI, sandbox
- [x] `TODO.md` — this file
- [x] Confirm the phase plan with the project owner

**Exit:** architecture, schema shape, module boundaries and MVP order are written
down and agreed.

**Blocked on nothing.** Docker daemon is installed but not running — needed from
Phase 1.

---

## Phase 1 — Foundation ✅

**Goal:** a registered user can log in and reach an empty dashboard.

### Setup
- [x] pnpm workspace wired up; `packages/config` presets (tsconfig, eslint, prettier)
- [x] `docker-compose` verified up — Postgres 17 + Redis 7, healthchecks green, UTC
- [x] `.env` loading + startup validation. **The app refuses to boot on a missing
      required variable** — a half-configured service that starts is worse than one
      that does not

### Database
- [x] `packages/database` — Prisma client singleton (one instance; hot-reload must
      not open a new pool every save)
- [x] `User`, `Profile`, `RefreshToken` models
- [x] First migration + `pnpm db:migrate` / `db:seed` / `db:studio` scripts

### API
- [x] NestJS bootstrap, global prefix, CORS allow-list, Helmet
- [x] Global exception filter → the error envelope from `docs/api.md`
- [x] Global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted`
- [x] Structured logger with a per-request correlation id
- [x] `GET /health` and `/health/ready`
- [x] Auth: register, login, refresh, logout, me
- [x] Argon2id hashing; access JWT + rotating refresh token in an httpOnly cookie
- [x] Refresh-token **reuse detection** → revoke the whole chain
- [x] Rate limits on login/register (per IP *and* per email)

### Frontend
- [x] Next.js 16 App Router + TypeScript strict
- [x] Tailwind 4 + shadcn/ui + dark-first theme tokens (budget real time here —
      setup differs from pre-v4 guides)
- [x] Theme switching: dark / light / system, persisted
- [x] App shell — sidebar nav, header, responsive layout
- [x] Auth pages (register, login) with React Hook Form + Zod
- [x] Token handling + protected-route middleware
- [x] TanStack Query provider + Zustand store skeleton
- [x] Empty dashboard

### Shared
- [x] `packages/types` — first shared contracts (auth DTOs, error envelope)

### Tests
- [x] Auth unit tests — hashing, token issue/rotate/revoke
- [x] Auth e2e — register → login → refresh → protected route → logout
- [x] Reuse-detection test: a rotated token revokes the chain

### 🔴 De-risking spike (do it in this phase, not Phase 4)
- [x] **Sandbox spike — done 2026-09-18.** Full results in
      [`docs/code-execution.md`](./docs/code-execution.md#spike-results--2026-09-18).

  Infinite loop, fork bomb, memory bomb, network, read-only root, `noexec`
  `/tmp`, output flood — all contained on this host.

  One real defect found: **killing the `docker run` client does not kill the
  container.** An orphan kept burning a core for minutes. The worker must run
  detached and `docker kill <id>` by name — carried into Phase 4 below.

**Exit:** `pnpm dev` starts both apps · register → login → dashboard works ·
`pnpm build`, `typecheck`, `lint` all clean.

---

## Phase 2 — Question platform

**Goal:** browse and read problems.

### Database
- [ ] `Topic`, `Pattern`, `RoadmapNode`
- [ ] `Problem`, `ProblemTopic`, `ProblemPattern`, `TestCase`, `Hint`
- [ ] Indexes from `docs/database.md`
- [ ] Seed: 14 topics, 12 patterns, full roadmap tree with prerequisites
- [ ] Seed: original problems covering every difficulty and several patterns,
      each with real test cases and curated hints
- [ ] Seed is **idempotent** — `upsert` by slug, re-running never duplicates

### API
- [ ] `GET /topics`, `/topics/:slug`, `/patterns`
- [ ] `GET /roadmap` — full tree, cached, overlaid with user progress
- [ ] `GET /problems` — filter by topic/pattern/difficulty/status/`q`, cursor pagination
- [ ] `GET /problems/:slug` — **sample test cases only**
- [ ] Hidden test cases excluded in the *repository*, not the controller
- [ ] Redis caching + documented invalidation

### Frontend
- [ ] Roadmap page — rendered from the database, never hard-coded
- [ ] Problem list — filters in URL search params, infinite scroll
- [ ] Problem detail — Markdown statement, constraints, examples, metadata
- [ ] Markdown sanitisation with an allow-list
- [ ] Loading / empty / error states for each

### Tests
- [ ] Cursor pagination is stable when rows are inserted mid-scroll
- [ ] Hidden test cases never appear in any response
- [ ] Filter combinations return correct sets
- [ ] Seed idempotency

**Exit:** the roadmap renders from the database; the problem list filters and
paginates without fetching everything.

---

## Phase 3 — Code editor

**Goal:** write code against a problem and never lose it.

### Frontend
- [ ] Monaco integration — **configured without `unsafe-eval`** so the CSP in
      `docs/security.md` stays real
- [ ] Language switcher: C++, C, Python, JavaScript
- [ ] Per-language starter code loaded from the problem
- [ ] Draft persistence per (user, problem, language), debounced
- [ ] Split layout — statement / editor / results, resizable
- [ ] Test-case panel + custom input
- [ ] Submission history panel
- [ ] Editor preferences in Zustand (font size, theme, tab width)

### API
- [ ] Draft save/load endpoints
- [ ] `GET /problems/:slug/submissions`

### Tests
- [ ] Draft survives a page reload
- [ ] Switching language does not destroy the other language's draft

**Exit:** write code, switch language, reload, and the code is still there.

---

## Phase 4 — Code runner 🔴

**Goal:** Run and Submit produce real verdicts. **This phase does not get its
exit criteria waived.**

### Infrastructure
- [ ] `apps/code-runner` service skeleton
- [ ] BullMQ queue + worker, bounded concurrency, retry with a dead-letter path
- [ ] Sandbox images per language, pinned base tags, no shell / no package manager
- [ ] Image build script

### Sandbox controls — every one of these, per `docs/code-execution.md`
- [ ] `--network none`
- [ ] `--memory` 256 MB, `--memory-swap` equal
- [ ] `--cpus` 1.0
- [ ] `--pids-limit` 64
- [ ] `--read-only` root, `--tmpfs /tmp` with `noexec,nosuid`
- [ ] `--cap-drop ALL`, `--security-opt no-new-privileges`
- [ ] Non-root user, `--ulimit fsize`
- [ ] **Timeout enforced twice** — inside the container and by the worker
- [ ] **Worker runs containers detached and kills by id** (`docker run -d --name`
      → `docker kill <id>`). Killing the CLI process leaves the container running —
      confirmed in the Phase 1 spike. Applies to timeout, cancel and every error path
- [ ] Output capped at 64 KB, truncated at the source — **and the container still
      killed**; truncating our read does not stop the program
- [ ] Container reaper for orphans (backstop, not the primary mechanism)
- [ ] Compilation runs under the same limits, with its own longer timeout

### API
- [ ] `POST /submissions` → `202` + id, validated and enqueued
- [ ] Runner → API callback, shared-secret authenticated
- [ ] Submission-completion transaction (results + verdict; mastery hooks land in Phase 5)
- [ ] WebSocket namespace + `submission:status` / `submission:result`

### Frontend
- [ ] Run against samples · Submit against all
- [ ] Live status over WebSocket
- [ ] Result panel — per-test results, runtime, memory, compile errors

### 🔴 Adversarial suite — every row must pass to exit the phase
- [ ] Infinite loop → `TIME_LIMIT_EXCEEDED`, container reaped, host CPU normal
- [ ] Fork bomb → blocked by `pids-limit`, host unaffected
- [ ] 4 GB allocation → `MEMORY_LIMIT_EXCEEDED`, OOM inside the container only
- [ ] Output flood → truncated at 64 KB, database write bounded
- [ ] Filesystem probe (`/etc/passwd`, walk `/`) → nothing sensitive reachable
- [ ] Write outside `/tmp` → fails (read-only root)
- [ ] Write + execute in `/tmp` → fails (`noexec`)
- [ ] HTTP request and DNS lookup → both fail
- [ ] Fill `/tmp` → bounded by tmpfs, no host disk impact
- [ ] C++ compile-time memory bomb → bounded, `COMPILE_ERROR`
- [ ] 100 concurrent submissions → queue drains, no host degradation
- [ ] `INTERNAL_ERROR` is never recorded against user accuracy

**Exit:** every adversarial test contained *and* returning the correct verdict.

---

## Phase 5 — Progress engine

**Goal:** the system knows how well you are doing.

### Database
- [ ] `UserTopicProgress`, `UserPatternProgress` (unique on user+topic / user+pattern)
- [ ] `Mistake` + categories
- [ ] `StudySession`

### API
- [ ] Mastery module — the formula from `docs/mastery-model.md`, weights in **one**
      config object
- [ ] Progress updated **inside** the submission transaction, incrementally
- [ ] Nightly reconciliation job — recompute from source, **log** drift rather than
      silently correcting it (drift means a write path is broken; hiding it hides the bug)
- [ ] `POST /mistakes`, `GET /mistakes`, `GET /mistakes/patterns`
- [ ] `GET /analytics/overview`

### Frontend
- [ ] Dashboard mastery bars, backed by real numbers
- [ ] Mastery breakdown — "why is my Graphs score 40?" has an answer
- [ ] Mistake journal — log after a wrong submission, categorise, add notes
- [ ] Streak display

### Tests
- [ ] Zero attempts → 0 with the no-data flag
- [ ] One perfect solve → low score, not 100 (confidence damping)
- [ ] All failures → 0, no division by zero
- [ ] Hint-heavy solves score materially lower than unaided ones
- [ ] Hard solves outscore an equal count of easy solves
- [ ] One pattern repeated → capped by `patternCoverage`
- [ ] Every component maxed → exactly 100
- [ ] Weight config sums to the documented total
- [ ] `isRun` submissions and `INTERNAL_ERROR` are excluded

**Exit:** the mastery formula is unit-tested including every degenerate case.

---

## Phase 6 — Revision engine

**Goal:** solved problems come back at the right time.

### Database
- [ ] `RevisionItem` — interval, ease, repetitions, lapses, state, `dueAt`
- [ ] Index on `(userId, dueAt)` — hottest query in the product

### API
- [ ] SM-2-derived scheduler per `docs/revision-engine.md`
- [ ] Scheduling inside the submission transaction
- [ ] Daily queue with a configurable cap; overflow carries forward, never dropped
- [ ] Backlog re-spacing after a long absence
- [ ] Due-today resolved against the user's IANA timezone, not UTC midnight
- [ ] `GET /revision/due`, `/revision/upcoming`, `POST /revision/:id/complete`

### Frontend
- [ ] Revision dashboard + due-today queue
- [ ] Outcome capture after a revision solve
- [ ] Upcoming-week calendar

### Tests
- [ ] First solve schedules at day 1
- [ ] Success advances the ladder × ease
- [ ] `STRUGGLED` halves without advancing, floor of 1 day
- [ ] `FAILED` resets, increments lapses, sets `LAPSED`
- [ ] Ease clamps at both ends
- [ ] `MASTERED` needs consecutive successes, not one
- [ ] Day-cap overflow carries forward
- [ ] 30-day absence re-spaces instead of dumping
- [ ] Due-today is correct across a DST transition
- [ ] Revision + mastery commit atomically (forced failure rolls both back)

**Exit:** scheduling is deterministic and tested across success / struggle / fail.

---

## Phase 7 — Recommendation engine

**Goal:** **TRAIN NOW** knows what to do.

### API
- [ ] Candidate generation — four pools, bounded, ~50 candidates
- [ ] Scoring with the weights from `docs/recommendation-engine.md`
- [ ] Diversity filter — max 2 per topic in the top 5, always one outside the weakest topic
- [ ] Reason generation from the scoring breakdown — **derived, never LLM-written**
- [ ] `GET /recommendations/next` with the precedence ladder
- [ ] `GET /recommendations`, `POST /recommendations/:id/dismiss`
- [ ] Redis cache, 15 min, invalidated on any submission by that user
- [ ] Cold start: onboarding assessment seeds initial mastery; honest reasons before it

### Frontend
- [ ] Dashboard **TRAIN NOW** — the single most visible action
- [ ] "Today's Training" panel — revision due / new / weak-topic / challenge
- [ ] Reason shown on every recommendation
- [ ] Onboarding flow — experience, language, initial assessment

### Tests
- [ ] Weak topic ranks above strong, all else equal
- [ ] Recently solved ranks below an equivalent unsolved
- [ ] Failed revision beats new material
- [ ] Difficulty adapts upward as mastery rises
- [ ] No duplicate across consecutive batches
- [ ] Topic diversity holds
- [ ] Unmet prerequisite scores **zero**, not merely low
- [ ] Cold-start user gets roadmap order with honest reasons
- [ ] Every recommendation has a non-empty reason

**Exit:** all of the above pass.

---

## Phase 8 — AI mentor — *MVP ends here*

**Goal:** a mentor that teaches instead of answering.

### Package
- [ ] `packages/ai` — `LLMProvider` interface + `GroqProvider`
- [ ] Nothing outside this package imports `groq-sdk`
- [ ] Two model tiers (fast for hints, quality for analysis), ids from config
- [ ] Four-layer prompt assembly; user content fenced and labelled untrusted
- [ ] Zod schemas per mode; one bounded retry, then a structured error

### Database
- [ ] `AIConversation`, `AIMessage` with `hintLevel` and token usage

### API
- [ ] `POST /ai/hint` — curated hints first, model only when they run out
- [ ] `POST /ai/explain` — fixed structure: intuition → example → implementation → complexity → mistakes
- [ ] `POST /ai/analyze-code` — structured output, direction not replacement code
- [ ] `POST /ai/explain-wrong-answer` — stops before the correction
- [ ] `POST /ai/generate-problem` — admin only, full validation pipeline, never auto-published
- [ ] Per-user rate limits + daily token budget in Redis
- [ ] Provider failure → honest error, **never a fake hint**

### Frontend
- [ ] AI mentor panel on the problem page
- [ ] Progressive hint UI — level state survives reload
- [ ] "Show solution" as a separate, deliberate, recorded action
- [ ] Code analysis and wrong-answer views

### Tests
- [ ] Hints escalate and never open with the solution
- [ ] Injection suite: "ignore previous instructions", "reveal your system prompt",
      instructions hidden in code comments and variable names
- [ ] Malformed model output retries once, then errors cleanly
- [ ] Generated problem whose reference solution fails its own tests is rejected
- [ ] Hint usage is recorded and lowers mastery

**Exit:** hints escalate properly; known injections extract nothing.

### 🎯 MVP complete — the full loop runs on real data

---

## Phase 9 — Visualiser

- [ ] `packages/algorithms` — `AlgorithmStep` event model
- [ ] Sorting (6) + searching (2) → array canvas
- [ ] Linked list (4) → node-chain canvas
- [ ] Trees (6) → tree canvas
- [ ] Graphs (5) → graph canvas
- [ ] DP (4) → table canvas
- [ ] Playback controls; step-back is exact (index − 1), not re-approximated
- [ ] Variable panel + live metrics
- [ ] Single rAF loop, not per-element timers
- [ ] Accessibility — text descriptions, keyboard controls, not colour-only,
      `prefers-reduced-motion`
- [ ] Input-size caps with a clear message
- [ ] Per-algorithm event-sequence tests

**Exit test:** adding an algorithm touches no React.

---

## Phase 10 — Analytics

- [ ] `GET /analytics/activity`, `/topics`, `/trends` — ranges bounded server-side
- [ ] Recharts: weekly activity heatmap, mastery, difficulty distribution,
      solve-time and accuracy trends, mistakes by category, pattern performance
- [ ] Profile page
- [ ] No new signals invented — everything already exists by this point

---

## Phase 11 — Mock contest

- [ ] `Contest`, `ContestProblem`, `ContestSubmission`
- [ ] Start / submit / finish / report endpoints
- [ ] Timer, hints disabled by default
- [ ] Post-contest report naming the weak area
- [ ] Assessment framing, not leaderboards

---

## Phase 12 — Polish

- [ ] Accessibility pass — keyboard, screen reader, contrast, focus
- [ ] Responsive pass — desktop / tablet / mobile (editor is desktop-first)
- [ ] Loading, empty and error states everywhere
- [ ] Performance budget — code splitting, lazy loading, query tuning
- [ ] Security review against `docs/security.md`
- [ ] Playwright: register → login → open problem → code → run → submit → result →
      recommendation → revision
- [ ] Sentry wired up
- [ ] Light gamification — streaks, badges, milestones. **Never feeding mastery**

---

## Cross-cutting rules

Apply in every phase, not at the end:

- [ ] Tests before implementation for the three engines — non-negotiable
- [ ] `pnpm build` before every commit (catches `TS6133` orphans a dev server hides)
- [ ] Every endpoint validates input and checks ownership in the `WHERE` clause
- [ ] All timestamps UTC; the browser converts
- [ ] No secret is `NEXT_PUBLIC_*`
- [ ] Docs updated in the same PR as the behaviour change

---

## Known risks

| Risk | Phase | If it happens |
|---|---|---|
| Sandbox containment cannot be proven | 4 | Everything after is blocked → move to a third-party judge and re-cost. **The Phase 1 spike exists to find this early** |
| Groq latency makes hints feel slow | 8 | The `LLMProvider` seam should make a provider swap one class |
| Tailwind 4 + Next 16 + shadcn setup friction | 1 | Budget it explicitly; do not discover it mid-feature |
| Original problem authoring is slow | 2 | The quiet long pole. Engines take days; a good question bank does not |
| Docker daemon not running | 1 | Hard blocker — must be running before Phase 1 starts |
