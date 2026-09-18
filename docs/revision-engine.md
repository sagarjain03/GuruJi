# GuruJi — Revision Engine

> Module: `apps/api/src/revision`
> Last updated: 2026-09-18

---

## Why spaced repetition for DSA

Solving a problem once and moving on produces the familiar failure: you solved
Trapping Rain Water in March, you see it in an interview in June, and you have
nothing. The forgetting curve is steep and reliable, and it is defeated by
reviewing *just before* you would have forgotten.

Standard spaced repetition was built for flashcards. Problem solving differs in
two ways that matter, and the algorithm is adapted for both:

1. **The unit is an approach, not a fact.** You do not recall a solution, you
   reconstruct it. So the outcome is graded on *how* it was reconstructed —
   struggle is a signal even when the answer was eventually correct.
2. **Re-solving is expensive.** A flashcard costs seconds; a re-solve costs 20
   minutes. So the queue is bounded, intervals are longer than a flashcard
   system's, and a "review" can be a lighter recall exercise rather than a full
   re-solve.

---

## The schedule

Base ladder, in days:

```
0 → 1 → 3 → 7 → 14 → 30 → 60 → 120
```

Intervals are modulated by an **ease factor** (default 2.5, range 1.3–3.0) that
tracks how easy this specific problem is for this specific user. A problem you
find trivial drifts out to long intervals; one you keep fumbling stays close.

### Outcomes and their effect

When a revision is completed the user reports an outcome — inferred from the
submission where possible, confirmed by the user where not:

| Outcome | Ease | Next interval |
|---|---|---|
| `SOLVED_EASILY` | +0.15 | `interval × ease`, advance the ladder |
| `SOLVED_WITH_EFFORT` | unchanged | `interval × ease`, advance the ladder |
| `STRUGGLED` | −0.15 | `interval × 0.5`, do not advance; minimum 1 day |
| `FAILED` | −0.20 | reset to 1 day, `lapses += 1`, state → `LAPSED` |

Ease is clamped to `[1.3, 3.0]`. Without the floor, a repeatedly-failed problem
collapses to a permanent daily item — which is how users abandon a revision
system entirely.

### States

```
LEARNING  → first successful solve, intervals under 7 days
REVIEWING → interval ≥ 7 days, ladder advancing normally
MASTERED  → interval ≥ 60 days and 3+ consecutive non-struggling successes
LAPSED    → failed after previously reaching REVIEWING
```

`MASTERED` requires *consecutive* successes at long intervals. A single lucky
recall does not retire a problem from the queue.

A `LAPSED` item is prioritised above a fresh one in the recommendation engine:
knowledge you had and lost is cheaper to recover than knowledge you never had,
so it is the highest-return practice available.

---

## The daily queue

Ordering, when more items are due than the user can reasonably do:

1. `LAPSED` items — highest return
2. Most overdue (by `dueAt`)
3. Weakest topic (lowest mastery)
4. Hardest difficulty

### The queue is capped

Default 10 items per day, configurable per user.

This cap is the single most important design decision here. Miss a week and an
uncapped queue shows 40 due problems, which is roughly 13 hours of work. The
predictable outcome is that the user does none of them and stops opening the
app. A bounded queue that carries the overflow forward keeps the system usable
after a lapse — and lapses are normal, not exceptional.

Overflow is not dropped; it is re-sorted into tomorrow's queue.

### Backlog recovery

After an absence longer than 14 days, the engine does not simply dump the
backlog. It re-spaces: items are redistributed across the following days by
priority, with the cap respected. The user sees "24 problems to catch up on,
10 today" rather than a wall.

---

## What triggers scheduling

- **First accepted submission** on a problem → a `RevisionItem` is created, due
  in 1 day.
- **Revision completion** → interval and ease recomputed as above.
- **A failed non-revision attempt** on an already-scheduled problem → treated as
  `STRUGGLED`; the interval shortens. The user has demonstrated the gap, and
  waiting for the scheduled date to act on that is wasteful.

Scheduling runs inside the submission transaction. Mastery moving without
revision being scheduled is a silent corruption of the learning model, so the
two commit together or not at all.

---

## Dates are UTC; days are local

Intervals are computed in UTC and `dueAt` is a `TIMESTAMPTZ`. But "due today"
is a *local-day* question, so the query resolves the user's day boundary from
`Profile.timezone` (an IANA name) and compares against that.

Using UTC midnight for everyone means a user in `Asia/Kolkata` sees their queue
roll over at 5:30 AM. Using a fixed offset instead of an IANA name means it
breaks twice a year in DST regions. Neither is acceptable, and both are the kind
of bug that is reported as "the app is weird in the morning" and takes a week to
diagnose.

---

## Retention feeds mastery

Revision outcomes are the `retention` component of the mastery formula — 20% of
the score, and the only component that measures durability rather than a single
success. This is the feedback loop that makes the whole system more than a
problem list: failing revisions lowers topic mastery, which raises that topic's
priority in recommendations, which brings back foundational practice.

---

## Tests

Deterministic and pure, so every path is directly assertable:

- First solve schedules at day 1
- Success advances the ladder and multiplies by ease
- `STRUGGLED` halves without advancing, and never goes below 1 day
- `FAILED` resets to 1 day, increments `lapses`, sets `LAPSED`
- Ease is clamped at both ends after repeated extremes
- `MASTERED` requires consecutive successes, not one
- A day-cap overflow carries forward and is not dropped
- A 30-day absence re-spaces rather than dumping
- Due-today respects the user's timezone, including across a DST transition
- Scheduling and mastery commit atomically — a forced failure in one rolls back
  the other
