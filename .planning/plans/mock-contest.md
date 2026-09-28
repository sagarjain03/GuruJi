# Plan: Mock contest (Phase 11)

**Spec**: .planning/specs/mock-contest.md
**Epic**: none (roadmap Phase 11)
**Created**: 2026-09-28
**Status**: done

Full-stack: database → API → types → web → browser tests. Backend first; the
integration point is `contestApi` in `apps/web/src/lib/api.ts` (task 13).

---

## Architecture

Follows the existing module shape (see `revision/`): a Nest module with a
controller and a service that talk to Prisma directly, and the decisions that
matter in **pure files with their own specs** (like `revision/scheduler.ts`).
There is no repository layer for this domain, matching revision, mastery and
recommendations.

### Components

| Component | Type | Purpose |
|---|---|---|
| `ContestsController` | Controller | 6 routes, auth guard, input parsing |
| `ContestsService` | Service | start, view, submit, finish, report; lazy TIME_UP; one-active rule |
| `selection` | Pure logic | picks 3 problems: weak topics, difficulty mix, solved fallback (spec §2) |
| `scoring` | Pure logic | points, what counts before the deadline, lazy-finish decision (spec §7–8) |
| `report` | Pure logic | per-problem summary, weak-area rule, slowest (spec §10) |
| `ContestsService.assertMentorAllowed` | Service method | the hint gate the AI service calls (spec §9) |
| `contestApi` | API client | typed calls for the web |
| `ContestView` | Page component | start / active / report states on `/contest` |
| `Countdown` | Component | server-anchored countdown, polite announcements |
| Editor contest mode | Existing components | `?contest=<id>`: submit route, countdown, mentor hidden |

### New files

| File | Location | Purpose |
|---|---|---|
| `migration.sql` | `packages/database/prisma/migrations/<ts>_phase11_contests/` | tables, enums, partial unique index |
| `contest.ts` | `packages/types/src/` | Zod schemas: start request, contest view, report |
| `selection.ts` + `.spec.ts` | `apps/api/src/contests/` | problem picking |
| `scoring.ts` + `.spec.ts` | `apps/api/src/contests/` | points, deadline rule, lazy finish |
| `report.ts` + `.spec.ts` | `apps/api/src/contests/` | report and weak area |
| `contests.service.ts` | `apps/api/src/contests/` | orchestration + Prisma |
| `contests.controller.ts` | `apps/api/src/contests/` | routes |
| `contests.module.ts` | `apps/api/src/contests/` | wiring |
| `contests.e2e-spec.ts` | `apps/api/test/` | API against real Postgres |
| `page.tsx` | `apps/web/src/app/(app)/contest/` | route |
| `contest-view.tsx` | `apps/web/src/components/contest/` | start / active states |
| `contest-report.tsx` | `apps/web/src/components/contest/` | report state |
| `countdown.tsx` | `apps/web/src/components/contest/` | countdown |
| `contest.spec.ts` | `apps/web/e2e/` | browser journey |

### Files to change

| File | What changes | Why |
|---|---|---|
| `packages/database/prisma/schema.prisma` | 2 enums, 3 models, back-relations on User / Problem / Submission | data model |
| `packages/types/src/error.ts` | 6 error codes | spec API errors |
| `packages/types/src/index.ts` | export `contest` | shared schemas |
| `apps/api/src/execution/execution.module.ts` | export `SubmissionsService` | contest submit reuses the real judge path |
| `apps/api/src/recommendations/recommendations.module.ts` | export `CandidatesService` | reuse weak-topic ranking (`contextFor`) |
| `apps/api/src/app.module.ts` | import `ContestsModule` | register |
| `apps/api/src/ai/ai.service.ts` | call `assertMentorAllowed` in hint / explain / analyze-code / explain-wrong-answer / show-solution | hints off during a contest |
| `apps/api/src/ai/ai.module.ts` | import `ContestsModule` | inject the gate |
| `apps/api/test/hints.e2e-spec.ts` | contest-gate cases | spec §9 |
| `apps/web/src/lib/api.ts` | `contestApi` | client |
| `apps/web/src/app/(app)/problems/[slug]/page.tsx` | read `?contest=` | contest mode |
| `apps/web/src/components/problems/workspace.tsx` | countdown, hide mentor, back link | contest mode |
| `apps/web/src/components/problems/use-submission.ts` | submit to contest endpoint when in contest | contest mode |
| `apps/web/src/components/app-shell.tsx` | Contest nav `ready: true` | reachable |
| `apps/web/e2e/auth.setup.ts` | add `/contest` to warmed routes | the list says new pages belong there |
| `docs/api.md`, `docs/database.md` | as-built contest sections | docs match code |
| `TODO.md` | tick Phase 11 items, only once verified | project rule |

---

## Tasks

Each task is one commit with its checks passing. TDD for every pure file: spec
first, see it fail, then the code.

### Phase 1 — Database and shared types

| # | Task | Files | Verify |
|---|---|---|---|
| 1 | Prisma: enums `ContestStatus`, `ContestFinishReason`; models `Contest`, `ContestProblem`, `ContestSubmission`; back-relations. Generate the migration, then add the partial unique index `UNIQUE (user_id) WHERE status = 'ACTIVE'` to its SQL by hand | `schema.prisma`, `migrations/<ts>_phase11_contests/migration.sql` | `pnpm db:migrate`; `\d contests` shows the partial index |
| 2 | Zod schemas (start request, contest view, report) and the 6 error codes | `packages/types/src/contest.ts`, `error.ts`, `index.ts` | `pnpm --filter @guruji/types build` + lint |

### Phase 2 — Pure logic, TDD (depends on 2 for types only)

| # | Task | Files | Verify |
|---|---|---|---|
| 3 | `selectProblems(candidates, solved, now)`: weakest topics first, EASY/MEDIUM/HARD mix, nearest-difficulty fill, solved fallback least-recent-first, `< 3` → refuse | `selection.ts`, `selection.spec.ts` | unit: spec §2, edge cases 5, 6, 7 |
| 4 | `pointsFor`, `scoreContest` (ACCEPTED with `createdAt ≤ deadlineAt`; `INTERNAL_ERROR` not an attempt), `shouldFinish(now, contest)` | `scoring.ts`, `scoring.spec.ts` | unit: spec §7–8, edge cases 2, 4, 10, 12 |
| 5 | `buildReport(...)`: per-problem summary, weak area (most unsolved → lower mastery → harder), all-solved → `null` + slowest | `report.ts`, `report.spec.ts` | unit: spec §10, edge case 13 |

### Phase 3 — API (depends on 1–5)

| # | Task | Files | Verify |
|---|---|---|---|
| 6 | Export `SubmissionsService` and `CandidatesService` from their modules | `execution.module.ts`, `recommendations.module.ts` | api typecheck; existing suites unchanged |
| 7 | `ContestsService.start` / `view` / `latest` + lazy TIME_UP on read; one-active via the unique index (map Prisma `P2002` → `CONTEST_ALREADY_ACTIVE` with the active id) | `contests.service.ts` | e2e in task 11 |
| 8 | `ContestsService.submit` (deadline + membership checks, then `SubmissionsService.submit`, then `ContestSubmission`), `finish` (idempotent, stores score), `report` | `contests.service.ts` | e2e in task 11 |
| 9 | Controller (6 routes, Zod parsing, other user's id → 404), module, register in `AppModule` | `contests.controller.ts`, `contests.module.ts`, `app.module.ts` | api typecheck + lint |
| 10 | Hint gate: `assertMentorAllowed(userId, problemId)` on the service; called from the 5 mentor routes; allowed for non-contest problems and with `hintsAllowed` | `contests.service.ts`, `ai.service.ts`, `ai.module.ts` | e2e in task 12 |
| 11 | API e2e: happy path; one active + concurrent double start; `CONTEST_ENDED` (deadline moved into the past); `PROBLEM_NOT_IN_CONTEST`; `CONTEST_NOT_FINISHED`; other user → 404; finish twice; contest submissions visible to analytics | `apps/api/test/contests.e2e-spec.ts` | `pnpm --filter @guruji/api test test/contests.e2e-spec.ts` |
| 12 | Hint-gate e2e: refused while active with hints off (hint and show-solution), allowed with `hintsAllowed`, allowed for a non-contest problem | `apps/api/test/hints.e2e-spec.ts` | same, one file |

### Phase 4 — Web (depends on 9; integration point is task 13)

| # | Task | Files | Verify |
|---|---|---|---|
| 13 | `contestApi` (start, latest, get, submit, finish, report) | `lib/api.ts` | web typecheck |
| 14 | `Countdown`: from `serverNow` + `deadlineAt`, one timer, text, announces at 10 and 1 min, reduced-motion safe; on zero asks the parent to refetch | `components/contest/countdown.tsx` | browser (task 18) |
| 15 | `/contest`: start state (60/90, hints toggle, rules), active state (3 problems with state, Finish), report state; nav item ready | `app/(app)/contest/page.tsx`, `components/contest/contest-view.tsx`, `app-shell.tsx` | typecheck + lint |
| 16 | Report component: score, weak area in words with its evidence, per-problem table, "seen before" marks | `components/contest/contest-report.tsx` | browser (task 18) |
| 17 | Editor contest mode: page reads `?contest=`, workspace shows countdown + back link and hides the mentor when hints are off, `use-submission` submits to the contest endpoint | `problems/[slug]/page.tsx`, `workspace.tsx`, `use-submission.ts` | typecheck + existing `editor.spec.ts` still green |
| 18 | Playwright journey: start → 3 problems + countdown → open one (no mentor) → submit → reload resumes same deadline → finish → report with weak area; no console errors. Add `/contest` to warmed routes | `apps/web/e2e/contest.spec.ts`, `e2e/auth.setup.ts` | `pnpm e2e:stack`, then this one file |

### Phase 5 — Docs and close-out (depends on 11, 12, 18)

| # | Task | Files | Verify |
|---|---|---|---|
| 19 | As-built API and data notes | `docs/api.md`, `docs/database.md` | read-through |
| 20 | `pnpm --filter @guruji/web build`; tick only verified Phase 11 items | `TODO.md` | build output seen |

### Parallel vs sequential

| Parallel group | Tasks | Why |
|---|---|---|
| A | 3, 4, 5 | independent pure files, one spec each |
| B | 11, 12 | separate test files (run one at a time: shared queue) |
| C | 14, 16 | independent components |

| Sequential | Depends on | Why |
|---|---|---|
| 2 | 1 | schemas mirror the model |
| 7, 8 | 3, 4, 5, 6 | the service composes the pure logic and the exported services |
| 9, 10 | 7, 8 | routes and the gate call the service |
| 13 | 9 | client mirrors the routes |
| 15, 17 | 13, 14 | pages use the client and the countdown |
| 18 | 15, 16, 17 | journey needs every screen |
| 20 | 18 | tick only after the browser run |

Runs are one package or one file at a time (project rule 1); the API e2e files
and the runner share one BullMQ queue, so they never run concurrently.

---

## Testing plan

| Layer | Tests | Spec trace |
|---|---|---|
| Data | migration applies; partial unique index rejects a second ACTIVE row for a user (task 11 concurrent start) | §3, edge 3 |
| Logic | `selection.spec.ts` — weakest first, mix, nearest fill, solved fallback, refuse `< 3`, brand-new user | §2, edge 5, 6, 7 |
| Logic | `scoring.spec.ts` — points, before-deadline rule, judged-after-deadline counts, `INTERNAL_ERROR` not an attempt, lazy finish, finish idempotent | §7, §8, edge 2, 4, 10, 12 |
| Logic | `report.spec.ts` — weak area tie-breaks, all solved → slowest, evidence text, "seen before" | §10, edge 13 |
| API | `contests.e2e-spec.ts` — happy path, one active, `CONTEST_ENDED`, `PROBLEM_NOT_IN_CONTEST`, `CONTEST_NOT_FINISHED`, 404 for another user, finish twice, analytics sees contest submissions | §1, 3, 5–8, 10, edge 1, 3, 11, 12 |
| API | `hints.e2e-spec.ts` — gate on/off/non-contest, show-solution included | §9, edge 8 |
| UI | `contest.spec.ts` — start, countdown, editor contest mode without mentor, submit, reload resumes, finish, report, no console errors | §4, §6, §11, edge 9 |

Not automated, stated plainly: the 10- and 1-minute screen-reader
announcements (checked by reading the DOM's live region in the browser test,
not by a real screen reader).

---

## Not in this plan (spec nice-to-haves)

Contest history list, `StudySession` with `source = CONTEST`, feeding contest
recency into `MOCK_CHALLENGE`, "practise this weak area" button. Each is a
small follow-up once the core is verified.
