# Phase 2 — Question platform

> **Status:** done · 2026-09-19
> **One sentence:** there is now something to learn from — a curriculum, a
> problem bank, and the pages that let you browse and read both.

If you read only one section, read [The bugs this phase
caught](#the-bugs-this-phase-caught). One of them was in data, not code, and
data bugs do not throw.

---

## What you can actually do now

```
┌─────────────────────────────────────────────────────────────┐
│  1. Open /roadmap        → the curriculum, as a tree         │
│  2. Click a topic        → its problems, filtered            │
│  3. Open /problems       → filter, search, scroll for more   │
│  4. Copy the URL         → the filters come with it          │
│  5. Open a problem       → statement, constraints, examples, │
│                            sample tests, limits              │
└─────────────────────────────────────────────────────────────┘
```

What you cannot do is write code against a problem. That is Phase 3, and
running it is Phase 4.

---

## The shape of the content model

Five things, and the distinction between the first two is the one that matters.

```
Topic  ──< ProblemTopic >──  Problem  ──<  TestCase
  │                             │
  │                             ├──<  Hint
  └──< TopicPrerequisite        │
                                └──<  ProblemPattern  >──  Pattern
RoadmapNode ──> Topic  (one node per topic, parent/child = curriculum order)
```

**A topic is a subject. A pattern is a technique.** Arrays is a topic; Sliding
Window is a pattern. Conflating them is the modelling mistake this schema exists
to avoid, because "I am weak at Graphs" and "I am weak at BFS" are different
diagnoses and the recommendation engine in Phase 7 has to tell them apart.

Both joins carry a `relevance` of `PRIMARY` or `SECONDARY` — a problem tagged
Arrays-primary is _about_ arrays; one tagged Arrays-secondary merely touches
them. Phase 7 weights those differently.

### Prerequisites are a table, not a column

`docs/database.md` describes `Topic` as carrying self-referencing
`prerequisiteIds`. It is a join table instead. A `uuid[]` column cannot carry a
foreign key, so deleting a topic would leave dangling ids behind and the roadmap
would draw edges to nothing. The table costs one extra query at seed time and
makes that failure impossible.

---

## What was built

### The seed is the phase

Twelve original problems, five easy, five medium, two hard, across nine of the
twelve patterns. Each one has a statement, constraints, two worked examples,
starter code in four languages, eight test cases and a three-level hint ladder.

No third-party problem statement is reproduced. The tasks are classic — a
sliding window, a keyset of intervals, a binary search on an answer — but every
word of every statement was written for this project, and every test case was
authored here.

**The hints escalate and never open with the answer.** Level 1 asks a question,
level 2 names the shape of the idea, level 3 describes the algorithm. That
ladder is what Phase 8 measures hint dependency against, so it had to be real
from the start rather than three restatements of the same sentence.

### Idempotency is stronger than "no duplicates"

The obvious reading of "the seed is idempotent" is that re-running it does not
double the rows. That is necessary and not sufficient. A seed that deletes its
children and recreates them passes a row count check — and hands every test case
a brand new id.

From Phase 4, `SubmissionResult` rows point at `TestCase.id`. So the seed
upserts children on their natural key (`problemId` + `displayOrder` for test
cases, `problemId` + `level` for hints) and deletes only what has fallen off the
end of the list. The test asserts both: counts stable, **and** the full set of
ids unchanged.

### Hidden test cases are filtered in the repository

`GET /problems/:slug` returns sample cases only. That filter lives in
`apps/api/src/content/problem.repository.ts` and nowhere else. There is no query
in that file that can return a hidden case, so an endpoint written in Phase 6 by
someone who has never read this document cannot leak one by forgetting a
`where`.

The e2e suite checks it from both directions: no hidden id appears in any
content response, and the ids that _do_ come back are exactly the sample set.

### Cursor pagination, not offset

Ordered by `(createdAt desc, id desc)`, with the cursor holding both. `createdAt`
alone is not unique — the seed inserts a dozen problems inside the same
millisecond — so a cursor on the timestamp alone would drop every row sharing it.

The test that matters inserts a new problem _between_ two page fetches and then
asserts that page 2 repeats nothing and skips nothing. Offset pagination fails
that test by construction.

### Filters live in the URL

Every filter on `/problems` is a search parameter. A filtered list you cannot
link to is a list you cannot send to anyone, and the back button silently loses
your place.

---

## The bugs this phase caught

### 1. Five of the seeded answers were wrong

The test cases were written by hand. Before seeding them, each expected output
was checked against an independent reference implementation of the problem.

Five disagreed:

| Problem                      | Input               | Written | Correct |
| ---------------------------- | ------------------- | ------- | ------- |
| `minimum-belt-capacity`      | `5 3 / 3 2 2 4 1`   | 6       | **5**   |
| `grid-routes-with-blockages` | 4×4 with two blocks | 8       | **4**   |
| `grid-routes-with-blockages` | 3×3 corners blocked | 2       | **4**   |
| `longest-distinct-window`    | `pwwkeqwe`          | 5       | **4**   |
| `longest-distinct-window`    | `abbacdeffe`        | 4       | **6**   |

Every one was a mistake in arithmetic done in a head rather than in a program.
One of them was a _sample_ case, which means it would have been printed on the
problem page as a worked example — a user would have solved the problem
correctly and been told they were wrong, by a page that also showed them the
wrong answer.

Nothing in a type system, a linter or a test suite catches this. The only thing
that catches it is running the data against a second implementation, which is
now a step, not an afterthought.

### 2. The stale `dist` that was not stale

The API typecheck failed with "Property 'problem' does not exist on type
'PrismaClient'" against a `packages/database/dist` that had been rebuilt after
the migration. Rebuilding it again with `--force` fixed nothing, because nothing
was wrong with it — the failing run had read the directory mid-write. The lesson
is narrow: in a workspace where one package's build output is another's type
source, a failure straight after a regeneration is worth repeating once before
being investigated.

### 3. Two React rules the compiler enforces now

`pnpm lint` rejected two patterns that look completely ordinary:

- Syncing state from a prop inside `useEffect` — "Calling setState synchronously
  within an effect can trigger cascading renders". The fix is to adjust during
  render, which `app-shell.tsx` already does to close the drawer on navigation.
- Writing to a ref during render — "Cannot access refs during render". The
  latest-callback ref for the infinite-scroll observer now updates in an effect.

Both were caught by lint, not by the build. `pnpm build` is not the last gate.

### 4. The filter that would have lied

`docs/api.md` lists a `status` filter — solved, attempted, unsolved — on
`GET /problems`. It is derived from submissions, and submissions do not exist
until Phase 4.

Accepting the parameter and ignoring it would have produced a filter that
silently returns everything. The API rejects it instead, with a 400, and there is
a test asserting that. It arrives in Phase 5 with the data behind it.

---

## What is deliberately not done

- **`status` filter and solved badges.** No submissions to derive them from.
- **Mastery overlay on topics and the roadmap.** Phase 5. When it lands, the
  cache key for those responses must gain the user id — a shared cache key that
  later becomes user-specific is the caching bug that shows one person another
  person's progress. `topic(slug)` is left uncached today for exactly that
  reason.
- **Cache invalidation on content change.** TTL only. Nothing writes content in
  Phase 2 — it changes by re-seeding — so an invalidation hook would have had no
  caller.
- **A demo user with submission history.** `docs/database.md` asks the seed to
  produce one. It cannot until `Submission` exists.
- **Acceptance rate.** The column is there and every problem reads `null`, which
  the UI renders as "no data" rather than 0%. Zero would claim nobody has ever
  solved it.

---

## Running it yourself

```bash
pnpm infra:up          # Postgres + Redis
pnpm db:migrate        # applies 20260919073035_phase2_content_models
pnpm db:seed           # idempotent — run it twice, nothing changes
pnpm dev               # api on :4000, web on :3000
```

```bash
curl -s localhost:4000/api/roadmap | head -c 200
curl -s 'localhost:4000/api/problems?difficulty=HARD'
curl -s localhost:4000/api/problems/pair-sums-to-target
```

---

## Gate 2 — the finish line

| Check                             | Result                          |
| --------------------------------- | ------------------------------- |
| `pnpm lint`                       | clean                           |
| `pnpm typecheck`                  | clean                           |
| `pnpm build`                      | clean, 8 routes                 |
| `pnpm test`                       | 40 passed (35 API, 5 database)  |
| Seed run twice                    | identical counts, identical ids |
| Seeded answers vs reference       | 96/96 agree                     |
| Hidden test cases in any response | none                            |

---

## What comes next

**Phase 3 — Code editor.** Monaco, configured without `unsafe-eval` so the CSP
in `docs/security.md` stays real, per-language drafts that survive a reload, and
the split statement/editor/results layout the problem page is currently missing.
