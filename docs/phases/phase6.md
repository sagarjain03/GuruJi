# Phase 6 — Revision engine

> **Status:** done · 2026-09-21
> **One sentence:** solved problems come back just before you would have
> forgotten them, and never more than a day's worth at a time.

---

## What you can actually do now

```
┌──────────────────────────────────────────────────────────────┐
│  1. Solve something      → it joins the queue, due tomorrow  │
│  2. Open Revision        → today's list, already ordered      │
│  3. Solve it again       → report how it went, in four words  │
│  4. Struggle             → it comes back sooner, not later    │
│  5. Come back after a week → "24 to catch up on, 10 today"    │
└──────────────────────────────────────────────────────────────┘
```

---

## The ladder, and how the document was read

`docs/revision-engine.md` gives both a fixed ladder — `1 → 3 → 7 → 14 → 30 → 60
→ 120` — and an ease multiplier. Those only agree if the ladder **is** the
default-ease case, so that is the reading implemented: a success advances the
ladder, and the resulting interval is scaled by `ease / 2.5`.

At the default ease the sequence is exactly the documented one, which is
asserted directly. A problem someone finds trivial drifts past it; one they keep
fumbling stays short.

### A failure is not always a lapse

`LAPSED` is set only when the item had already reached `REVIEWING`. Failing
something still in `LEARNING` is not losing knowledge, it is still acquiring it
— and `LAPSED` carries the highest priority the recommendation engine has,
because knowledge you had and lost is the cheapest thing to recover. Spending
that on a problem nobody had learned yet wastes it.

### Climbing back out is slower than the climb up, by construction

Not a rule that was written; a consequence that the tests found. `FAILED` costs
ease, and every interval afterwards is scaled by it — so the same three
successes that first reached `REVIEWING` land short of the seven-day threshold
the second time. The item stays prioritised for an extra round. That is the
right behaviour for "you had this and lost it", and it is now pinned by a test
so nobody tunes it away by accident.

---

## The cap is the feature

Ten items a day, and the overflow carries forward.

Miss a week without one and the queue shows forty problems — about thirteen
hours. The predictable response is to do none of them and stop opening the app.
The cap is what keeps the system usable *after* a lapse, and lapses are normal
rather than exceptional.

Nothing is hidden: the interface says "24 are due, you are shown 10 today, the
rest carry forward". A queue that silently forgets fourteen of them is a lie.

### The off-by-one that quietly disabled it

The due query used `dueAt <= endOfLocalDay`. But `endOfLocalDay` is the *instant
the next day begins*, and re-spacing places carried-over items on exactly that
boundary — so they were handed straight back to today, and the cap stopped
holding without any error anywhere.

`lt`, not `lte`. Found by the re-spacing test, which is the only thing that puts
an item on that precise instant.

### Ordering is the product

When more is due than anyone can do, *which* items get shown decides whether the
time was well spent:

1. `LAPSED` — highest return
2. Most overdue — closest to being gone entirely
3. Weakest topic — where recovery helps most
4. Hardest difficulty — when everything else ties

One subtlety: an untracked topic sorts as *fully mastered*, not as zero. Absence
of a score is not evidence of weakness, and treating it as such would push every
brand-new topic to the top of every queue.

---

## Days are local; instants are UTC

`dueAt` is a `TIMESTAMPTZ` and intervals are computed in UTC. But "due today" is
a local-day question, resolved against the user's IANA timezone at query time.

UTC midnight for everyone means a user in `Asia/Kolkata` watches their queue roll
over at 5:30 in the morning. A fixed offset instead of an IANA name breaks twice
a year in every DST region.

Two things `src/revision/local-day.ts` does deliberately:

- **The offset is measured twice.** On the day the clocks move, the offset at
  midday is not the offset at midnight. Measuring once, at the current instant,
  puts the day boundary an hour out for exactly the users whose region just
  changed.
- **No formatting round-trip.** A DST boundary makes some local times ambiguous
  and others nonexistent, and parsing a wall-clock string back silently picks
  one — usually the wrong one, once a year.

Both directions of a transition are tested, plus the days either side.

---

## Scheduling rides in the submission transaction

Alongside the Phase 5 mastery counters, in the same interactive transaction.

Mastery moving while revision does not is a silent corruption of the learning
model: the score says you know it, and nothing is ever scheduled to check
whether you still do. A forced failure inside that transaction is asserted to
roll **both** back.

Three triggers, and doing nothing is one of them:

| Event | Effect |
|---|---|
| First accepted solve | A schedule is created, due tomorrow |
| Failed ordinary attempt on something already scheduled | Treated as `STRUGGLED` — the gap has just been demonstrated, and waiting three weeks to act on it is the system being pedantic |
| Anything else | Nothing. A wrong answer on a problem never solved is Phase 5's business |

`isRun` and `INTERNAL_ERROR` never reach any of it.

---

## Retention closes the loop

Revision outcomes write `revisionAttempts` and `revisionSuccesses` on both
progress tables — the `retention` component Phase 5 left deliberately
unmeasured. A struggle counts as an attempt but **not** a success: the answer
arrived, the recall did not.

This is what makes the product more than a problem list. Failing revisions
lowers topic mastery, which raises that topic's priority in recommendations,
which brings foundational practice back round.

---

## One type-level trap, worth naming

`DockItem` in the nav typed its `href` as `ComponentProps<typeof Link>['href']`.
Under `typedRoutes` that collapses the generic to `RouteImpl<unknown>`, and no
real route is assignable to it. It compiled for months because only one nav item
was live; adding `/revision` and `/mistakes` made the union wide enough to fail.

The fix is to make the component generic over the route, as `Link` itself is —
so a link to a page that does not exist stays a compile error.

---

## Gate — the finish line

| Check | Result |
|---|---|
| Scheduler unit tests (pure) | 12 / 12 |
| Local-day + DST unit tests | 11 / 11 |
| Revision e2e (real database) | 13 / 13 |
| `typecheck` · `lint` (api, web) | clean |
| `pnpm --filter @guruji/web build` | see below |

---

## What comes next

**Phase 7 — Recommendation engine.** Everything it reads is now in place:
`masteryScore` per topic and per pattern, `LAPSED` items with the highest return
on practice, and a mistake journal that says what keeps going wrong.
