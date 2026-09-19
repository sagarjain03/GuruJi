# GuruJi — Database Design

> PostgreSQL 17 · Prisma 7 (stable)
> Last updated: 2026-09-18

---

## Conventions

These are enforced, not suggestions.

| Rule | Detail |
|---|---|
| Identifiers | SQL is `snake_case`; Prisma models are `PascalCase`; fields are `camelCase` with `@map` to the SQL name |
| Primary keys | `uuid` — no sequential integers exposed to the client |
| Timestamps | `TIMESTAMPTZ`, always UTC. `createdAt` on every table; `updatedAt` where rows mutate |
| Enums | Native Postgres enums for closed sets (difficulty, verdict, language). Not for anything a user might extend |
| Foreign keys | Always declared, with an explicit `onDelete` per relation |
| Indexes | Every index traces to a named query. An index with no query behind it is deleted |
| Soft delete | Only where a product requirement exists — user accounts and user-authored notes. Not by reflex |

### Why `uuid` and not `bigserial`

Problem and user ids appear in URLs. Sequential ids leak volume ("we have 41
users") and invite enumeration. The index-locality cost of random UUIDs is real
but irrelevant at our write volume.

### Why UTC everywhere

Revision scheduling and streak counting both do date arithmetic. Mixed
timezones make "did they solve something yesterday?" ambiguous, and the bug
surfaces months later as a streak that breaks at midnight for some users only.
Store UTC, convert in the browser at render time, never on the server.

---

## Domain map

Five clusters. Read them as: content, activity, intelligence, learning,
gamification.

```
CONTENT                  ACTIVITY                  INTELLIGENCE
Topic                    Submission                UserTopicProgress
Pattern                  SubmissionResult          UserPatternProgress
RoadmapNode              StudySession              Recommendation
Problem                  Mistake
ProblemTopic
ProblemPattern           LEARNING                  GAMIFICATION
TestCase                 RevisionItem              Achievement
Hint                     AIConversation            UserAchievement
                         AIMessage                 DailyGoal
IDENTITY                 Contest
User                     ContestProblem
Profile                  ContestSubmission
RefreshToken             Draft
```

---

## Identity

### `User`

`id`, `email` (unique, citext-normalised lowercase), `passwordHash`, `role`,
`emailVerifiedAt`, `createdAt`, `updatedAt`, `deletedAt`.

The hash is Argon2id. The column is never selected into any DTO — repositories
return explicit field lists, so a careless `findUnique` cannot leak it.

### `Profile`

One-to-one with `User`. Holds the **learning profile** that the whole product
personalises against:

```
userId (pk, fk)
displayName
preferredLanguage      enum: CPP | C | PYTHON | JAVASCRIPT
experienceLevel        enum: BEGINNER | INTERMEDIATE | ADVANCED
dailyGoalMinutes
difficultyTolerance    float 0..1, derived
hintDependency         float 0..1, derived
retentionScore         float 0..1, derived
currentStreak, longestStreak, lastActiveDate
timezone               IANA name, e.g. "Asia/Kolkata" — a preference, not a timestamp
onboardingCompletedAt
```

`timezone` is stored as an IANA identifier because streaks and daily goals are
*local-day* concepts, and a fixed offset like `+05:30` breaks across DST. It is
the one place a timezone is stored, and it never sits next to a timestamp.

The derived floats are denormalised deliberately — they are read on every
dashboard load and recomputed only on submission.

### `RefreshToken`

`id`, `userId`, `tokenHash`, `expiresAt`, `revokedAt`, `replacedById`,
`userAgent`, `ipHash`.

Tokens are stored hashed, never plaintext. Rotation sets `replacedById`; reuse
of a rotated token is treated as theft and revokes the whole chain.

---

## Content

### `Topic` and `Pattern`

Separate concepts, and conflating them is the modelling mistake to avoid.

- A **topic** is a data structure or subject area: Arrays, Graphs, DP.
- A **pattern** is a reusable solving technique: Sliding Window, Two Pointer,
  Binary Search on Answer.

A problem is tagged with both. "I am bad at Graphs" and "I am bad at BFS" are
different diagnoses, and the recommendation engine needs to tell them apart —
which is why `UserTopicProgress` and `UserPatternProgress` are separate tables
rather than one polymorphic one.

Both carry `slug`, `name`, `description`, `displayOrder`, and `Topic` carries a
self-referencing `prerequisiteIds` for the roadmap.

### `RoadmapNode`

The roadmap lives here, not in a React component. `id`, `topicId`, `parentId`,
`section` (FOUNDATION / DATA_STRUCTURES / TREES / GRAPHS / ADVANCED),
`displayOrder`, `estimatedHours`.

Changing the curriculum must be a data change, not a deploy.

### `Problem`

```
id, slug (unique), title, difficulty (EASY|MEDIUM|HARD)
statement            markdown
constraints          markdown
examples             jsonb — [{ input, output, explanation }]
starterCode          jsonb — { cpp, c, python, javascript }
timeLimitMs, memoryLimitMb
estimatedMinutes
source               enum: ORIGINAL | LICENSED | EXTERNAL_REFERENCE | AI_GENERATED
sourceUrl
aiGenerated          boolean
reviewStatus         enum: DRAFT | IN_REVIEW | PUBLISHED | REJECTED
acceptanceRate       denormalised, recomputed periodically
createdAt, updatedAt
```

`source` and `reviewStatus` exist for a legal and a quality reason. Third-party
statements are not republished — for `EXTERNAL_REFERENCE` we store metadata,
our own summary and a link. And an AI-generated problem is never `PUBLISHED`
without passing the validation pipeline in [ai.md](./ai.md) plus human review.

`ProblemTopic` and `ProblemPattern` are explicit join tables rather than
implicit many-to-many, because both carry `relevance` (primary vs secondary tag)
— the recommendation engine weights a problem's primary topic more heavily.

### `TestCase`

`id`, `problemId`, `input`, `expectedOutput`, `isSample`, `isHidden`,
`displayOrder`, `weight`.

Sample cases are returned to the client. Hidden cases are never serialised into
any response — that filtering lives in the repository, not the controller, so it
cannot be forgotten at a call site.

### `Hint`

`id`, `problemId`, `level` (1..n, ordered), `content`. Curated hints are served
before the model is asked to generate one — they are better and they are free.

---

## Activity

### `Submission`

```
id, userId, problemId, contestId?
language, code
status        QUEUED | RUNNING | COMPLETED | FAILED
verdict       ACCEPTED | WRONG_ANSWER | TIME_LIMIT_EXCEEDED
              | MEMORY_LIMIT_EXCEEDED | RUNTIME_ERROR | COMPILE_ERROR | INTERNAL_ERROR
runtimeMs, memoryKb
passedCount, totalCount
compileOutput
isRun         true = "Run" against samples, false = graded submit
hintsUsedAtSubmit
timeSpentMs
createdAt, completedAt
```

`status` and `verdict` are separate on purpose. `status` is the lifecycle of our
job; `verdict` is the judgement of the code. A `FAILED` status with no verdict
means *our* infrastructure broke, and that must never be recorded against the
user's accuracy.

`isRun` keeps exploratory runs out of the mastery signal. Counting them would
punish users for testing their thinking, which is the opposite of the product.

Indexes: `(userId, createdAt desc)` for history, `(userId, problemId)` for
per-problem history, `(problemId, verdict)` for acceptance rate.

### `SubmissionResult`

Per test case: `submissionId`, `testCaseId`, `passed`, `runtimeMs`, `memoryKb`,
`actualOutput` (truncated, capped), `errorMessage`.

Output is capped at write time. An unbounded `actualOutput` is a storage-denial
vector — a program that prints a gigabyte would otherwise land in the database.

### `Draft`

`id`, `userId`, `problemId`, `language`, `code`, `createdAt`, `updatedAt`.

Unsubmitted code. Unique on `(userId, problemId, language)`, which is also the
autosave upsert target — one draft *per language*, because switching from C++ to
Python to try an idea must not destroy the C++ attempt.

A draft is not a submission and never becomes one: submitting stores its own
copy of the code, so editing the draft afterwards cannot rewrite the history of
what was actually judged.

Index on `(userId, updatedAt)` — "what was I last working on", read by the
dashboard from Phase 5.

### `Mistake`

The mistake journal. `id`, `userId`, `problemId`, `submissionId`,
`category` (LOGIC | SYNTAX | EDGE_CASE | COMPLEXITY | IMPLEMENTATION |
MISREAD_PROBLEM | WRONG_PATTERN | OFF_BY_ONE | OVERFLOW), `whatWentWrong`,
`correctIdea`, `aiAnalysis`, `createdAt`.

Category is an enum because the value of this table is aggregation — "you have
made this mistake in 3 sliding-window problems" only works if the categories are
closed.

### `StudySession`

`userId`, `startedAt`, `endedAt`, `problemsAttempted`, `problemsSolved`,
`source` (PRACTICE | REVISION | CONTEST | ASSESSMENT). Feeds daily goals and
the activity heatmap.

---

## Intelligence

### `UserTopicProgress` / `UserPatternProgress`

One row per (user, topic) and (user, pattern):

```
attempts, solved, firstAttemptSolved
totalTimeMs, averageTimeMs
hintsUsed
masteryScore        0..100
lastPracticedAt
easyCount, mediumCount, hardCount    solved-by-difficulty
```

These are **materialised, not computed on read**. The dashboard shows a mastery
bar per topic on every load; recomputing from the full submission history each
time would not survive contact with a real user's history. They are updated in
the same transaction as the submission, so they cannot drift.

Unique constraint on `(userId, topicId)` — the upsert target.

### `Recommendation`

`id`, `userId`, `kind` (REVISION | WEAK_TOPIC | NEW_PATTERN | MOCK_CHALLENGE |
NEW_PROBLEM), `problemId?`, `score`, `reason`, `generatedAt`, `consumedAt`,
`expiresAt`.

Persisted rather than computed-and-discarded for two reasons: `reason` is shown
to the user, and stored recommendations let us evaluate the engine later
(did the user accept it? did they solve it?).

---

## Learning

### `RevisionItem`

```
id, userId, problemId
intervalDays, easeFactor (default 2.5), repetitions, lapses
dueAt, lastReviewedAt
state       LEARNING | REVIEWING | MASTERED | LAPSED
```

Unique on `(userId, problemId)`. Index on `(userId, dueAt)` — "what is due
today" is the single most frequent query in the product. Algorithm in
[revision-engine.md](./revision-engine.md).

### `AIConversation` / `AIMessage`

Conversation: `userId`, `problemId?`, `mode` (HINT | EXPLAIN | ANALYZE |
WRONG_ANSWER | GENERATE), `createdAt`.
Message: `conversationId`, `role`, `content`, `hintLevel?`, `tokensUsed`,
`model`, `createdAt`.

`hintLevel` tracks escalation so a reload cannot reset a user back to hint 1 —
and so hint dependency is measurable.

We store the user's message and the model's reply. We do **not** store system
prompts per message; they are versioned in code.

### `Contest` / `ContestProblem` / `ContestSubmission`

Contest: `userId`, `title`, `durationMinutes`, `startedAt`, `endedAt`,
`score`, `status`. Join table orders problems and holds points. Contest
submissions reference `Submission` rather than duplicating code storage.

---

## Gamification

`Achievement` (slug, name, description, criteria jsonb, icon),
`UserAchievement` (userId, achievementId, unlockedAt),
`DailyGoal` (userId, date, targetMinutes, achievedMinutes, completed).

`DailyGoal.date` is a `DATE` in the user's local timezone, resolved from
`Profile.timezone` at write time. This is the only place a local-day concept is
persisted, and it is deliberate: a streak that resets at UTC midnight is wrong
for most of the world.

None of these tables feed mastery. That separation is the point.

---

## Transactional boundaries

One transaction per meaningful unit of work:

| Operation | Inside the transaction |
|---|---|
| Submission completion | `SubmissionResult` rows, `Submission` verdict, topic progress, pattern progress, revision schedule, streak |
| Revision completion | `RevisionItem` update, retention contribution to progress |
| Registration | `User` + `Profile` + initial `DailyGoal` |
| Contest completion | Contest status, score, per-problem submissions |

A partial write in the first row would mean a user whose mastery moved but whose
revision never got scheduled — a silent, unnoticeable corruption of the learning
model. Hence all-or-nothing.

---

## Indexing plan

| Index | Query it serves |
|---|---|
| `Submission (userId, createdAt desc)` | submission history, activity chart |
| `Submission (userId, problemId, createdAt desc)` | per-problem attempt history |
| `Submission (problemId, verdict)` | acceptance-rate recomputation |
| `RevisionItem (userId, dueAt)` | "due today" — hottest query in the app |
| `UserTopicProgress (userId, masteryScore)` | weak-topic ranking |
| `Problem (difficulty, reviewStatus)` | filtered problem list |
| `ProblemTopic (topicId, problemId)` | candidate generation by topic |
| `Mistake (userId, category, createdAt desc)` | mistake aggregation |
| `AIMessage (conversationId, createdAt)` | conversation replay |

---

## Seed data

Seeding must produce a product that can be *demonstrated*, not an empty shell:

- 14 topics, 12 patterns, a full roadmap tree with prerequisites
- Enough original problems to cover every difficulty and several patterns, each
  with real test cases and real curated hints
- A demo user with plausible submission history, so mastery, revision and
  recommendations all have something to work with

The seed is idempotent — `upsert` by `slug`, never `create`. Re-running it must
not duplicate the roadmap.

No copyrighted problem statements are seeded. Original or openly licensed only.
