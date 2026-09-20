# GuruJi — working rules

Project-level rules. These sit on top of the global `~/.claude/CLAUDE.md`, and
where the two disagree, this file wins for work inside this repository.

---

## 1. Long-running work gets cut up, not waited on

**A command that has not finished in ~3 minutes is a command that was asked the
wrong question.** Stop it and split it.

### The rule

| Situation | What to do |
|---|---|
| A command is still running after ~3 min with no useful partial output | `TaskStop` it. Do not keep waiting. |
| The work genuinely takes longer (container suites, 100-job drains, full builds) | Split it into named pieces and run them one at a time |
| A piece still overruns after splitting | Shrink the input (fewer jobs, one test file, one package) until it fits, then report the reduced scope explicitly |

### How to split

Run the smallest thing that can fail first, then widen:

```
one test file        →  pnpm --filter <pkg> test <path/to/one.spec.ts>
one package          →  pnpm --filter <pkg> test
everything           →  pnpm test
```

The same shape applies to typecheck, lint and build. **Never** open with
`pnpm test` at the repository root when a single file would answer the question.

### Rules for background work

- Long commands run with `run_in_background: true`, never in the foreground.
- **Write to a log file, then grep the file.** `cmd > /tmp/x.log 2>&1` and read
  `/tmp/x.log` afterwards. Piping straight into `grep` buffers, so the output
  file stays empty for the whole run and there is no way to see progress.
- While a background job runs, do work that needs no CPU — docs, checklists,
  reading. Do not start a second heavy job. This host has 4 cores and 3.9 GB.
- Never start two things that share Redis, Postgres or Docker at the same time.
  The API end-to-end suite and the runner's concurrency test use the same BullMQ
  queue and will corrupt each other.

### When something has to be abandoned

Say so plainly, with the number: *"the 100-job drain did not finish in 10
minutes on this host; it is not ticked."* A skipped check reported as passing is
worse than a failing one.

---

## 2. Talk like a caveman

The `/caveman` skill is **on for this project, in every reply**, not only when it
is invoked.

- Short sentences. Small words. No hedging, no filler.
- Match the language the user wrote in — Hindi/Hinglish in, Hindi/Hinglish out.
- **Facts stay exact.** File paths, command names, function names, numbers and
  verdicts are never caveman-ified. `TIME_LIMIT_EXCEEDED` stays
  `TIME_LIMIT_EXCEEDED`.
- Code and code comments stay normal prose. Only the chat goes caveman.
- **Drop it for serious calls** — anything touching security, data loss, money
  or a destructive command. Say "ye part serious hai, normal baat karta hoon"
  and talk plainly.

---

## 3. Verify in a real browser

The `/browser-qa` skill and Playwright are part of finishing work, not an extra.
Phase 3 pulled Playwright forward from Phase 12 for exactly this reason, and it
immediately found two bugs nothing else could.

- Any change to `.tsx` or `.ts` under `apps/web` gets checked in a real browser
  before it is called done.
- `apps/web/e2e/` holds the specs. Run them per file, not all at once:
  `pnpm --filter @guruji/web test:e2e e2e/<one>.spec.ts`.
- A Playwright run is long-running work. Rule 1 applies to it in full.
- The browser MCP server is flaky here and often fails to connect. That is a
  connection failure, **not** a missing capability — say so and use the CLI
  instead, rather than reporting that browser testing is unavailable.

---

## 4. Before calling anything done

In order, smallest first:

```
pnpm --filter <pkg> typecheck
pnpm --filter <pkg> lint
pnpm --filter <pkg> test
pnpm --filter @guruji/web build     # any .tsx/.ts change under apps/web
```

`build` is not optional for frontend changes — it is what catches unused imports
and leftover state after a refactor.

Never claim a check passed without having seen its output in this session.

---

## 5. Docker is a hard dependency

Postgres, Redis and every sandbox live in Docker.

- If the daemon is down, say so and start Docker Desktop rather than reporting
  the work as blocked.
- **Heavy container work can kill Docker Desktop on this host.** It happened
  during the 100-job drain. If the daemon disappears mid-run, that is a finding
  worth recording, not just an inconvenience to retry past.
- Paths on Windows: Git Bash rewrites `/sandbox` into a Windows path inside
  `docker run`. Use `MSYS_NO_PATHCONV=1` and a real Windows host path when
  driving docker by hand.

---

## Project shape

```
apps/api           NestJS · REST + one WebSocket namespace · the only DB writer
apps/code-runner   BullMQ worker · Docker sandbox · no credentials, no ingress
apps/web           Next.js App Router · Monaco editor
packages/types     Zod schemas shared by all three — one definition, never two
packages/database  Prisma schema, client, migrations, seed
docs/              The design. `TODO.md` is what gets ticked off.
```

Phase order and reasoning live in `docs/roadmap.md`; per-phase write-ups in
`docs/phases/`. Do not edit `TODO.md` checkboxes for work that has not been
verified.
