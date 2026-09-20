import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'

export interface SandboxRequest {
  image: string
  /** Host directory mounted at /sandbox. */
  workDir: string
  /** Compilation needs to write its output; running must not. */
  mount: 'ro' | 'rw'
  entrypoint: string
  args: string[]
  stdin: string
  timeoutMs: number
  memoryLimitMb: number
  outputCapBytes: number
}

export interface SandboxResult {
  exitCode: number | null
  stdout: string
  stderr: string
  /** True when our own clock ran out, whatever the container then reported. */
  timedOut: boolean
  /** From `docker inspect`, not guessed from the exit code. */
  oomKilled: boolean
  /**
   * How long the *program* ran, from the daemon's own `StartedAt`/`FinishedAt`.
   *
   * Not our wall clock around the CLI. That figure includes creating and
   * starting the container, which is our cost and varies with how busy the host
   * is — reporting it would tell someone their O(n) solution took 3 seconds
   * because ninety-nine other people pressed Submit at the same moment.
   */
  wallMs: number
  stdoutTruncated: boolean
}

/**
 * Every control from the table in docs/code-execution.md.
 *
 * These are not tuning knobs. Removing one removes a specific defence, so they
 * are built in one place and nothing else is allowed to assemble a `docker`
 * command line.
 */
function containmentFlags(request: SandboxRequest): string[] {
  return [
    // Data exfiltration, SSRF into internal services, using us as a proxy.
    '--network', 'none',
    // Memory exhaustion of the host. Swap equal to memory means no swapping out.
    '--memory', `${String(request.memoryLimitMb)}m`,
    '--memory-swap', `${String(request.memoryLimitMb)}m`,
    // CPU starvation of co-tenants.
    '--cpus', '1.0',
    // Fork bombs — the single most common attack.
    '--pids-limit', '64',
    // Tampering with the image, and persistence between runs.
    '--read-only',
    // Writing and then executing a dropped binary.
    '--tmpfs', '/tmp:rw,noexec,nosuid,size=16m',
    // Privilege escalation primitives.
    '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges',
    // A uid that exists in no /etc/passwd in the image: no account to be.
    '--user', '10001:10001',
    // Disk exhaustion.
    '--ulimit', 'fsize=8388608',
    '--ulimit', 'nproc=64',
    /*
     * The inner half of "the timeout is enforced twice".
     *
     * `runSandboxed` kills the container from outside when its own clock runs
     * out. This is the kernel doing the same job from inside: RLIMIT_CPU sends
     * SIGXCPU and then SIGKILL once the process has burned this many seconds of
     * CPU, and no cooperation from the program is required for it to land.
     *
     * CPU seconds, not wall clock — a program sleeping for an hour is not
     * stopped by this, which is exactly why the outer kill is not optional.
     * Rounded up, plus a second, so an honest solution finishing right on the
     * limit is killed by the clock it was told about rather than by this.
     */
    '--ulimit', `cpu=${String(Math.ceil(request.timeoutMs / 1000) + 1)}`,
    '-v', `${request.workDir}:/sandbox:${request.mount}`,
    '--entrypoint', request.entrypoint,
  ]
}

/**
 * Runs one container and returns what it did.
 *
 * **The container is created and killed by name, never by killing the CLI.**
 * The Phase 1 spike proved that killing the `docker` client leaves the
 * container running — an infinite loop kept burning a full core for minutes
 * afterwards. So every path out of this function, including the timeout and
 * every error, goes through `docker kill <name>` and then `docker rm -f <name>`.
 */
/**
 * Container startup is our cost, not the submitter's.
 *
 * The clock can only be armed when we hand the container to the daemon, and
 * everything between that and the program's first instruction — namespace
 * setup, image entrypoint, interpreter boot — happens inside it. On an idle
 * host that is tens of milliseconds. Under concurrent load it was seconds, and
 * trivial correct programs came back `TIME_LIMIT_EXCEEDED` because of it. A
 * verdict must not depend on how busy the host was.
 *
 * So the program's deadline is armed when the container is observed running,
 * this is only how often we look, and the *reported* runtime is read from the
 * daemon rather than measured around the CLI.
 */
/**
 * Headroom on the outer kill, and it does not have to be tight.
 *
 * The two timeouts catch different programs, and only one of them is in a
 * hurry. `--ulimit cpu` is the kernel stopping anything that *burns* its
 * budget — an infinite loop dies inside the container, at the limit, for free.
 * What is left for the outer kill is programs that use no CPU at all: one
 * sleeping for an hour, or a container the daemon has wedged. Those cost
 * nothing while they wait, so waiting longer to be sure costs nothing either.
 *
 * Being able to be generous here is what makes the startup problem go away. An
 * earlier attempt polled `docker inspect` every 200 ms to find out when the
 * container really started, which is a CLI process per poll per container —
 * four concurrent runs put twenty process spawns a second on the host and the
 * test runner died with "out of memory". Cheap and approximate beats exact and
 * expensive when something else already holds the tight bound.
 */
const STARTUP_CEILING_MS = Number(process.env.SANDBOX_STARTUP_CEILING_MS ?? 30_000)

export async function runSandboxed(request: SandboxRequest): Promise<SandboxResult> {
  const name = `guruji-sbx-${randomUUID()}`
  const startedAt = Date.now()

  await docker([
    'create',
    '--name', name,
    // -i so the program can be fed stdin when it is started.
    '-i',
    ...containmentFlags(request),
    request.image,
    ...request.args,
  ])

  try {
    const attached = await attach(name, request)
    const inspected = await inspect(name)

    return {
      exitCode: attached.timedOut ? null : inspected.exitCode,
      stdout: attached.stdout,
      stderr: attached.stderr,
      timedOut: attached.timedOut,
      oomKilled: inspected.oomKilled,
      // The daemon's figure when it has one; ours only as a fallback.
      wallMs: inspected.ranForMs ?? Date.now() - startedAt,
      stdoutTruncated: attached.stdoutTruncated,
    }
  } finally {
    // Unconditional. `kill` before `rm -f` because a wedged container makes
    // `rm -f` slow, and the point is to stop it burning CPU immediately.
    await docker(['kill', name]).catch(() => undefined)
    await docker(['rm', '-f', name]).catch(() => undefined)
  }
}

interface AttachResult {
  stdout: string
  stderr: string
  timedOut: boolean
  stdoutTruncated: boolean
}

function attach(name: string, request: SandboxRequest): Promise<AttachResult> {
  return new Promise<AttachResult>((resolve) => {
    const child = spawn('docker', ['start', '--attach', '--interactive', name], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    let stdoutTruncated = false
    let timedOut = false
    let settled = false

    const finish = (): void => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      resolve({ stdout, stderr, timedOut, stdoutTruncated })
    }

    /*
     * The safety net, not the program's budget.
     *
     * This clock starts when the container is handed to the daemon, so it also
     * covers startup — which is our cost and varies with load. It is therefore
     * not the thing that decides `TIME_LIMIT_EXCEEDED`; the daemon's own
     * `StartedAt`/`FinishedAt` is, and `judge` reads it. What this guarantees
     * is only that nothing runs forever.
     */
    const timer = setTimeout(() => {
      timedOut = true
      // Kill the *container*, not this process. Killing the client here would
      // leave the program running — the exact defect the spike found.
      void docker(['kill', name])
        .catch(() => undefined)
        .finally(() => {
          child.kill('SIGKILL')
          finish()
        })
    }, request.timeoutMs + STARTUP_CEILING_MS)

    child.stdout.on('data', (chunk: Buffer) => {
      if (stdout.length >= request.outputCapBytes) {
        // Truncating our read bounds *our* storage. It does not stop the
        // program — that is what the kill below is for.
        if (!stdoutTruncated) {
          stdoutTruncated = true
          void docker(['kill', name]).catch(() => undefined)
        }
        return
      }
      stdout += chunk.toString('utf8')
      if (stdout.length > request.outputCapBytes) {
        stdout = stdout.slice(0, request.outputCapBytes)
        stdoutTruncated = true
        void docker(['kill', name]).catch(() => undefined)
      }
    })

    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < request.outputCapBytes) {
        stderr = (stderr + chunk.toString('utf8')).slice(0, request.outputCapBytes)
      }
    })

    child.on('error', finish)
    child.on('close', finish)

    child.stdin.on('error', () => {
      // The program may exit without reading stdin. That closes the pipe, and
      // writing to it then throws EPIPE — which is not an error worth failing a
      // submission over.
    })
    child.stdin.end(request.stdin)
  })
}

interface Inspection {
  exitCode: number | null
  oomKilled: boolean
  /** Null when the daemon has no usable pair of timestamps. */
  ranForMs: number | null
}

/**
 * OOM, the exit code and the run duration all come from the daemon rather than
 * being inferred out here.
 *
 * Exit code 137 means "killed by SIGKILL", which is also what a timeout kill
 * looks like. Only `State.OOMKilled` distinguishes a memory limit from every
 * other reason a container was killed. And `StartedAt`/`FinishedAt` bracket the
 * program itself, with none of our own container-startup overhead in them.
 */
async function inspect(name: string): Promise<Inspection> {
  try {
    const raw = await docker([
      'inspect',
      '--format',
      '{{.State.ExitCode}} {{.State.OOMKilled}} {{.State.StartedAt}} {{.State.FinishedAt}}',
      name,
    ])
    const [code, oom, startedAt, finishedAt] = raw.trim().split(/\s+/)
    return {
      exitCode: code === undefined ? null : Number.parseInt(code, 10),
      oomKilled: oom === 'true',
      ranForMs: durationMs(startedAt, finishedAt),
    }
  } catch {
    return { exitCode: null, oomKilled: false, ranForMs: null }
  }
}

/**
 * A container that never started carries the zero timestamp
 * (`0001-01-01T00:00:00Z`), which parses fine and yields a nonsense duration.
 * Anything negative or absurd is discarded in favour of our own measurement.
 */
function durationMs(startedAt?: string, finishedAt?: string): number | null {
  if (startedAt === undefined || finishedAt === undefined) {
    return null
  }
  const start = Date.parse(startedAt)
  const end = Date.parse(finishedAt)
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return null
  }
  const elapsed = end - start
  return elapsed >= 0 && elapsed < 24 * 60 * 60 * 1000 ? elapsed : null
}

export function docker(args: string[]): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(`docker ${args[0] ?? ''} failed (${String(code)}): ${stderr.trim()}`))
      }
    })
  })
}

/**
 * Backstop, not the primary mechanism.
 *
 * Everything above kills by name on every path. This sweeps up the case where
 * the runner itself died between `create` and `finally`.
 */
export async function reapOrphans(olderThanMs: number): Promise<number> {
  const raw = await docker([
    'ps',
    '--filter', 'name=guruji-sbx-',
    '--format', '{{.ID}} {{.CreatedAt}}',
  ]).catch(() => '')

  const cutoff = Date.now() - olderThanMs
  let reaped = 0

  for (const line of raw.split('\n')) {
    const [id, ...rest] = line.trim().split(/\s+/)
    if (id === undefined || id.length === 0) {
      continue
    }
    const createdAt = Date.parse(rest.slice(0, 2).join(' '))
    if (Number.isNaN(createdAt) || createdAt < cutoff) {
      await docker(['rm', '-f', id]).catch(() => undefined)
      reaped += 1
    }
  }

  return reaped
}
