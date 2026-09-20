# Phase 4 — Code runner

> **Status:** done · 2026-09-20
> **One sentence:** Run and Submit now produce real verdicts, from real code
> running in a real container that cannot reach anything.
>
> **This phase does not get its exit criteria waived.** The adversarial suite in
> `apps/code-runner/test` gates it, and every row asserts containment *and* the
> correct verdict — not merely that nothing crashed.

---

## What you can actually do now

```
┌──────────────────────────────────────────────────────────────┐
│  1. Write a solution   → the editor from Phase 3             │
│  2. Press Run          → graded against the sample cases     │
│  3. Press Submit       → graded against every case           │
│  4. Watch              → QUEUED … RUNNING … verdict          │
│  5. Read the result    → per-case pass/fail, runtime, errors │
└──────────────────────────────────────────────────────────────┘
```

Nothing in that list involves a page reload. The verdict arrives on the
WebSocket, into the panel the click already opened.

---

## The shape of it

```
Browser ──POST /submissions──▶ API ──▶ BullMQ (Redis) ──▶ code-runner
                                │                            │
                                │                       Docker sandbox
                                │                       (one per test case)
                                ◀──authenticated callback────┘
                                │
                                └──WebSocket──▶ Browser
```

Four properties hold that diagram together, and each one is a decision rather
than an accident:

**User code never executes in the API process.** Not for "just JavaScript", not
in development, not behind a flag. The API's only contact with a submission is
writing a row and pushing a job.

**The runner holds no credential worth stealing.** No database URL, no Groq key,
no public ingress. It is a queue worker, not a service with an address — the
`CODE_RUNNER_URL` that used to sit in `.env.example` was removed, because
nothing dials the runner. `API_INTERNAL_URL` replaced it: the address the runner
posts results *back* to.

**A job carries no user id.** Code, language, limits and test cases. A
compromised runner learns what ran, never whose it was.

**The API is the only writer.** The runner's verdict arrives through one
shared-secret-authenticated route under `/internal`, and that route writes the
results and the parent row in a single transaction.

---

## What the adversarial suite found

The suite exists to catch things, and it did. None of these were visible from
reading the code.

### The wall clock was charging the user for our container startup

The outer timeout began when we handed the container to Docker. Everything
between that and the program's first instruction — namespace setup, image
entrypoint, interpreter boot — was inside the budget. Idle, that is tens of
milliseconds and invisible. Under a hundred concurrent submissions it was
seconds, and trivial correct programs came back `TIME_LIMIT_EXCEEDED`.

A verdict that depends on how busy the host was is not a verdict. It took two
tries to fix properly.

**The first attempt was a fixed grace**, five seconds on top of the problem's
limit. It was a guess, and under load it was the wrong guess: one trivial
submission in ten still came back `TIME_LIMIT_EXCEEDED`.

**The second attempt polled** `docker inspect` every 200 ms to learn when the
container really started. That is a CLI process per poll per container — four
concurrent runs put twenty process spawns a second on the host, and the test
runner died with `FATAL ERROR: Zone Allocation failed - process out of memory`.

**What actually works** is to stop needing a tight outer clock at all. The two
timeouts catch different programs, and only one of them is in a hurry:

- `--ulimit cpu` stops anything that *burns* its budget, inside the container,
  at the limit, for free;
- so the outer kill is left to catch programs that use no CPU — one sleeping for
  an hour, or a container the daemon has wedged. Those cost nothing while they
  wait, so waiting longer to be sure costs nothing either. It sits at the
  problem's limit plus `SANDBOX_STARTUP_CEILING_MS` (30 s) and never decides a
  verdict on its own.

The *reported* runtime, and the check for an overrun, both come from the
daemon's own `StartedAt`/`FinishedAt` rather than from a stopwatch around the
CLI — the container's own life, with none of our startup overhead in it.

### The inner timeout had never actually been built

`docs/code-execution.md` has required a timeout enforced twice since Phase 0 —
inside the container and outside it. Only the outer half existed. The inner half
is now `--ulimit cpu`, set to the problem's limit rounded up plus a second:
`RLIMIT_CPU` is the kernel stopping the process once it has burned that much CPU
time, and nothing in the image has to cooperate. There is no shell to wrap the
program in a `timeout` call even if we wanted one.

It is CPU time, not wall clock. A program that sleeps for an hour uses no CPU
and this never fires — which is exactly why the outer kill is not optional. The
two limits catch different programs.

### …and then it reported the wrong verdict

Adding it immediately broke the infinite-loop row. The CPU limit lands as a
plain `SIGKILL` on this host — exit 137, not the 152 a handled `SIGXCPU` would
give — so the exit code alone cannot say why a process died.

It can be read anyway, because the other two ways a sandboxed process gets
SIGKILLed are already ruled out by the time the check runs: the memory limit
sets `OOMKilled`, and our own kill sets `timedOut`. Inside a container with no
network, no shell and one process, nothing else is in a position to send it. So
a bare 137 is the CPU budget, and it reads as a time limit — "runtime error"
would send someone hunting a bug that is not there.

### A legitimate callback was too big to accept

Express gives every route a 100 KB body limit. The runner's contract allows
64 KB of output *per test case* plus another 64 KB of compiler output, so the
second test case with real output already exceeds it. The oversized body is
rejected before any handler runs, which surfaced as a 500 — and BullMQ then
retried it three times and dead-lettered the job, so a submission that had run
perfectly well was reported to the user as `INTERNAL_ERROR`.

The callback route now parses at 8 MB. Everything else keeps the small default:
the largest thing a client sends is 64 KB of code, and a generous body limit in
front of handlers anyone can reach is a denial-of-service primitive rather than
a convenience.

### …and fixing that turned the whole API into a 400

Mounting a path-scoped `express.json()` disabled body parsing for every other
route. Nest registers its own parsers during `init()`, but only if it cannot
already find a middleware named `jsonParser` on the stack — and a path-scoped
one is still named `jsonParser`. Nest concluded the job was done, registered
nothing, and every request arrived with an empty body. Registration succeeded
before the change and answered 400 after it.

Both parsers are now declared explicitly in `configureApp`, which is where the
file already claims everything that turns a bare Nest application into this one
lives. Working with the detection beats hiding from it.

### The production build had no working JavaScript at all

Not a Phase 4 bug, but Phase 4's browser suite is what found it. The
Content-Security-Policy added in Phase 3 carried a flat `script-src 'self'`.
Next emits inline bootstrap scripts; the browser refused every one; hydration
never ran; React tore the page down with error #412. Every route served markup
and an empty `<main>`.

Nothing caught it because the development policy carried `unsafe-inline` to keep
the dev overlay working, and every browser test until now ran against
`pnpm dev`. The only build anyone had opened in a browser was the relaxed one.

Fixing it took three attempts, each corrected by the browser rather than by
reasoning:

1. **A per-request nonce**, built in `src/proxy.ts` — inline scripts passed,
   every chunk was still refused. `'strict-dynamic'` turns off host-based
   allowlisting, and Turbopack does not put the nonce on the chunk `<script>`
   tags it emits.
2. **Nonce without `'strict-dynamic'`** — chunks passed, inline scripts were
   refused again. A statically prerendered page's HTML is written at build time,
   before any nonce exists, so Next has nothing to stamp onto it.
3. **`export const dynamic = 'force-dynamic'`** on the root layout, so every
   route is rendered per request and can carry one. The alternative was
   `'unsafe-inline'`, which hands back the main XSS vector to keep a handful of
   pages static — and nothing here is usefully static.

One inline script was still left: next-themes writes its own, to set the theme
before first paint, and Next does not nonce what it did not emit. The layouts
now read `x-nonce` from the request and hand it down.

`connect-src` was wrong too, and would have blocked the new WebSocket: a scheme
is part of a CSP source, so `http://localhost:4000` does not cover
`ws://localhost:4000`.

### A 4 GB allocation is not a 4 GB allocation

The obvious memory test, `bytearray(4 << 30)`, passes a 256 MB limit. CPython
maps it lazily, the pages are never faulted in, and the cgroup has nothing to
account for. The test then died on the clock instead — a `TIME_LIMIT_EXCEEDED`
for what is a memory bug.

The row now writes the bytes. Worth knowing in general: a memory limit bounds
what a program *touches*, not what it asks for.

---

## Sandbox controls

Every control from the table in `docs/code-execution.md` is built in exactly one
place — `containmentFlags` in `apps/code-runner/src/sandbox/docker.ts` — and
nothing else is allowed to assemble a `docker` command line. They are not tuning
knobs; removing one removes a specific defence.

| Control | Asserted by |
|---|---|
| `--network none` | HTTP request and DNS lookup both fail |
| `--memory` 256 MB, `--memory-swap` equal | 4 GB of written bytes is OOM-killed inside the container |
| `--pids-limit 64` | fork bomb held, host unaffected |
| `--read-only` root | write to `/etc` refused |
| `--tmpfs /tmp` `noexec,nosuid` | binary dropped in `/tmp` will not execute |
| `--tmpfs` 16 MB | a gigabyte of writes is bounded, host disk untouched |
| `--cap-drop ALL`, `no-new-privileges`, `--user 10001` | `/etc/shadow` unreadable, no docker socket reachable |
| `--ulimit cpu` | infinite loop stopped from inside |
| outer kill by container name | infinite loop leaves nothing running |
| 64 KB output cap | output flood truncated *and* the program killed |

**Killing the container, not the CLI.** The Phase 1 spike found that a `SIGKILL`
to the `docker` client leaves the container running and burning a core for
minutes. So every path out of `runSandboxed` — the timeout, the output cap,
every error — goes through `docker kill <name>` and then `docker rm -f <name>`,
and the orphan reaper is a backstop for a runner that died mid-run, not a
substitute for any of that.

**Truncation and the kill are two obligations.** Cutting our read of stdout
bounds *our* storage. It does not stop a program that is still printing into a
closed pipe.

**The compiler is a program reading attacker-controlled input.** It runs under
the same limits with its own longer timeout, and a compile-time memory bomb is a
`COMPILE_ERROR` — a verdict, not an outage.

---

## `INTERNAL_ERROR` is ours

A submission whose job exhausted its BullMQ attempts is reported as
`INTERNAL_ERROR` and stored with status `FAILED`. Two reasons it is a separate
verdict rather than a flavour of failure:

- a stuck spinner is indistinguishable from a lost submission to the person
  waiting, so the dead-letter path has to say *something*;
- `countsAgainstAccuracy` returns false for it. If our runner breaks, that must
  not look like the user getting a problem wrong — it would corrupt mastery in
  Phase 5, reschedule revision wrongly, and skew every recommendation after.

---

## One thing the plan asked for that was removed instead

The Phase 3 test panel had a **Custom input** tab — a textarea with no way to
run what you typed, because there was no runner yet. Phase 4 gives the panel a
working Run button right next to it.

A dead textarea beside a live button is worse than either. Running arbitrary
input is not in Phase 4's scope (`Run against samples · Submit against all`), so
the tab was removed rather than left as a trap. It comes back when there is
something behind it.

---

## Gate 4 — the finish line

| Check | Result |
|---|---|
| Adversarial suite | 11 / 11 |
| 100 concurrent submissions | pass — 100/100 `ACCEPTED` in 164 s, never more than 4 containers |
| `pnpm --filter @guruji/api test` | 59 passed |
| `test:e2e` (browser, real runner) | 5 passed, nothing logged to the console |
| `pnpm typecheck` · `pnpm lint` | clean across api, code-runner, web |
| `pnpm --filter @guruji/web build` | clean |
| Containers alive after the suite | none |

Six real defects, every one found by running the thing rather than reading it:
three in how the clock was measured, one in how a `SIGKILL` was read back, two in
API body parsing — and a seventh, inherited from Phase 3, that left the
production build with no working JavaScript on any route.

---

## Running it yourself

```bash
pnpm infra:up                                        # Postgres + Redis
pnpm --filter @guruji/code-runner images:build       # four sandbox images
pnpm --filter @guruji/code-runner dev                # the worker
pnpm dev:api
pnpm dev:web
```

Docker must be running; the daemon is a hard dependency, and the runner is
useless without it.

```bash
pnpm --filter @guruji/code-runner test               # adversarial suite
pnpm --filter @guruji/api test                       # API side, no runner needed
pnpm --filter @guruji/web test:e2e                   # browser, needs all of it
```

Run **one** of each. Two API instances fight over port 4000, and two runners
race for the same jobs — both look exactly like "the verdict never arrived", and
both cost an afternoon here before they were spotted.

The adversarial suite starts real containers and is slow by nature. On the
development host — 4 cores, 3.9 GB, Docker Desktop on WSL2 — a single trivial
run takes about 2 seconds idle and about 11 under four concurrent containers.
The hundred-submission row is minutes. That is a property of this laptop, not of
the design.

**Docker Desktop has died twice during the hundred-submission row**, taking
Postgres and Redis with it, and once taking the Node test runner down with
`FATAL ERROR: Zone Allocation failed - process out of memory`. Restart it and
re-run. This is recorded rather than shrugged off because it is the honest
reading of "no host degradation" on a 3.9 GB laptop: the sandbox holds, the
containers stay bounded, and the machine around them still runs out of room.
A real execution host is the answer, and it is already on the deferred-hardening
list in `docs/code-execution.md`.

---

## What comes next

**Phase 5 — Progress engine.** The hooks it needs are already in place and
deliberately unused: `countsAgainstAccuracy` in `packages/types/src/submission.ts`
is the rule about `INTERNAL_ERROR`, `isRun` separates exploration from a real
attempt, and `hintsUsedAtSubmit` and `timeSpentMs` are recorded on every row
waiting for something to read them.
