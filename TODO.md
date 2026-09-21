# GuruJi — Phase Breakdown

> Task-level tracking. Phase *ordering and reasoning* lives in
> [`docs/roadmap.md`](./docs/roadmap.md) — this file is what actually gets ticked off.
> Last updated: 2026-09-19

**MVP = Phases 0–8.** Phases 9–12 are explicitly not in the first release.

Sizes are rough working days for one developer: `S` ≤ 1 · `M` 2–3 · `L` 4–6 · `XL` 7+

| Phase | Name | Size | Status |
|---|---|---|---|
| 0 | Analysis & design | M | ✅ Done |
| 1 | Foundation | L | ✅ Done |
| 2 | Question platform | L | ✅ Done |
| 3 | Code editor | M | ✅ Done |
| 4 | Code runner 🔴 | XL | ✅ Done |
| 5 | Progress engine | M | ✅ Done |
| 6 | Revision engine | M | ✅ Done |
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

## Phase 2 — Question platform ✅

**Goal:** browse and read problems.

### Database
- [x] `Topic`, `Pattern`, `RoadmapNode`, `TopicPrerequisite`
- [x] `Problem`, `ProblemTopic`, `ProblemPattern`, `TestCase`, `Hint`
- [x] Indexes from `docs/database.md`
- [x] Seed: 14 topics, 12 patterns, full roadmap tree with prerequisites
- [x] Seed: 12 original problems — 5 easy, 5 medium, 2 hard — across 9 patterns,
      each with 8 test cases and a 3-level hint ladder
- [x] Seed is **idempotent** — `upsert` by natural key. Stronger than "no
      duplicates": a re-run reissues no test case or hint **id**, because from
      Phase 4 submissions reference them

### API
- [x] `GET /topics`, `/topics/:slug`, `/patterns`
- [x] `GET /roadmap` — full tree, cached. The user-progress overlay lands in
      Phase 5, with the user id in the cache key
- [x] `GET /problems` — filter by topic/pattern/difficulty/`q`, cursor pagination
- [ ] `status` filter (solved / attempted / unsolved) — **deferred to Phase 5.**
      It is derived from submissions, which do not exist yet. The API rejects the
      parameter rather than accepting and ignoring it
- [x] `GET /problems/:slug` — **sample test cases only**
- [x] `GET /problems/:slug/hints/:level` — one curated hint at a time
- [x] Hidden test cases excluded in the *repository*, not the controller
- [x] Redis caching, TTLs per `docs/api.md`. Invalidation is TTL-only for now:
      nothing in Phase 2 writes content, so the admin publish/update hooks have
      nothing to hang off yet

### Frontend
- [x] Roadmap page — rendered from `RoadmapNode`, never hard-coded
- [x] Problem list — filters in URL search params, infinite scroll
- [x] Problem detail — Markdown statement, constraints, examples, metadata
- [x] Markdown sanitisation with an allow-list (`rehype-sanitize`, narrowed)
- [x] Loading / empty / error states for each

### Tests
- [x] Cursor pagination is stable when rows are inserted mid-scroll
- [x] Hidden test cases never appear in any response
- [x] Filter combinations return correct sets
- [x] Seed idempotency — counts *and* ids
- [x] Every seeded expected output checked against an independent reference
      implementation. It caught five wrong answers in the hand-written data

**Exit:** the roadmap renders from the database; the problem list filters and
paginates without fetching everything.

---

## Phase 3 — Code editor ✅

**Goal:** write code against a problem and never lose it.

### Database
- [x] `Draft` — unique on (user, problem, language). **Not in the original
      `docs/database.md` design;** added to the doc in the same change

### Frontend
- [x] Monaco integration — from our own bundle, not a CDN, with only the Monarch
      grammars and **none of the language services**, so nothing needs
      `unsafe-eval`
- [x] The CSP itself, which `docs/security.md` promised and the web app did not
      have. `script-src 'self'` in production
- [x] Language switcher: C++, C, Python, JavaScript
- [x] Per-language starter code loaded from the problem
- [x] Draft persistence per (user, problem, language), debounced at 1.2s, with a
      `pagehide` flush so closing the tab does not lose the last edit
- [x] Split layout — statement / editor / test panel, drag- **and keyboard**-resizable
- [x] Test-case panel + custom input
- [ ] Submission history panel — **deferred to Phase 4.** `Submission` does not
      exist yet; there is no history to show
- [x] Editor preferences in Zustand (font size, tab width, wrap, minimap),
      persisted per device

### API
- [x] `GET /problems/:slug/drafts`, `PUT /problems/:slug/drafts/:language`
- [ ] `GET /problems/:slug/submissions` — **deferred to Phase 4**, same reason

### Tests
- [x] A saved draft comes back exactly — the server half of "survives a reload"
- [x] Switching language does not destroy the other language's draft
- [x] Autosave updates in place instead of accumulating rows
- [x] A draft is never visible to another user; unauthenticated calls are refused
- [x] **Browser tests** — Playwright pulled forward from Phase 12. Seven tests in
      Chromium: Monaco renders with no CSP violation, nothing is fetched from a
      CDN, the split resizes from the keyboard, the exit criterion holds across a
      reload, the test panel works, preferences persist
- [x] They found two real bugs the build could not: a controlled `value` prop
      dropping typed characters, and a language switch discarding the pending
      autosave. Both fixed

**Exit:** write code, switch language, reload, and the code is still there.

---

## Phase 4 — Code runner 🔴 ✅

**Goal:** Run and Submit produce real verdicts. **This phase does not get its
exit criteria waived.**

### Infrastructure
- [x] `apps/code-runner` service skeleton
- [x] BullMQ queue + worker, bounded concurrency, retry with a dead-letter path
- [x] Sandbox images per language, pinned base tags, no shell / no package manager
- [x] Image build script

### Sandbox controls — every one of these, per `docs/code-execution.md`
- [x] `--network none`
- [x] `--memory` 256 MB, `--memory-swap` equal
- [x] `--cpus` 1.0
- [x] `--pids-limit` 64
- [x] `--read-only` root, `--tmpfs /tmp` with `noexec,nosuid`
- [x] `--cap-drop ALL`, `--security-opt no-new-privileges`
- [x] Non-root user, `--ulimit fsize`
- [x] **Timeout enforced twice** — `--ulimit cpu` inside (kernel kills anything
      that burns its CPU budget) and the worker's kill outside (catches a program
      that sleeps instead, and a wedged container). Different programs, both needed
- [x] **Worker runs containers detached and kills by id** (`docker run -d --name`
      → `docker kill <id>`). Killing the CLI process leaves the container running —
      confirmed in the Phase 1 spike. Applies to timeout, cancel and every error path
- [x] Output capped at 64 KB, truncated at the source — **and the container still
      killed**; truncating our read does not stop the program
- [x] Container reaper for orphans (backstop, not the primary mechanism)
- [x] Compilation runs under the same limits, with its own longer timeout

### API
- [x] `POST /submissions` → `202` + id, validated and enqueued
- [x] Runner → API callback, shared-secret authenticated
- [x] Submission-completion transaction (results + verdict; mastery hooks land in Phase 5)
- [x] WebSocket namespace + `submission:status` / `submission:result`

### Frontend
- [x] Run against samples · Submit against all
- [x] Live status over WebSocket
- [x] Result panel — per-test results, runtime, memory, compile errors

### 🔴 Adversarial suite — every row must pass to exit the phase
- [x] Infinite loop → `TIME_LIMIT_EXCEEDED`, container reaped, host CPU normal
- [x] Fork bomb → blocked by `pids-limit`, host unaffected. The verdict itself is
      not asserted: every forked child runs the rest of the program too, so dozens
      of processes share one stdout and which verdict lands is scheduling
- [x] 4 GB allocation → `MEMORY_LIMIT_EXCEEDED`, OOM inside the container only.
      The bytes must be **written** — `bytearray(4 << 30)` is mapped lazily, never
      faulted in, and passes a 256 MB limit untouched
- [x] Output flood → truncated at 64 KB, database write bounded
- [x] Filesystem probe (`/etc/passwd`, walk `/`) → nothing sensitive reachable
- [x] Write outside `/tmp` → fails (read-only root)
- [x] Write + execute in `/tmp` → fails (`noexec`)
- [x] HTTP request and DNS lookup → both fail
- [x] Fill `/tmp` → bounded by tmpfs, no host disk impact
- [x] C++ compile-time memory bomb → bounded, `COMPILE_ERROR`
- [x] 100 concurrent submissions → queue drains, no host degradation. 100/100
      `ACCEPTED` in 164 s on the dev host, never more than 4 containers alive
- [x] `INTERNAL_ERROR` is never recorded against user accuracy

**Exit:** every adversarial test contained *and* returning the correct verdict.

---

## Phase 5 — Progress engine

**Goal:** the system knows how well you are doing.

### Database
- [x] `UserTopicProgress`, `UserPatternProgress` (unique on user+topic / user+pattern)
- [x] `Mistake` + categories
- [x] `StudySession`

### API
- [x] Mastery module — the formula from `docs/mastery-model.md`, weights in **one**
      config object
- [x] Progress updated **inside** the submission transaction, incrementally
- [x] Nightly reconciliation job — recompute from source, **log** drift rather than
      silently correcting it (drift means a write path is broken; hiding it hides the bug)
- [x] `POST /mistakes`, `GET /mistakes`, `GET /mistakes/patterns`
- [x] `GET /analytics/overview`

### Frontend
- [x] Dashboard mastery bars, backed by real numbers
- [x] Mastery breakdown — "why is my Graphs score 40?" has an answer
- [x] Mistake journal — log after a wrong submission, categorise, add notes
- [x] Streak display

### Tests
- [x] Zero attempts → 0 with the no-data flag
- [x] One perfect solve → low score, not 100 (confidence damping)
- [x] All failures → 0, no division by zero
- [x] Hint-heavy solves score materially lower than unaided ones
- [x] Hard solves outscore an equal count of easy solves. **The obvious
      implementation does not do this** — weighting both sides of a rate cancels
      the weight, so difficulty is a ceiling on the component, not a scale factor
- [x] One pattern repeated → capped by `patternCoverage`
- [x] Every component maxed → exactly 100
- [x] Weight config sums to the documented total
- [x] `isRun` submissions and `INTERNAL_ERROR` are excluded

**Exit:** the mastery formula is unit-tested including every degenerate case.

---

## Phase 6 — Revision engine ✅

**Goal:** solved problems come back at the right time.

### Database
- [x] `RevisionItem` — interval, ease, repetitions, lapses, state, `dueAt`
- [x] Index on `(userId, dueAt)` — hottest query in the product
- [x] `RevisionReview` — one row per completed review. Needed because `retention`
      is a *rate* over attempts, and a counter that only moves forward cannot be
      recomputed from source by the reconciliation job

### API
- [x] SM-2-derived scheduler per `docs/revision-engine.md`
- [x] Scheduling inside the submission transaction
- [x] Daily queue with a configurable cap; overflow carries forward, never dropped
- [x] Backlog re-spacing after a long absence
- [x] Due-today resolved against the user's IANA timezone, not UTC midnight
- [x] `GET /revision/due`, `/revision/upcoming`, `POST /revision/:id/complete`

### Frontend
- [x] Revision dashboard + due-today queue
- [x] Outcome capture after a revision solve
- [x] Upcoming-week calendar

### Tests
- [x] First solve schedules at day 1
- [x] Success advances the ladder × ease
- [x] `STRUGGLED` halves without advancing, floor of 1 day
- [x] `FAILED` resets, increments lapses, sets `LAPSED` — **only if it had reached
      `REVIEWING`**. Failing something still being learned is not a lapse, and
      marking it one spends the priority reserved for knowledge actually lost
- [x] Ease clamps at both ends
- [x] `MASTERED` needs consecutive successes, not one
- [x] Day-cap overflow carries forward. **Found a real off-by-one**: the due
      query used `dueAt <= endOfLocalDay`, and re-spacing puts items exactly on
      that boundary — so they came straight back to today and the cap silently
      stopped holding
- [x] 30-day absence re-spaces instead of dumping
- [x] Due-today is correct across a DST transition, in both directions
- [x] Revision + mastery commit atomically (forced failure rolls both back)

**Exit:** scheduling is deterministic and tested across success / struggle / fail.

---

## Phase 7 — Recommendation engine

**Goal:** **TRAIN NOW** knows what to do.

### API
- [x] Candidate generation — four pools, bounded, ~50 candidates
- [x] Scoring with the weights from `docs/recommendation-engine.md`. `LAPSED_BOOST`
      raised from 0.35 to 1: at 0.35 "a failed revision beats new material" only
      held when the item happened to be overdue enough — now it is structural
- [x] Diversity filter — max 2 per topic in the top 5, always one outside the weakest topic
- [x] Reason generation from the scoring breakdown — **derived, never LLM-written**
- [x] `GET /recommendations/next` with the precedence ladder
- [x] `GET /recommendations`, `POST /recommendations/:id/dismiss`
- [x] Redis cache, 15 min, invalidated on any submission by that user
- [x] Cold start: honest reasons before any history. **Deviation:** onboarding seeds
      `difficultyTolerance` from stated experience, and **not** mastery — a score
      written from "I am intermediate" is fabricated data the engine would reason
      from confidently. Real mastery arrives through solved problems
- [x] Prerequisite gate: a prerequisite topic with no published problems counts as
      satisfied. Without this the gate was a dead end — the head of the chain has
      nothing to solve, so every topic stayed blocked and a new account got an
      empty dashboard
- [x] `PUT /profile/onboarding` — experience, language, goal, timezone

### Frontend
- [ ] Dashboard **TRAIN NOW** — the single most visible action
- [ ] "Today's Training" panel — revision due / new / weak-topic / challenge
- [ ] Reason shown on every recommendation
- [ ] Onboarding flow — experience, language, initial assessment

### Tests
- [x] Weak topic ranks above strong, all else equal
- [x] Recently solved ranks below an equivalent unsolved
- [x] Failed revision beats new material
- [x] Difficulty adapts upward as mastery rises
- [x] No duplicate across consecutive batches
- [x] Topic diversity holds
- [x] Unmet prerequisite scores **zero**, not merely low
- [x] Cold-start user gets roadmap order with honest reasons
- [x] Every recommendation has a non-empty reason

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
- [ ] `pnpm --filter @guruji/web test:e2e` before calling any UI phase done — a
      green build says nothing about whether the page renders
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
