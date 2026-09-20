# GuruJi — Code Execution & Sandboxing

> Service: `apps/code-runner` · Images: `docker/sandbox/`
> Last updated: 2026-09-18

**This is the highest-risk component in the system.** We invite strangers to run
arbitrary code on our infrastructure. Everything here is written on the
assumption that someone will try.

---

## The one rule

> User code never executes in the API process. Not for "just JavaScript". Not
> in development. Not behind a feature flag.

`eval`, `vm`, `child_process` against user input, or any in-process interpreter
is an immediate rejection at review, regardless of what it makes easier.

---

## Pipeline

```
Browser
   │  POST /submissions
   ▼
NestJS API ── validate (language enum, code ≤ 64 KB, problem exists, ownership)
   │          persist Submission (QUEUED)
   ▼
BullMQ queue (Redis)              ← backpressure lives here
   │
   ▼
code-runner worker                ← bounded concurrency
   │
   ▼
Docker sandbox container          ← one per submission, destroyed after
   │  compile (if needed) → run against each test case
   ▼
Result ──▶ API callback ──▶ transaction ──▶ WebSocket ──▶ Browser
```

### Why a queue and not a direct call

Two reasons, both operational. A burst of submissions must not exhaust the API's
request handlers — the queue absorbs it and the API stays responsive. And a
crashed runner must not lose work: BullMQ retries with a bounded attempt count
and a dead-letter path.

The cost is that Redis is now on the submission critical path. Accepted; a
submission failing when Redis is down is honest and visible.

---

## Sandbox configuration

Every container is created with all of the following. These are not tuning
knobs — removing one removes a specific defence.

| Control | Setting | Attack it stops |
|---|---|---|
| `--network none` | no interface at all | Data exfiltration, SSRF into internal services, using us as a proxy |
| `--memory` | 256 MB, `--memory-swap` equal | Memory exhaustion of the host |
| `--cpus` | 1.0, `--cpu-shares` capped | CPU starvation of co-tenants |
| `--pids-limit` | 64 | **Fork bombs** — the single most common attack |
| `--read-only` | root filesystem read-only | Tampering with the image, persistence |
| `--tmpfs /tmp` | 16 MB, `noexec`, `nosuid` | Writing and executing a dropped binary |
| `--cap-drop ALL` | no capabilities | Privilege escalation primitives |
| `--security-opt no-new-privileges` | setuid neutralised | Escalation via setuid binaries |
| `--user` | non-root uid, no shell, no home | Everything that assumes root |
| `--ulimit fsize` | file-size cap | Disk exhaustion |
| wall-clock timeout | 5 s default, per-problem override | Infinite loops |
| output cap | 64 KB, stream truncated at source | Output floods filling disk and database |
| `--rm` + reaper | container removed; orphan sweep on a timer | Container accumulation |

**Docker socket is never mounted into a sandbox.** A mounted socket is root on
the host; it defeats every row in this table simultaneously.

### Timeout is enforced twice

Inside the container (a hard kill on the process) and outside it (the worker
kills the container). A process that ignores signals, or a container whose entry
process wedges, is still bounded. Relying on the inner timeout alone assumes the
sandboxed program cooperates — which is exactly the assumption we cannot make.

The inner half is `--ulimit cpu`, set to the problem's limit rounded up plus a
second. `RLIMIT_CPU` is the kernel sending `SIGXCPU` and then `SIGKILL` once the
process has burned that many **CPU** seconds; nothing in the image has to
cooperate, and there is no shell to wrap the program in a `timeout` call even if
we wanted one. It is CPU time, not wall clock — a program that sleeps for an
hour uses no CPU and this never fires — which is precisely why the outer kill is
not optional. The two limits catch different programs.

> **Killing the `docker run` client does not kill the container.** Verified on
> this host, twice, during the Phase 1 spike: a `SIGKILL` to the CLI left an
> infinite-loop container running and burning a full core for minutes
> afterwards. A pipeline that closes early (`docker run … | head -c 65536`) does
> the same thing.
>
> So the worker must **start the container detached with a known name or id and
> kill it by that id** — `docker run -d --name <id>` then `docker kill <id>` —
> never "spawn the CLI and kill the child process". Every timeout, every
> cancellation, and every error path must go through `docker kill <id>`, and the
> orphan reaper is a backstop for when even that is missed, not a substitute.

### Output is truncated, but the container is still killed

Truncating our read of stdout bounds *our* storage. It does not stop the program
— it keeps printing into a closed pipe. Truncation and an explicit container
kill are two separate obligations.

### Compilation is also sandboxed

A compiler is a program that reads attacker-controlled input. C++ templates can
be made to consume unbounded memory and time at compile time, and `#include`
directives are a filesystem probe. Compilation runs under the same limits as
execution, with its own (longer) timeout, and a compile failure is a verdict
(`COMPILE_ERROR`), not an infrastructure error.

---

## Images

One image per language, in `docker/sandbox/`, each built from a pinned base
tag — never `:latest`, so a rebuild cannot silently change the toolchain under
us.

| Language | Toolchain |
|---|---|
| C++ | g++, `-O2 -std=c++20` |
| C | gcc, `-O2 -std=c17` |
| Python | CPython 3.12, no pip, no site-packages beyond stdlib |
| JavaScript | Node 22, no npm, no network |

Images contain a compiler/interpreter and nothing else: no shell utilities, no
package manager, no curl, no git. Every extra binary is a tool we handed to an
attacker.

---

## Verdicts

| Verdict | Meaning |
|---|---|
| `ACCEPTED` | Every test case passed within limits |
| `WRONG_ANSWER` | Ran cleanly, output mismatch |
| `TIME_LIMIT_EXCEEDED` | Wall-clock limit hit |
| `MEMORY_LIMIT_EXCEEDED` | Container OOM-killed |
| `RUNTIME_ERROR` | Non-zero exit, signal, or uncaught exception |
| `COMPILE_ERROR` | Compilation failed — compiler output returned |
| `INTERNAL_ERROR` | **Our** failure |

`INTERNAL_ERROR` is deliberately separate and is **never counted against the
user's accuracy**. If our runner is broken, that must not look like the user
getting a problem wrong — it would corrupt mastery, trigger a wrong revision
reschedule, and skew every recommendation downstream.

### Output comparison

Trailing whitespace per line and trailing newlines are normalised before
comparison. Nothing else is. Problems needing float tolerance or unordered
output declare a comparison mode on the test case rather than having the runner
guess — a runner that guesses will eventually accept a wrong answer.

---

## What the runner is not allowed to have

- **No database credentials.** It cannot reach Postgres. Results go back through
  an authenticated callback to the API, which is the only writer.
- **No Groq key**, no third-party credentials.
- **No public ingress.** It listens on an internal network only.
- **No user-identifying data.** Jobs carry code, language, limits and test
  cases. The runner does not know whose code it is running, so a compromised
  runner leaks nothing about users.

Authentication between API and runner is a shared secret plus network isolation.

---

## Adversarial test suite

These run in CI and gate Phase 4. Each asserts *containment and correct verdict*
— not merely "it didn't crash".

| Test | Expected |
|---|---|
| `while(true){}` | `TIME_LIMIT_EXCEEDED`, container reaped, host CPU normal |
| Fork bomb | Blocked by `--pids-limit`, `RUNTIME_ERROR`, host unaffected |
| Allocate 4 GB | `MEMORY_LIMIT_EXCEEDED`, OOM kill inside the container only |
| `print` in an infinite loop | Output truncated at 64 KB, `TIME_LIMIT_EXCEEDED`, database write bounded |
| Read `/etc/passwd`, walk `/` | Nothing sensitive is reachable |
| Write outside `/tmp` | Fails — read-only root |
| Write and execute in `/tmp` | Fails — `noexec` |
| HTTP request to any host | Fails — no network |
| DNS lookup | Fails |
| Fill `/tmp` | Bounded by the tmpfs size, no host disk impact |
| Compile-time memory bomb (C++) | Bounded, `COMPILE_ERROR` |
| 100 concurrent submissions | Bounded concurrency, queue drains, no host degradation |

A failure in any row blocks the phase. There is no "we will harden it later" —
later is after it is exposed.

---

## Spike results — 2026-09-18

Run on the development host (Docker 28.5.1, Docker Desktop on Windows/WSL2,
4 CPUs, 3.9 GB) before Phase 1, to find out early whether these controls hold
here at all. Flags used were exactly those in the table above.

| Test | Result |
|---|---|
| Infinite loop | Contained — capped at ~1 of 4 cores. **Orphaned when the CLI was killed** (see above) |
| Infinite loop, killed by container id | Clean kill, nothing left running |
| Fork bomb `:(){ :\|:& };:` | Held by `--pids-limit 64`; container died on its own, host unaffected |
| 512 MB allocation in a 256 MB box | `exit 137` — OOM killed inside the container only |
| 128 MB allocation in a 256 MB box | Succeeded — the limit bounds, it does not break normal programs |
| `wget http://1.1.1.1` | Blocked — no network |
| Write to `/root` | Blocked — read-only root |
| Copy a binary to `/tmp` and execute | Blocked — `noexec` |
| 20 MB of stdout | Truncated cleanly at 64 KB |

**Conclusion:** the control set works on this host. The one real defect found was
the orphan behaviour, which is a worker implementation requirement rather than a
sandbox configuration problem. Phase 4 is not de-risked by this — the full
adversarial suite still gates it — but the approach is not going to collapse.

**Note on the 3.9 GB host:** at 256 MB per container, concurrency has to stay low
locally. `CODE_RUNNER_MAX_CONCURRENCY=4` is about the ceiling here before the
machine starts swapping.

## Local development

Docker Desktop must be running; the daemon is a hard dependency. Sandbox images
build via `pnpm --filter @guruji/code-runner images:build`.

Running the platform on Windows adds a WSL2 layer between the sandbox and the
host kernel. That is incidentally helpful locally, but it is not part of the
threat model — the controls above must hold on a plain Linux host, because
that is where production runs.

---

## Production hardening — deferred, tracked

The MVP ships hardened Docker as specified. Before any public deployment, the
following are decided rather than assumed:

- **Stronger isolation:** gVisor or Firecracker. Container escape via a kernel
  vulnerability is the residual risk that namespaces alone do not close.
- **Dedicated execution hosts**, isolated from API and database hosts, so an
  escape lands somewhere with nothing worth taking.
- **Per-user execution quotas** beyond rate limiting, to bound cost.
- **Egress firewall at the host level**, belt-and-braces behind `--network none`.

These are listed so they are a decision, not an oversight.
