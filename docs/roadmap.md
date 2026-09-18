# GuruJi — Delivery Roadmap

> Last updated: 2026-09-18
> Task-level tracking lives in [`../TODO.md`](../TODO.md). This document holds
> the *order* and the *reasoning* behind it.

---

## Sequencing principle

Phases are ordered so that **the core practice loop works end-to-end as early as
possible**. Everything downstream of a submission — mastery, revision,
recommendations, analytics — is computed from real submission data. Building
those engines before submissions exist means building them against invented
data, and they will be wrong in ways nobody notices.

So the shape is: make one problem solvable for real, then make the system
*intelligent* about it.

```
Phase 1-4   Make the loop physically possible   (auth → problems → editor → execution)
Phase 5-7   Make the loop intelligent           (mastery → revision → recommendation)
Phase 8-11  Make the loop teach                 (AI mentor → visualiser → analytics → contest)
Phase 12    Make it shippable                   (a11y, states, performance, tests)
```

Phases 1–8 are the MVP. Phases 9–12 are not.

---

## Phase 0 — Analysis *(current)*

**Goal:** know what we are building before anything is typed.

- [x] Inspect the repository — confirmed greenfield, nothing to preserve
- [x] Verify toolchain — Node 22.15, pnpm 10.12, Docker 28.5
- [x] Pin dependency versions against current registry state
- [ ] Documentation set in `docs/`
- [ ] `TODO.md`

**Exit criteria:** architecture, database shape, module boundaries and MVP order
are written down and agreed.

**Environment note:** the Docker daemon is installed but not currently running.
It is required from Phase 1 (Postgres/Redis) and is a hard dependency for
Phase 4.

---

## Phase 1 — Foundation

**Goal:** an authenticated user can log in and see an empty dashboard.

| Area | Work |
|---|---|
| Monorepo | pnpm workspace, shared tsconfig/eslint/prettier presets |
| Infra | `docker-compose` with Postgres 17 + Redis 7, healthchecks, UTC |
| Database | Prisma schema for `User`, `Profile`, sessions; first migration |
| API | NestJS bootstrap, config module with env validation, health endpoint |
| Auth | Register, login, refresh, logout. Argon2id. Access + rotating refresh tokens |
| Web | Next.js 16 App Router, Tailwind 4, shadcn/ui, dark-first theme, app shell |
| Shared | `packages/types` with the first shared contracts |

**Exit criteria:** `pnpm dev` brings up both apps; register → login → protected
dashboard works; `pnpm typecheck` and `pnpm lint` are clean.

**Risks:** Tailwind 4 and Next 16 are both recent — shadcn/ui setup differs from
older guides. Budget time for it rather than fighting it mid-feature.

---

## Phase 2 — Question platform

**Goal:** browse and read problems.

- `Topic`, `Pattern`, `RoadmapNode`, `Problem`, `TestCase`, `Hint` models
- Roadmap stored in the database, **never** hard-coded in components
- Problem list: cursor pagination, filter by topic/pattern/difficulty/status, search
- Problem detail page: statement, constraints, examples, metadata
- Seed data: ~14 topics, ~12 patterns, and enough original problems to
  demonstrate every difficulty and several patterns

**Exit criteria:** the roadmap renders from the database; the problem list
paginates and filters without fetching everything.

---

## Phase 3 — Code editor

**Goal:** write code against a problem and keep it.

- Monaco, language switching (C++, C, Python, JavaScript), per-language starter code
- Draft persistence per (user, problem, language) — losing work is unacceptable
- Test-case panel, custom input, output panel
- Submission history for the problem

**Exit criteria:** a user can write, switch languages, reload the page, and find
their code still there.

---

## Phase 4 — Code runner *(highest-risk phase)*

**Goal:** Run and Submit produce real verdicts.

- `apps/code-runner` service; BullMQ queue between API and runner
- Sandbox images per language, built once, pinned
- Per-execution limits: CPU, memory, wall-clock timeout, pids, read-only FS,
  `--network none`, output cap, guaranteed cleanup
- Verdicts: `ACCEPTED`, `WRONG_ANSWER`, `TIME_LIMIT_EXCEEDED`,
  `MEMORY_LIMIT_EXCEEDED`, `RUNTIME_ERROR`, `COMPILE_ERROR`, `INTERNAL_ERROR`
- WebSocket push of the verdict
- Adversarial test suite: infinite loop, fork bomb, memory bomb, output flood,
  filesystem probe, network call, compile error, timeout

**Exit criteria:** every adversarial test is contained and returns the correct
verdict rather than degrading the host. This gate does not get waived.

**Order note:** Phase 4 is the most likely phase to overrun. It is placed before
the intelligence engines precisely because those engines are worthless without
its output.

---

## Phase 5 — Progress engine

**Goal:** the system knows how well you are doing.

- `UserTopicProgress`, `UserPatternProgress` maintained transactionally on submit
- Accuracy, average solve time, hint dependency, attempt counts
- Mastery score per topic and pattern, per [mastery-model.md](./mastery-model.md)
- Dashboard mastery bars backed by real numbers

**Exit criteria:** unit tests cover the mastery formula, including the
degenerate cases (zero attempts, one attempt, all-failures, hint-heavy success).

---

## Phase 6 — Revision engine

**Goal:** solved problems come back at the right time.

- `RevisionItem` with interval, ease factor, due date, lapse count
- SM-2-derived scheduling, adapted for problem solving — see
  [revision-engine.md](./revision-engine.md)
- "Due today" queue and revision dashboard
- Retention feeds back into mastery

**Exit criteria:** scheduling is deterministic and unit-tested across
success / struggle / failure paths.

---

## Phase 7 — Recommendation engine

**Goal:** the **TRAIN NOW** button knows what to do.

- Candidate generation → scoring → diversity filter → ranked output
- Weighted signals per [recommendation-engine.md](./recommendation-engine.md)
- Every recommendation carries a human-readable reason
- Redis-cached, invalidated on submission

**Exit criteria:** the tests named in the spec pass — weak topics rank higher,
recently-solved rank lower, failed revision is prioritised, difficulty adapts,
and duplicates are suppressed.

---

## Phase 8 — AI mentor *(MVP ends here)*

**Goal:** a mentor that teaches instead of answering.

- `packages/ai` with `LLMProvider` seam and `GroqProvider`
- Modes: progressive hint, explain concept, analyse code, explain wrong answer
- Layered prompts; server-side problem context; Zod-validated structured output
- Per-user rate limiting; conversation persistence
- Prompt-injection test suite

**Exit criteria:** hints escalate in stages and never open with the solution;
known injection strings do not extract the system prompt.

---

## Phase 9 — Visualiser

Algorithm execution is separated from rendering: `packages/algorithms` emits a
typed event stream (`COMPARE`, `SWAP`, `VISIT`, `PUSH`, `POP`, `UPDATE`, …) and
the UI replays it. Adding an algorithm must not mean touching React.

Ships sorting and searching first, then linked list, trees, graphs, and finally
DP tables.

---

## Phase 10 — Analytics

Charts over data that already exists by this point: weekly activity, mastery,
difficulty distribution, solve-time and accuracy trends, mistakes by category,
pattern performance. No new signals invented here.

---

## Phase 11 — Mock contest

Timed sessions, hints disabled by default, post-session performance report that
names the weak area. Assessment, not leaderboards.

---

## Phase 12 — Polish

Accessibility pass, responsive pass, loading/empty/error states everywhere,
performance budget, security review, Playwright coverage of the critical
journeys.

---

## What would make us re-plan

- **Sandbox containment cannot be demonstrated in Phase 4.** Everything after it
  is blocked; we would move to a third-party judge and re-cost the project.
- **Groq latency or rate limits make hints feel slow.** The `LLMProvider` seam
  exists for this; swapping providers should cost one class, not a re-plan.
- **Original problem authoring is slower than expected.** Problem *content* is
  the quiet long pole — engines are testable in days, a good question bank is not.
