# Phase 4 — Code runner

> **Status:** in progress · 2026-09-20
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

A verdict that depends on how busy the host was is not a verdict. Two changes:

- the outer kill gets `SANDBOX_STARTUP_GRACE_MS` (5 s) of headroom on top of the
  problem's limit, because startup is our cost;
- the *reported* runtime is read from the daemon's own `StartedAt`/`FinishedAt`
  rather than measured around the CLI, so it is the program's time and not ours.

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

The adversarial suite starts real containers and is slow by nature. On the
development host — 4 cores, 3.9 GB, Docker Desktop on WSL2 — a single trivial
run takes about 2 seconds idle and about 11 under four concurrent containers.
The hundred-submission row is minutes. That is a property of this laptop, not of
the design.
