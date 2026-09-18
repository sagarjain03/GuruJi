# GuruJi — Mastery Model

> Module: `apps/api/src/mastery`
> Last updated: 2026-09-18

---

## What problem this solves

The obvious model is wrong:

```
mastery = solved / total        ← do not use this
```

It says a user who solved 40 easy array problems on the third attempt each, with
hints, has mastered arrays. It also says a user who solved 8 hard graph problems
cleanly has not mastered graphs. Both conclusions are false, and every
recommendation built on them will be wrong.

Mastery has to answer a harder question:

> If I gave you a *new* problem in this topic tomorrow, could you solve it
> unaided, correctly, in reasonable time?

That is what the formula below estimates.

---

## The formula

Per (user, topic) and separately per (user, pattern), scored 0–100:

```
mastery = 100 × clamp01(
      0.30 × accuracy
    + 0.20 × retention
    + 0.20 × difficultyPerformance
    + 0.15 × patternCoverage
    + 0.15 × speed
    − 0.20 × hintDependency
) × confidence
```

Weights live in one config object, not scattered through the code, so they can
be tuned in one place and the tuning is visible in a diff.

### The components

| Component | Definition | Why it is in here |
|---|---|---|
| `accuracy` | first-attempt solves ÷ problems attempted | First attempt is the honest signal. Counting all attempts rewards brute-force retrying |
| `retention` | revision successes ÷ revision attempts | Solving once is not knowing. This is the only component that measures *durability* |
| `difficultyPerformance` | weighted solve rate, Easy ×1.0 / Medium ×1.6 / Hard ×2.5 | Ten easy solves should not equal four hard ones |
| `patternCoverage` | distinct patterns solved ÷ patterns available in the topic | Solving twenty two-pointer problems is depth in one pattern, not mastery of arrays |
| `speed` | median solve time vs the problem's `estimatedMinutes`, clamped | Recognition speed is a real component of competence — but capped, so it cannot dominate |
| `hintDependency` | hint-assisted solves ÷ total solves, weighted by hint level reached | Being walked to an answer is not solving. Level 4 hints weigh more than level 1 |
| `confidence` | `min(1, attempts / 5)` | The damping term — see below |

### Why `confidence` exists

Without it, one lucky solve on one problem reads as 100% mastery, and the
recommendation engine immediately stops showing you that topic. The damping term
means a score only approaches its true value after roughly five attempts.
Displayed in the UI as a "low data" state rather than a suspiciously confident
bar.

### Why hint dependency subtracts rather than not-counting

We could simply exclude hinted solves from `accuracy`. Subtracting is stronger,
and intentionally so: heavy hint use is *evidence of a gap*, not merely absence
of evidence. A user who solves everything at hint level 4 should see a score
that tells them the truth.

---

## What is deliberately excluded

| Excluded | Reason |
|---|---|
| Streak length | Consistency is a habit, not a skill. Rewarding it here would let a user raise mastery by logging in |
| XP, badges | Gamification must never feed the model — that is how "500 solved, understands nothing" outranks real competence |
| Total problems solved | It is an input to `accuracy` and `patternCoverage` already. Counting volume twice double-rewards volume |
| Contest placement | Single-user contests; placement is noise |
| Exploratory runs (`isRun = true`) | Testing your thinking must never be punished |
| `INTERNAL_ERROR` submissions | Our infrastructure failing is not the user being wrong |

---

## When it is computed

Inside the submission-completion transaction, incrementally. Never on read.

The dashboard renders a mastery bar for every topic on every load. Recomputing
from full submission history at read time is fine at 10 submissions and
unusable at 10,000. `UserTopicProgress` and `UserPatternProgress` hold the
materialised counters; the score is derived from them.

Because it is materialised, it can drift if a write path bypasses the
transaction. Guard: a nightly reconciliation job recomputes from source and logs
any discrepancy. It logs rather than silently corrects — a drift is a bug in a
write path, and silently correcting it hides the bug.

---

## Topic vs pattern, separately

Both are maintained because they answer different questions:

- Low **topic** mastery, healthy pattern mastery → the data structure is the
  gap. Show foundational problems in that topic.
- Healthy topic mastery, low **pattern** mastery → the technique is the gap.
  Show that pattern across topics the user is already comfortable with.

Collapsing these into one score loses exactly the distinction that makes the
recommendation useful.

---

## Presentation

Bands, because a number to one decimal place implies precision the model does
not have:

| Score | Band | Meaning shown to the user |
|---|---|---|
| 0–19 | Not started | |
| 20–39 | Learning | |
| 40–59 | Developing | |
| 60–79 | Proficient | |
| 80–94 | Strong | |
| 95–100 | Mastered | Requires retention evidence, not just solves |

The UI can always show the breakdown. "Why is my Graphs score 40?" must have an
answer — accuracy 55%, retention 30%, hint dependency high — not a shrug. An
opaque score the user cannot interrogate is indistinguishable from a made-up
one, and it will be treated as such.

---

## Tests

The formula is pure and deterministic, so it is directly unit-testable. Cases
that must be covered:

- Zero attempts → 0, with the "no data" flag set
- One perfect solve → low score (confidence damping), not 100
- All failures → 0, and no division-by-zero anywhere
- Hint-heavy solves → materially lower than unaided solves of the same problems
- Hard solves outscore an equal count of easy solves
- One pattern solved repeatedly → capped by `patternCoverage`
- Strong solves, failed revisions → score falls (retention working)
- Every component at maximum → exactly 100
- Weight config sums to the documented total (a guard against a bad edit)
