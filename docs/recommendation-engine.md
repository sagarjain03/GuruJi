# GuruJi — Recommendation Engine

> Module: `apps/api/src/recommendations`
> Last updated: 2026-09-18

This is the brain of the product. It is what turns a question bank into a
training system, and it is the single component that decides whether the user
thinks:

> "This app knows what I am weak at."

or

> "This is another website with DSA questions."

---

## What it answers

One question, pressed as one button: **TRAIN NOW**.

The answer is not always "here is a problem". It is an *activity*:

| Activity | Chosen when |
|---|---|
| `REVISION` | Items are due, especially lapsed ones |
| `WEAK_TOPIC` | A topic's mastery is materially below the user's average |
| `NEW_PATTERN` | Prerequisites are met and an unexplored pattern is reachable |
| `NEW_PROBLEM` | Steady progress along the roadmap |
| `MOCK_CHALLENGE` | Broad competence, but untested under time pressure |

---

## Pipeline

Four stages. Keeping them separate is what makes the engine testable — each
stage has a defined input, output and set of tests.

```
1. CANDIDATE GENERATION   cheap, broad, database-driven
2. SCORING                the weighted formula
3. DIVERSITY FILTER       stops the engine collapsing onto one thing
4. RANK + EXPLAIN         top N, each with a human-readable reason
```

### 1. Candidate generation

Pulled from four pools, bounded per pool:

- Revision items due now or overdue
- Unsolved problems in topics below the user's average mastery
- Unsolved problems in patterns with zero or few attempts, where the topic
  prerequisites are satisfied
- The next unstarted roadmap node

Candidates are deliberately over-generated (roughly 50) and cut later. Scoring
a small pool well beats scoring a huge pool badly, but scoring a pool that is
too small produces the same three problems every day.

### 2. Scoring

```
score =
      0.30 × revisionUrgency
    + 0.25 × weaknessSignal
    + 0.15 × difficultyFit
    + 0.10 × patternGap
    + 0.10 × prerequisiteReadiness
    + 0.10 × recencyPenalty        (negative contribution)
```

| Signal | How it is computed |
|---|---|
| `revisionUrgency` | Days overdue, normalised. `LAPSED` items get a fixed boost — knowledge lost is the cheapest to recover |
| `weaknessSignal` | How far this topic's and pattern's mastery sit below the user's own average. Relative, not absolute — see below |
| `difficultyFit` | Distance between the problem's difficulty and the user's `difficultyTolerance`. Peaks just above current level |
| `patternGap` | Higher for patterns with few attempts, provided prerequisites are met |
| `prerequisiteReadiness` | Zero if the topic's prerequisites are unmet — a hard gate, not a soft weight |
| `recencyPenalty` | Recently seen, recently attempted, or recently recommended-and-dismissed |

**Weakness is measured relative to the user, not to an absolute bar.** A strong
user whose weakest topic sits at 70 still has a weakest topic and still deserves
targeted practice. An absolute threshold would tell them everything is fine and
stop training them.

**`difficultyFit` targets just above current ability.** Recommending only what
the user can already do produces no growth; recommending far above produces
frustration and hint-dependence. The target sits at the edge of competence,
which is also where the mastery signal is most informative.

### 3. Diversity filter

Without this stage the engine degenerates. A user weak at DP gets DP, all day,
until they quit.

Rules:

- At most 2 problems from the same topic in the top 5
- No problem seen in the last 3 recommendation batches
- No exact problem re-recommended within 7 days unless it is a due revision
- At least one item outside the single weakest topic, always

That last rule is a morale rule, and it is there on purpose. A training system
that only ever shows you what you are worst at is one you stop opening.

### 4. Rank and explain

Every recommendation carries a `reason` that names the actual signal:

```
"Binary Search — 43% accuracy over 7 attempts, averaging 31 minutes.
 This one targets the same pattern at a slightly easier level."

"Due for revision — you solved this 7 days ago. Recall it before it fades."

"You've solved 8 array problems with two pointers. This introduces
 sliding window, which builds on the same idea."
```

The reason is generated from the scoring breakdown, not written by the LLM. It
must be *true* — it is the user's only window into the engine, and a plausible
but invented explanation would be worse than none.

---

## TRAIN NOW

The single-activity endpoint applies precedence before scoring:

```
1. Lapsed revision items exist            → REVISION
2. More than 3 items due                  → REVISION (clear the queue first)
3. A topic is > 20 points below average   → WEAK_TOPIC
4. Average mastery ≥ 60 and no contest
   in the last 7 days                     → MOCK_CHALLENGE
5. A reachable unexplored pattern         → NEW_PATTERN
6. Otherwise                              → NEW_PROBLEM
```

Revision outranks new material because retention is the scarcer resource.
Solving a new problem while four solved ones are fading is a net loss.

---

## Cold start

A brand-new user has no submissions, so every signal is undefined.

The onboarding assessment fills the gap: a short set across Arrays, Strings,
Hashing, Linked List, Trees, Graphs and DP. Its purpose is **not** to rank the
user — it is to seed initial mastery estimates with wide confidence intervals,
so the first recommendations are not random.

Before the assessment, recommendations follow roadmap order from the user's
stated experience level. The engine is honest about this: early reasons say
"starting at the beginning of the roadmap", not a fabricated weakness claim.

---

## Caching

Results are cached per user for 15 minutes and invalidated immediately on any
submission by that user. Recommendations are moderately expensive and read on
every dashboard load; but a stale recommendation after a submission defeats the
entire premise, so the invalidation is not optional.

The cache key includes `userId`. There is no shared recommendation cache.

---

## Feedback

Dismissals are recorded. A dismissed recommendation feeds `recencyPenalty`, and
repeated dismissals of the same kind are a signal the weights are wrong for that
user.

Stored recommendations also make the engine *evaluable* after the fact: was it
accepted, was it solved, did mastery move? That is how the weights get tuned
with evidence instead of intuition.

---

## Tests

The behaviours that must hold, as named in the product spec:

- A weak topic ranks above a strong one, all else equal
- A recently solved problem ranks below an equivalent unsolved one
- A failed revision is prioritised over new material
- Difficulty adapts upward as mastery rises
- The same problem is not recommended twice in consecutive batches
- Topic diversity holds — no more than 2 of 5 from one topic
- Prerequisites gate hard: an unmet prerequisite scores zero, not merely low
- A cold-start user gets roadmap-ordered recommendations with honest reasons
- Every recommendation has a non-empty reason
- Lapsed revision outranks due revision, which outranks weak-topic practice
