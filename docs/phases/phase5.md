# Phase 5 — Progress engine

> **Status:** done · 2026-09-20
> **One sentence:** the system now knows how well you are doing, and can say why.

---

## What you can actually do now

```
┌──────────────────────────────────────────────────────────────┐
│  1. Solve something     → counters move in the same write    │
│  2. Open the dashboard  → a bar per topic, weakest first     │
│  3. Tap a bar           → the six numbers behind the score   │
│  4. Get one wrong       → log what went wrong, categorised   │
│  5. Open the journal    → what keeps happening, and where    │
└──────────────────────────────────────────────────────────────┘
```

---

## The formula, and the thing it gets wrong if you are careless

`docs/mastery-model.md` specifies `difficultyPerformance` as a "weighted solve
rate, Easy ×1.0 / Medium ×1.6 / Hard ×2.5". The obvious reading is

```
Σ(solved × w) / Σ(attempted × w)
```

and it is wrong in a way that passes review. Whenever the mix is uniform the
weight **cancels**: six of eight easy and six of eight hard both come out at
0.75. The component that exists to separate them separates nothing, and the
model quietly stops caring about difficulty for exactly the users whose practice
is consistent.

The denominator is the *hardest* weight instead:

```
Σ(solved × w) / (attempted × w_hard)
```

A perfect run of hard problems reaches 1. A perfect run of easy ones reaches 0.4
and cannot go higher. Difficulty is a **ceiling** on the component, not a scale
factor that divides itself out.

Found by the test that asserts hard solves outscore easy ones — which is the
only reason that test is in the suite.

### Components that cannot be measured hand their weight over

Retention is revision successes over revision attempts, and revision does not
exist until Phase 6. Scoring it zero would cap everyone in the product at 80% of
a number they had no way to earn. A pattern row has no `patternCoverage` either
— coverage is a topic-level idea.

So an unmeasured component contributes nothing and its weight is redistributed
across the ones that *can* be measured. The interface says `not measured` rather
than `0%`, because "nobody has asked you yet" and "you failed this" are
different claims and must not look the same.

---

## Counters move inside the submission transaction

`ProgressService.apply` runs in the same transaction as the verdict. The
transaction had to become interactive to allow it: the update has to *read* —
has this problem been attempted before, was it already solved — and those reads
must see the same world the writes do.

Three rules the counters enforce, each one tested against the real database:

| Rule | Why |
|---|---|
| `isRun` submissions count for nothing | Testing your thinking must never be punished, and must never be credited either |
| `INTERNAL_ERROR` counts for nothing | Our runner breaking is not the user being wrong. Counting it corrupts every score downstream |
| A retry is not a second attempt | Counting submissions instead of problems rewards brute force, which is the habit the whole model exists to discourage |

`patternsSolved` is recounted rather than incremented. "Distinct patterns solved
in this topic" cannot be derived from a delta — the problem just solved may
share every pattern with one solved last week. It is a bounded query, and only
on a solve.

---

## The nightly job reports drift, and does not fix it

`ReconciliationService` recomputes every topic's counters from the submission
history and compares. Anything that disagrees is logged at `error`.

It does not correct. The counters are written inside the submission transaction,
so a drift cannot be a lost race — it means a write path reached the database
without going through that transaction. Repairing the number would leave that
path in place and delete the only evidence it exists.

Both tests matter: the recount **agrees** with the incremental path on real
history, and a counter changed behind the transaction's back **is reported and
left alone**.

One thing that had to be fixed to make this trustworthy: `speedRatio` and
`hintWeight` were duplicated, once in the write path and once in the job, under
a comment saying they must match. That is precisely the failure the job exists
to catch, except it would have been reporting its own arithmetic. They live in
one place now.

---

## What is deliberately not in the model

| Excluded | Reason |
|---|---|
| Streak | Consistency is a habit, not a skill. A model that rewarded it would let someone raise their score by logging in — so it is shown on the dashboard and kept out of the formula |
| Volume solved | Already an input to `accuracy` and `patternCoverage`. Counting it again double-rewards volume |
| Anything gamified | XP and badges are how "500 solved, understands nothing" outranks real competence |

---

## The journal is a diagnosis, not a diary

Categories are a closed enum. Free text would make every entry a category of
one, and `GET /mistakes/patterns` would have nothing to aggregate — the feature
would be a diary, and nobody practises differently because of a diary.

The form is offered in the result panel after a wrong answer, not on a page the
user has to remember to visit. The moment a submission fails is the only moment
the reason is still in their head. It is not offered for an accepted answer, and
not for `INTERNAL_ERROR` — there is nothing to learn from our runner breaking.

The aggregation carries topics alongside the count, because a count is a
scoreboard: "six off-by-one errors" is a label, "six off-by-one errors, four of
them in binary search" is a plan.

---

## One inherited mistake, corrected

The dashboard's streak panel said days were counted "in your own timezone, not
UTC midnight". The server buckets them in UTC, and has to: two devices in two
time zones must not disagree about whether yesterday counted. The text was
wrong, not the implementation.

---

## Gate — the finish line

| Check | Result |
|---|---|
| Mastery formula unit tests | 11 / 11, including every degenerate case |
| Progress + reconciliation (e2e, real database) | 9 / 9 |
| Mistakes + analytics (e2e) | 9 / 9 |
| `pnpm --filter @guruji/api test` | 88 passed |
| `typecheck` · `lint` | clean across api, web, packages |
| `pnpm --filter @guruji/web build` | clean, 9 routes |

---

## What comes next

**Phase 6 — Revision engine.** The column it needs is already there and
deliberately empty: `revisionAttempts` / `revisionSuccesses` on both progress
tables. Until something writes them, `retention` reports itself as unmeasured
rather than as a failure — which is the whole reason the redistribution rule
exists.
