# Spec: Achievements — badges and streak (Phase 12, light gamification)

**Created**: 2026-09-28
**Status**: draft
**Author**: Sagar Jain
**Epic**: none (roadmap Phase 12)

---

## Problem

Progress in GuruJi is honest but quiet: mastery bars and numbers move, and
nothing marks a moment worth marking — the first hard problem, a week of
practice, a revision that came back easily. Learners who never feel a win drift
off. The obvious fix, points for volume, is exactly what the architecture
forbids: it would let someone who grinds 500 problems out-rank someone who
understands 200 (architecture §11, mastery-model "Excluded").

## Goal

Badges that feel premium to earn and that reward **how** someone learns, not
how much: first-try solves, recall, breadth of patterns, persistence, unaided
work. Each unlock is a moment (an animated medallion), each badge shows how far
the next tier is, and none of it ever touches mastery or recommendations.

Measured by: every badge's progress is computed from data GuruJi already
records; an unlock is shown once, the moment it happens; mastery and
recommendation code import nothing from achievements.

## User stories

- As a learner, I want a trophy case on my profile showing what I have earned
  and how close the next tier is, so that I have something to aim at beyond the
  next problem.
- As a learner, I want a moment when I earn something — an animated medallion,
  once — so that a real milestone does not pass unnoticed.
- As a learner, I want my streak to look like something I would protect, so that
  a daily habit is easier to keep.
- As the person who designed the mastery model, I want badges kept strictly out
  of it, so that the score stays a measure of understanding.

---

## Requirements

### Must have

1. **Catalog in code, not the database.** Twelve badges, each with four tiers
   (Bronze, Silver, Gold, Platinum), each tier a threshold on one metric. The
   criteria are code — typed, reviewed, tested — rather than JSON in a table.
2. **Metrics from existing data only** (no new signals):

   | Badge | Metric | Bronze / Silver / Gold / Platinum |
   |---|---|---|
   | Sharp First Try | problems solved on the first graded submission | 1 / 5 / 15 / 40 |
   | Memory Keeper | revisions completed as "easily" or "with effort" | 1 / 5 / 20 / 50 |
   | Pattern Hunter | distinct patterns with a solve | 2 / 4 / 8 / 15 |
   | Explorer | distinct topics with a solve | 2 / 4 / 8 / 12 |
   | On Fire | longest daily streak | 3 / 7 / 14 / 30 |
   | Hard Mode | HARD problems solved | 1 / 2 / 5 / 10 |
   | Unaided | problems solved with no hint taken | 3 / 10 / 25 / 60 |
   | Comeback | problems solved after 2+ wrong attempts | 1 / 5 / 15 / 30 |
   | Honest Journal | mistakes logged with the correct idea written | 1 / 5 / 15 / 30 |
   | Under Pressure | mock contests finished | 1 / 3 / 10 / 25 |
   | Clean Sweep | mock contests with all three solved | 1 / 3 / 5 / 10 |
   | Polyglot | languages with an accepted solution | 2 / 3 / 4 / 4* |

   *Polyglot has three reachable tiers (four languages exist); Platinum is not
   offered. The catalog allows a badge to define fewer than four tiers.

3. **Unlock records.** `UserAchievement (userId, badge, tier, unlockedAt,
   seenAt)`, unique on `(userId, badge, tier)`. A tier is recorded the first time
   its threshold is observed, and never removed — earning is permanent even if
   a metric later drops (it cannot, for these metrics, but the rule is stated).
4. **Evaluation on read.** `GET /achievements` computes every metric, records any
   newly crossed tier, and returns the trophy case: each badge with its current
   tier, value, next threshold and unlock dates. No background job.
5. **Unlock moment.** `GET /achievements` marks tiers not yet seen as `new`;
   `POST /achievements/seen` acknowledges them. The web shows each new unlock
   once as an animated medallion (shine sweep, tier colour), queued if several.
   Checked when the dashboard loads and after a submission's verdict arrives.
6. **Trophy case** on `/profile`: the twelve medallions in a grid, earned ones in
   their tier's metal, locked ones as a dark embossed outline with progress to
   the next tier ("3 / 5 to Silver"). Each opens a detail with its meaning and
   every tier's date.
7. **Dashboard strip**: the three badges closest to their next tier, with
   progress — "what is next" rather than "what you have".
8. **Streak, redesigned**: the existing streak panel becomes a flame whose
   intensity follows the current streak, the last seven days as dots, and the
   longest streak beside it. Same numbers as today; only the presentation changes.
9. **Never feeds mastery.** Achievements live in their own module; mastery,
   progress and recommendations do not import it. A test asserts this.
10. **Accessibility.** Tier is conveyed by text as well as metal colour;
    medallions have accessible names ("Sharp First Try, Gold"); the unlock
    animation respects `prefers-reduced-motion` and is announced politely.

### Nice to have

- A share-as-image of a medallion.
- Badge-specific icons drawn per badge rather than from the icon set.
- Daily goal ring (needs time tracking; deferred by the chosen scope).

### Out of scope

- XP, levels, points, leaderboards, or any comparison with other users.
- Badges that count raw volume ("solve 100 problems").
- Any effect on mastery, recommendations, revision or contests.
- Email or push notifications for unlocks.
- Daily goal tracking.

---

## Data model

```
enum AchievementTier { BRONZE SILVER GOLD PLATINUM }

UserAchievement
  id          uuid pk
  userId      uuid → users (cascade)
  badge       text            catalog slug, e.g. "sharp-first-try"
  tier        AchievementTier
  unlockedAt  timestamptz
  seenAt      timestamptz?    null until the unlock has been shown
  createdAt   timestamptz
  @@unique([userId, badge, tier])
  @@index([userId, seenAt])
```

Deviation from docs/database.md, which planned an `Achievement` table with
criteria as JSON: the criteria are code (typed and tested), so only the unlocks
are data. `DailyGoal` is out of scope. **Soft delete: none** — unlocks are
history owned by the user and cascade with the account.

## API changes

JSON is camelCase like every current endpoint; errors use the standard envelope.

| Method | Route | Success |
|---|---|---|
| GET | `/achievements` | 200 trophy case (evaluates and records unlocks) |
| POST | `/achievements/seen` | 204 — `{ unlocks: [{ badge, tier }] }` marked seen |

```jsonc
// GET /achievements
{
  "badges": [
    {
      "slug": "sharp-first-try",
      "name": "Sharp First Try",
      "description": "Solved on the first graded submission.",
      "value": 7,
      "tier": "SILVER",              // highest earned, or null
      "next": { "tier": "GOLD", "threshold": 15 },   // null at the top
      "tiers": [
        { "tier": "BRONZE", "threshold": 1, "unlockedAt": "2026-09-12T13:30:00Z" },
        { "tier": "SILVER", "threshold": 5, "unlockedAt": "2026-09-26T13:30:00Z" },
        { "tier": "GOLD", "threshold": 15, "unlockedAt": null },
        { "tier": "PLATINUM", "threshold": 40, "unlockedAt": null }
      ]
    }
  ],
  "new": [{ "badge": "sharp-first-try", "tier": "SILVER" }]
}
```

## UI changes

- `components/achievements/medallion.tsx` — the medallion: SVG with a metal
  gradient per tier, embossed rim, icon, tier label; locked state; the unlock
  shine sweep (CSS, reduced-motion aware).
- `components/achievements/trophy-case.tsx` — grid on `/profile`, detail dialog.
- `components/achievements/unlock-toast.tsx` — the one-time unlock moment,
  queued, announced to screen readers.
- `components/achievements/next-up.tsx` — dashboard strip.
- Streak panel redesign in `dashboard-view.tsx`.

## Edge cases

1. **Several tiers crossed at once** (an existing user's first visit) — all are
   recorded; the unlock moment shows the highest per badge and marks the rest
   seen, rather than eleven popups in a row.
2. **Two tabs evaluate at once** — the unique index makes the second insert a
   no-op; the unlock is shown once.
3. **Brand-new user** — every badge locked with progress 0 / threshold; no error.
4. **Badge with fewer than four tiers** (Polyglot) — shown with three; `next` is
   null after Gold.
5. **Reduced motion** — no shine sweep or scale; the unlock still appears and is
   announced.
6. **Evaluation fails** (database error) — the trophy case shows the standard
   error state; the dashboard strip hides itself rather than blocking the page.
7. **Demo/backdated data** — unlock time is when first observed, not when the
   metric was crossed; stated in the UI copy ("earned").

## Testing criteria

- **Unit (TDD):** each metric's computation from rows; tier resolution
  (value → highest tier, next threshold); fewer-than-four tiers; "highest new
  per badge" selection for the unlock moment.
- **API e2e:** fresh user → all locked; seeded history → correct tiers and
  values; unlocks recorded once and returned as `new` once; `seen` clears them;
  concurrent evaluation records each tier once; another user's unlocks never
  visible.
- **Architecture test:** no file under `mastery/`, `recommendations/`,
  `revision/` imports from `achievements/`.
- **Browser (Playwright):** trophy case renders twelve medallions with names and
  tiers; a new unlock shows once and not after reload; reduced motion shows no
  animation; streak panel renders its seven days.

## Dependencies

- Existing data: submissions (verdict, hints, language, time), revision
  reviews, mistakes, contests, topic/pattern links, the streak computation in
  `analytics.service.ts`.
- New Prisma migration (1 enum, 1 table).
- `packages/types`: achievement schemas.
- `frontend-design` skill for the medallion's visual design.
