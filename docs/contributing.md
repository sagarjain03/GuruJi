# GuruJi — Contributing

> Last updated: 2026-09-18

---

## Getting started

**Prerequisites:** Node ≥ 22, pnpm ≥ 10, Docker Desktop **running**.

```bash
pnpm install
cp .env.example .env          # then fill in the values
pnpm infra:up                 # Postgres + Redis
pnpm db:migrate
pnpm db:seed
pnpm dev                      # web on :3000, api on :4000
```

Docker is a hard dependency, not an optional convenience — Postgres, Redis and
the code sandbox all run in it.

`GROQ_API_KEY` is only needed for AI features. Everything else works without it;
AI endpoints return a clear "not configured" error rather than pretending.

### Common commands

| Command | Does |
|---|---|
| `pnpm dev` | Both apps in watch mode |
| `pnpm typecheck` | Type-check every package |
| `pnpm lint` | Lint every package |
| `pnpm test` | Unit tests |
| `pnpm build` | Full build — the real check before a commit |
| `pnpm db:studio` | Prisma Studio |
| `pnpm infra:down` | Stop containers |

---

## Before you commit

Run `pnpm build`. Not `pnpm dev` — a dev server tolerates things a build does
not, and the failures it hides are the boring ones that cost the most time:
unused imports and variables left behind by a refactor (`TS6133`), type errors
in a file you did not open, a missing export.

The rule with teeth: **when you delete JSX, delete everything it left orphaned**
— the import, the `useState`, the handler, the types only that code used. A
build catches this in seconds; a reviewer catches it slowly and with irritation.

Checklist:

- [ ] `pnpm build` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] No secrets, no hard-coded credentials
- [ ] New endpoints validate input and check ownership
- [ ] Loading, empty and error states exist for new UI
- [ ] Docs updated if behaviour or architecture changed

---

## Tests come first

Red → green → refactor, and it is not negotiable for the three engines.

Mastery, revision and recommendations are pure deterministic functions whose
output is invisible in the UI until it is subtly wrong. A mastery formula that
is 10% off looks completely normal on screen and quietly ruins every
recommendation downstream. The unit test is the only thing that will ever tell
you.

| Layer | Tool | What is actually tested |
|---|---|---|
| Engines | Vitest | The formulas, including degenerate inputs |
| API | Jest + Supertest | Auth, ownership, validation, transactions |
| Sandbox | Vitest | The adversarial suite in [code-execution.md](./code-execution.md) |
| Web | Vitest + Testing Library | Component behaviour, not implementation detail |
| Journeys | Playwright | Register → login → solve → submit → recommendation |

We do not chase a coverage percentage. We cover the paths where being wrong is
expensive: money, security, and the learning model.

---

## Code style

**TypeScript is strict.** `any` needs a comment explaining why no other type
works. `!` non-null assertions need the same. Both are almost always a signal
that a type is wrong somewhere upstream.

**Names say what the thing is.** `userMastery`, `recommendedProblems`,
`revisionItems`, `submissionResult` — not `data`, `temp`, `result`, `x`.

**Files stay small.** A React component past ~200 lines or a NestJS service past
~300 usually has two responsibilities in it. Split on the seam rather than
scrolling past it.

**Errors are handled, never swallowed.** An empty `catch {}` is rejected at
review. Catching to reset state to a safe default is fine — and required for
API calls — but the error is logged.

```ts
// correct — safe default, and the failure is visible
try {
  const response = await topicsApi.list()
  setTopics(response?.topics ?? [])
} catch (error) {
  logger.error({ error }, 'failed to load topics')
  setTopics([])
}
```

API responses are accessed with `?.` and `??`. A shape that "can't" be undefined
will be undefined the first time the network is slow.

---

## Architectural rules

These are the ones where a violation is not a style disagreement:

1. **User code never runs in the API process.** Sandbox only.
2. **No secret is `NEXT_PUBLIC_*`.**
3. **`userId` comes from the token, never from the request.**
4. **All timestamps are UTC `TIMESTAMPTZ`.** Convert in the browser only.
5. **The roadmap and problem content live in the database**, not in components.
6. **Nothing outside `packages/ai` imports the Groq SDK.**
7. **Submission completion is one transaction** — results, mastery, revision.
8. **Gamification never feeds mastery.**

If a change requires breaking one of these, the discussion happens before the
code, and [architecture.md](./architecture.md) is updated in the same PR.

---

## Commits

```
type(scope): what changed

- why, or the detail that is not obvious from the diff
```

Types: `feat` · `fix` · `test` · `refactor` · `chore` · `docs`

One commit per logical change, with tests passing at that commit. A commit that
does not build is a commit nobody can bisect through.

---

## Branches

- `main` — protected
- `develop` — integration
- `feature/<slug>` · `fix/<slug>`

---

## Documentation

`docs/` is not a courtesy — it is where the *why* lives. Code shows what the
mastery formula is; only the doc explains why hint dependency subtracts instead
of being excluded, and that is the thing a future reader needs.

Update the relevant doc in the same PR when you change: the mastery formula,
revision scheduling, recommendation weights, the database schema, sandbox
limits, or AI prompt structure.

When documenting something non-obvious, answer four questions: **What? Why? How?
What did we trade away?** The fourth is the one usually missing, and the one
that stops a future reader from "fixing" a deliberate decision.
