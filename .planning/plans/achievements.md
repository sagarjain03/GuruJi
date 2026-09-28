# Plan: Achievements — badges and streak

**Spec**: .planning/specs/achievements.md
**Epic**: none (roadmap Phase 12)
**Created**: 2026-09-28
**Status**: draft

Full-stack. Same shape as contests: a Nest module whose decisions live in pure
files with their own specs; the service only gathers rows and persists unlocks.
Direction of dependency: `achievements` may read what other modules produce
(and the pure streak function); nothing in mastery, progress, revision or
recommendations imports `achievements` — enforced by a test.

## Components

| Component | Type | Purpose |
|---|---|---|
| `catalog` | Pure | the 12 badges: slug, name, description, icon key, tier thresholds |
| `tiers` | Pure | value → highest tier, next threshold; unlock-moment selection (highest new per badge) |
| `metrics` | Pure | each badge's value from plain rows |
| `AchievementsService` | Service | gathers rows, computes, records new tiers (skip duplicates), returns the case |
| `AchievementsController` | Controller | `GET /achievements`, `POST /achievements/seen` |
| `achievementApi` | Client | typed calls |
| `Medallion` | Component | SVG medallion per tier, locked state, shine sweep |
| `TrophyCase` | Component | profile grid + detail dialog |
| `UnlockMoment` | Component | one-time animated unlock, queued, announced |
| `NextUp` | Component | dashboard strip of the three nearest tiers |
| `StreakPanel` | Component (existing) | flame + last-seven-days redesign |

## Tasks

### Phase 1 — Database and types
| # | Task | Files |
|---|---|---|
| 1 | `AchievementTier` enum, `UserAchievement` model + back-relation; migration | `schema.prisma`, migration |
| 2 | Zod schemas for the trophy case and `seen` request; `.strict()` request | `packages/types/src/achievement.ts`, `index.ts` |

### Phase 2 — Pure logic, TDD
| # | Task | Files |
|---|---|---|
| 3 | Move `streakFrom` into `analytics-math.ts` (exported, unchanged) | `analytics-math.ts`, `analytics.service.ts` |
| 4 | Catalog + tier resolution + unlock-moment selection | `achievements/catalog.ts`, `tiers.ts`, `tiers.spec.ts` |
| 5 | Metric computations from rows | `achievements/metrics.ts`, `metrics.spec.ts` |

### Phase 3 — API
| # | Task | Files |
|---|---|---|
| 6 | Service: gather rows, compute, `createMany({ skipDuplicates })`, build response with `new` | `achievements.service.ts` |
| 7 | Controller, module, AppModule registration | `achievements.controller.ts`, `achievements.module.ts`, `app.module.ts` |
| 8 | API e2e: fresh user, seeded history, new-once, seen, concurrency, isolation | `test/achievements.e2e-spec.ts` |
| 9 | Architecture test: no engine imports achievements | `achievements/boundary.spec.ts` |

### Phase 4 — Web
| # | Task | Files |
|---|---|---|
| 10 | Client | `lib/api.ts` |
| 11 | Medallion design (frontend-design skill), tier metals as tokens | `components/achievements/medallion.tsx`, `styles/app.css` |
| 12 | Trophy case on profile | `trophy-case.tsx`, `profile-view.tsx` |
| 13 | Unlock moment (dashboard load + after a verdict) | `unlock-moment.tsx`, `dashboard-view.tsx`, `use-submission.ts` |
| 14 | Next-up strip + streak redesign | `next-up.tsx`, `dashboard-view.tsx` |
| 15 | Playwright: trophy case, unlock once, reduced motion, streak | `e2e/achievements.spec.ts` |

### Phase 5 — Close-out
| # | Task | Files |
|---|---|---|
| 16 | Docs (as built), build, TODO tick after verification | `docs/database.md`, `docs/api.md`, `TODO.md` |

| Parallel | Tasks | Why |
|---|---|---|
| A | 4, 5 | independent pure files |
| B | 12, 14 | independent components |

| Sequential | Depends on |
|---|---|
| 6 | 1–5 |
| 7–9 | 6 |
| 10–15 | 7 |
| 16 | 15 |

## Testing plan

| Layer | Tests | Spec trace |
|---|---|---|
| Logic | tiers: value→tier, next, <4 tiers, highest-new-per-badge | Req 1, 5; edge 1, 4 |
| Logic | metrics: each of the 12 from rows, incl. first-try, comeback, unaided rules | Req 2 |
| API | fresh → locked; seeded → tiers; new once; seen; concurrent once; isolation | Req 3–5; edge 2, 3 |
| Architecture | engines never import achievements | Req 9 |
| UI | trophy case, unlock once, reduced motion, streak | Req 5–8, 10; edge 5 |
