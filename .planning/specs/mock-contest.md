# Spec: Mock contest (Phase 11)

**Created**: 2026-09-28
**Status**: draft
**Author**: Sagar Jain
**Epic**: none (roadmap Phase 11)

---

## Problem

Everything in GuruJi today is untimed practice. A learner can solve a problem
after an hour, three hints and five resubmissions, and nothing tells them how
they would do under interview conditions: a clock, no help, several problems at
once. They have no honest read on where they actually break down when it
counts.

## Goal

A learner can start a timed, hint-free set of 3 problems, work through it (and
come back to it) until the server-held deadline, and get a report that names
**one** weak area, built only from signals GuruJi already records.

Measured by: a contest can be started, submitted to, finished (early or by the
clock), and reported on, end to end, in a real browser; no submission after the
deadline is ever accepted into the contest.

## User stories

- As a learner preparing for interviews, I want to take 3 problems against a
  60- or 90-minute clock without hints, so that I learn how I perform under
  real conditions rather than in comfortable practice.
- As a learner who got interrupted, I want to close the tab and come back
  before the deadline and carry on, so that a browser crash does not cost me
  the attempt — while the clock keeps running, as it would in a real test.
- As a learner who just finished, I want a report that tells me which topic or
  pattern let me down and why, so that I know what to practise next.

---

## Requirements

### Must have

1. **Start** — `POST /contests` with `durationMinutes` ∈ {60, 90}. The server
   picks 3 problems and stores `startedAt` and `deadlineAt = startedAt + duration`.
2. **Problem selection** (server-side, deterministic for a given state):
   - Rank topics weakest first, reusing the recommendation engine's weak-topic
     ranking (`candidates.service`), and take **unsolved** problems from them.
   - Aim for one EASY, one MEDIUM, one HARD. If a difficulty has no candidate,
     fill from the next nearest difficulty.
   - **Fallback** (the pool is 12 problems): when fewer than 3 unsolved
     problems exist, fill with previously solved problems, least recently
     practised first, and mark them `wasSolvedBefore = true`. The report says
     so rather than pretending they were cold.
   - Fewer than 3 problems in the whole catalogue → `409 CONTEST_UNAVAILABLE`.
3. **One active contest per user.** Starting while one is active returns
   `409 CONTEST_ALREADY_ACTIVE` with the active contest's id. Enforced in the
   database (partial unique index), not only in code.
4. **Timer is the server's.** `deadlineAt` is stored at start. The client shows
   a countdown from `deadlineAt` and the server's `now` in each response
   (clock skew safe); it never decides anything.
5. **Submit** — `POST /contests/:id/submissions` `{ problemId, language, code }`
   creates a normal graded `Submission` through the existing submissions
   service (so it judges, counts toward mastery and revision exactly like any
   graded submission) and links it via `ContestSubmission`.
   - Refused with `409 CONTEST_ENDED` when `now > deadlineAt` or the contest is
     finished; `422 PROBLEM_NOT_IN_CONTEST` for a problem outside the set.
   - A submission made before the deadline counts even if judging finishes after it.
   - "Run" against samples keeps using the existing `/submissions` with
     `isRun: true`; runs are never contest submissions.
6. **Resume** — `GET /contests/:id` returns the contest, its problems (in
   order), per-problem status (unsolved / attempted / solved), `deadlineAt`
   and server `now`. `GET /contests/latest` returns the most recent contest, active or finished, or `null` — so a report is never lost to a closed tab (changed from `/contests/active` during build).
7. **Finish** — `POST /contests/:id/finish` ends it early. A contest past its
   deadline is finished **lazily** on the next read or write (no cron):
   `finishReason` = `EARLY` | `TIME_UP`.
8. **Score** — points per problem: EASY 100, MEDIUM 200, HARD 300. A problem
   scores when it has an ACCEPTED contest submission created before the
   deadline. `score` and `maxScore` are stored on finish.
9. **Hints off by default.** While a contest is active, every AI mentor route
   (`/ai/hint`, `/ai/explain`, `/ai/analyze-code`, show-solution,
   explain-wrong-answer) refuses requests for that contest's problems with
   `403 CONTEST_HINTS_DISABLED` — unless the contest was started with
   `hintsAllowed: true`, in which case hints work and the report counts them.
10. **Report** — `GET /contests/:id/report`, finished contests only
    (`409 CONTEST_NOT_FINISHED` otherwise). Built from existing signals only:
    per problem — solved?, attempts, time from `startedAt` to first ACCEPTED,
    topics/patterns, hints used; plus mistake categories logged against the
    contest's submissions. **Weak area rule** (deterministic):
    - Candidates = topics and patterns of unsolved problems.
    - Pick the one on the most unsolved problems; tie → lower current mastery;
      tie → higher difficulty problem.
    - All solved → no weak area; name the topic of the **slowest** solve as
      "slowest", clearly labelled as not a weakness.
    - The report states which evidence it used ("unsolved: Kth Slowest
      Response (Heaps); 2 wrong answers, logged as LOGIC").
11. **Web** — `/contest` page: start screen (60/90, hints toggle, the rules in
    plain words), active screen (countdown, the 3 problems with status, Finish
    button), and report screen. Solving opens the existing editor in contest
    mode: submit goes to the contest endpoint, the mentor panel is hidden when
    hints are off, and the countdown is visible. The nav's Contest entry
    becomes ready.
12. **Assessment framing.** No leaderboard, no ranks, no comparison with other
    users anywhere.

### Nice to have

- A contest history list on `/contest` (past contests with score and weak area).
- Record a `StudySession` with `source = CONTEST`.
- Feed "contest in the last 7 days" into the recommendation engine's
  `MOCK_CHALLENGE` precedence rule (it exists in `ranking.ts`).
- "Practise this weak area" button on the report linking to that topic.

### Out of scope

- Multi-user or shared contests, leaderboards, ranking, rating.
- Custom problem picking or durations other than 60/90.
- Pausing the clock.
- Contest-specific test cases, partial scoring per test case, or penalties for
  wrong submissions.
- New signals in the mastery model (the model is unchanged; contest
  submissions are just graded submissions).

---

## Data model

New enums: `ContestStatus` (`ACTIVE`, `FINISHED`), `ContestFinishReason`
(`EARLY`, `TIME_UP`). All ids `uuid(7)`, all times `TIMESTAMPTZ` (UTC).

```
Contest
  id               uuid pk
  userId           uuid → users (cascade)
  status           ContestStatus       default ACTIVE
  durationMinutes  int                 60 | 90 (validated at the edge)
  hintsAllowed     boolean             default false
  startedAt        timestamptz
  deadlineAt       timestamptz
  finishedAt       timestamptz?
  finishReason     ContestFinishReason?
  score            int                 default 0
  maxScore         int
  createdAt, updatedAt
  @@index([userId, startedAt])
  -- raw SQL in the migration:
  UNIQUE (user_id) WHERE status = 'ACTIVE'

ContestProblem
  id               uuid pk
  contestId        uuid → contests (cascade)
  problemId        uuid → problems (cascade)
  position         int                 1..3, display order
  points           int                 100 | 200 | 300
  wasSolvedBefore  boolean
  createdAt
  @@unique([contestId, problemId])
  @@unique([contestId, position])

ContestSubmission
  id               uuid pk
  contestId        uuid → contests (cascade)
  problemId        uuid → problems (cascade)
  submissionId     uuid → submissions (cascade), unique
  createdAt
  @@index([contestId, problemId])
```

Contest submissions reference `Submission` rather than copying code
(docs/database.md). **Soft delete: none** — contests are history owned by the
user and cascade with the account, like submissions.

---

## API changes

Follows the existing API: JSON is **camelCase** (as every current endpoint
is), errors use the standard envelope, every route needs a session. Shared Zod
schemas live in `packages/types/src/contest.ts`.

| Method | Route | Success |
|---|---|---|
| POST | `/contests` | 201 contest view |
| GET | `/contests/latest` | 200 most recent contest view (any status) or `null` |
| GET | `/contests/:id` | 200 contest view |
| POST | `/contests/:id/submissions` | 202 `{ id, status }` (as `/submissions`) |
| POST | `/contests/:id/finish` | 200 contest view |
| GET | `/contests/:id/report` | 200 report |

```jsonc
// POST /contests
{ "durationMinutes": 60, "hintsAllowed": false }

// 201 — contest view (also GET /contests/:id, /contests/latest)
{
  "id": "01a0…",
  "status": "ACTIVE",
  "durationMinutes": 60,
  "hintsAllowed": false,
  "startedAt": "2026-09-28T13:30:00.000Z",
  "deadlineAt": "2026-09-28T14:30:00.000Z",
  "finishedAt": null,
  "finishReason": null,
  "serverNow": "2026-09-28T13:30:00.120Z",
  "score": 0,
  "maxScore": 600,
  "problems": [
    { "position": 1, "problemId": "01a0…", "slug": "reverse-the-transcript",
      "title": "Reverse the Transcript", "difficulty": "EASY", "points": 100,
      "wasSolvedBefore": false, "state": "UNSOLVED", "attempts": 0 }
  ]
}

// GET /contests/:id/report
{
  "contestId": "01a0…",
  "score": 300, "maxScore": 600,
  "finishReason": "TIME_UP",
  "problems": [
    { "slug": "kth-slowest-response", "title": "Kth Slowest Response",
      "difficulty": "MEDIUM", "solved": false, "attempts": 2,
      "timeToSolveMs": null, "hintsUsed": 0,
      "topics": ["Heaps & Priority Queues"], "patterns": ["Top-K"],
      "mistakeCategories": ["LOGIC"], "wasSolvedBefore": false }
  ],
  "weakArea": {
    "kind": "TOPIC", "slug": "heaps", "name": "Heaps & Priority Queues",
    "reason": "Unsolved: Kth Slowest Response. 2 wrong answers, logged as LOGIC."
  },
  "slowest": null
}
```

New error codes (added to `ERROR_CODES`): `CONTEST_UNAVAILABLE`,
`CONTEST_ALREADY_ACTIVE`, `CONTEST_ENDED`, `CONTEST_NOT_FINISHED`,
`PROBLEM_NOT_IN_CONTEST`, `CONTEST_HINTS_DISABLED`.

## UI changes

- `/contest` — start / active / report states in one route, driven by
  `GET /contests/latest` and the report endpoint.
- Editor (`/problems/[slug]`) in contest mode via `?contest=<id>`: countdown in
  the header, Submit posts to the contest endpoint, mentor panel hidden when
  hints are off, "Back to contest" link.
- Countdown reaches zero → the page reads the contest again; the server has
  finished it; the UI moves to the report.
- `prefers-reduced-motion` respected; the countdown is text, announced
  politely at 10 and 1 minute(s) remaining, not every second.
- App shell: Contest nav item `ready: true`.

---

## Edge cases

1. **Submit a second after the deadline** — refused `CONTEST_ENDED`; the UI
   shows the report path, not a generic error.
2. **Submitted before the deadline, judged after** — counts; scoring reads
   `Submission.createdAt`, not `completedAt`.
3. **Two tabs start a contest at once** — the partial unique index lets one
   win; the other gets `CONTEST_ALREADY_ACTIVE` with the winner's id.
4. **User never comes back** — the contest stays ACTIVE in the table until the
   next read/write, which finishes it as `TIME_UP`; the report is correct
   whenever it is first opened.
5. **Fewer than 3 unsolved problems** (the demo account has 1) — filled with
   solved ones, `wasSolvedBefore = true`, stated in the report.
6. **Catalogue has fewer than 3 problems** — `CONTEST_UNAVAILABLE`.
7. **No weak topics yet** (brand-new user, no mastery) — selection falls back
   to difficulty mix across any unsolved problems.
8. **Hint request for a contest problem while hints are off** — `403
   CONTEST_HINTS_DISABLED`, including via show-solution and explain routes; a
   request for a *non*-contest problem during a contest is allowed (it is not
   part of the assessment).
9. **Client clock wrong** — the countdown is derived from `serverNow` and
   `deadlineAt`; a fast/slow client clock cannot extend or cut the contest.
10. **Judge failure (`INTERNAL_ERROR`)** during a contest — not the learner's
    fault: it does not count as an attempt, and they may resubmit before the
    deadline.
11. **Another user's contest id** — `404`, never `403` (no existence leak).
12. **Finish twice / finish after TIME_UP** — idempotent; returns the finished view.
13. **All three solved** — `weakArea: null`, `slowest` names the slowest topic,
    labelled as not a weakness.

## Testing criteria

**Unit (pure functions, TDD first):**
- Problem selection: weakest topics first, difficulty mix, nearest-difficulty
  fill, solved fallback ordering, fewer-than-3 refusal.
- Scoring: points per difficulty; only ACCEPTED before `deadlineAt` counts;
  judge-after-deadline counts.
- Weak-area rule: most unsolved → lower mastery → harder problem; all solved →
  `null` + slowest.
- Lazy finish: ACTIVE past deadline → FINISHED/TIME_UP.

**API e2e (real Postgres):**
- Happy path: start → view → submit → finish → report.
- One active contest per user, including a concurrent double-start.
- `CONTEST_ENDED` after the deadline (deadline moved into the past in the test).
- `PROBLEM_NOT_IN_CONTEST`, `CONTEST_NOT_FINISHED`, other user's id → 404.
- Hints refused while active and hints off; allowed with `hintsAllowed`;
  allowed for a non-contest problem.
- Contest submissions show up in mastery/analytics like any graded submission.

**Browser (Playwright, `e2e/contest.spec.ts`, against `pnpm e2e:stack`):**
- Start a 60-minute contest, see 3 problems and a countdown.
- Open a problem in contest mode: mentor panel absent, submit goes through.
- Reload mid-contest: same contest resumes with the same deadline.
- Finish early → report with a weak area in words.
- No console errors.

## Dependencies

- Existing: submissions service and judge, recommendation engine's weak-topic
  ranking, mastery model, mistake journal, AI mentor routes (to gate).
- New Prisma migration (3 tables, 2 enums, 1 partial unique index).
- `packages/types`: contest schemas + 6 error codes.
- No new external services or packages.
