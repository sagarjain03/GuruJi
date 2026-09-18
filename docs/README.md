# GuruJi — Documentation

> Phase 0. Design is written down; implementation has not started.
> Last updated: 2026-09-18

GuruJi is a personal DSA training system. The thing it is trying to be:

> "This app knows what I am weak at and tells me exactly what I should practise next."

Not: "another website with DSA questions on it."

Everything here serves one loop.

```
Discover problem → Understand → Think → Code → Run → Submit → Result
      ↑                                                          ↓
Next recommendation ← Schedule revision ← Update mastery ← Analyse mistake
```

---

## Read in this order

**New to the project — start here:**

1. [architecture.md](./architecture.md) — how it fits together and why
2. [roadmap.md](./roadmap.md) — what is built when, and in what order
3. [contributing.md](./contributing.md) — local setup and the rules that have teeth

**The intelligence layer** — this is the product, not a feature:

4. [mastery-model.md](./mastery-model.md) — how competence is measured
5. [revision-engine.md](./revision-engine.md) — how retention is scheduled
6. [recommendation-engine.md](./recommendation-engine.md) — how the next activity is chosen

**The risky parts:**

7. [code-execution.md](./code-execution.md) — the sandbox. Highest-risk component in the system
8. [security.md](./security.md) — everything else security
9. [ai.md](./ai.md) — the mentor, and why it withholds answers

**Reference:**

10. [database.md](./database.md) — schema and why it is shaped that way
11. [api.md](./api.md) — endpoints and conventions
12. [visualizer.md](./visualizer.md) — the algorithm event model

---

## Decisions you can skip the rest of the docs for

The eight that everything else follows from:

| Decision | Where it is argued |
|---|---|
| Mastery is never `solved / total` | [mastery-model.md](./mastery-model.md) |
| The three engines are deterministic, not AI | [architecture.md](./architecture.md) §6 |
| User code never runs in the API process | [code-execution.md](./code-execution.md) |
| The AI gives progressive hints, never the answer first | [ai.md](./ai.md) |
| All timestamps are UTC; only the browser converts | [database.md](./database.md) |
| `camelCase` on the wire, because web and api share types | [api.md](./api.md) |
| The roadmap lives in the database, not in components | [database.md](./database.md) |
| Gamification never feeds mastery | [architecture.md](./architecture.md) §11 |

---

## Stack

| Layer | Choice |
|---|---|
| Web | Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, shadcn/ui, Monaco, Framer Motion, Recharts |
| Client state | TanStack Query (server data) · Zustand (UI only) |
| API | NestJS 12, REST + WebSocket |
| Data | PostgreSQL 17, Prisma 7 (stable — not the 8.x RC) |
| Queue / cache | Redis 7, BullMQ |
| AI | Groq, behind an `LLMProvider` seam |
| Execution | Isolated Docker sandbox, one container per submission |
| Tests | Vitest · Jest · Playwright |

Trade-offs for each are in [architecture.md](./architecture.md) §10.

---

## Status

| Phase | State |
|---|---|
| 0 — Analysis and design | In progress (this documentation set) |
| 1 — Foundation | Not started |
| 2–8 — MVP | Not started |
| 9–12 — Beyond MVP | Not started |

The MVP ends at Phase 8. Phases 9–12 are explicitly out of the first release.

Task-level tracking is in [`../TODO.md`](../TODO.md).

---

## Keeping these honest

If code and a document disagree, that is a bug in one of them — not something to
route around. Change the doc in the same PR as the behaviour.

These files carry the *why*. Code will always show what the mastery weights are;
only [mastery-model.md](./mastery-model.md) explains why hint dependency
subtracts rather than simply being excluded — and that is the part a future
reader needs before they "simplify" it.
