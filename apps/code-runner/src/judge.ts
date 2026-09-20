import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  OUTPUT_CAP_BYTES,
  type RunnerCallback,
  type RunnerJob,
  type RunnerResult,
  type Verdict,
} from '@guruji/types'
import { runSandboxed } from './sandbox/docker'
import { LANGUAGES } from './sandbox/languages'

/** Compilation gets its own, longer budget: a template-heavy C++ file is slow. */
const COMPILE_TIMEOUT_MS = Number(process.env.COMPILE_TIMEOUT_MS ?? 20_000)

/**
 * Worse verdicts win.
 *
 * A submission that times out on one case and merely answers wrong on another
 * is reported as a timeout: the resource failure is the thing to fix first, and
 * reporting the milder problem would send someone looking in the wrong place.
 */
const SEVERITY: Verdict[] = [
  'INTERNAL_ERROR',
  'COMPILE_ERROR',
  'MEMORY_LIMIT_EXCEEDED',
  'TIME_LIMIT_EXCEEDED',
  'RUNTIME_ERROR',
  'WRONG_ANSWER',
  'ACCEPTED',
]

function worst(a: Verdict, b: Verdict): Verdict {
  return SEVERITY.indexOf(a) <= SEVERITY.indexOf(b) ? a : b
}

/**
 * Trailing whitespace per line and trailing newlines are normalised. Nothing
 * else is — a comparison that tries to be clever eventually accepts a wrong
 * answer. Problems needing float tolerance declare it on the test case; none do
 * yet, and the runner does not guess.
 */
function normalise(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t\r]+$/, ''))
    .join('\n')
    .replace(/\n+$/, '')
}

export async function judge(job: RunnerJob): Promise<RunnerCallback> {
  const plan = LANGUAGES[job.language]
  const workDir = await mkdtemp(path.join(tmpdir(), 'guruji-run-'))

  try {
    await writeFile(path.join(workDir, plan.sourceFile), job.code, 'utf8')

    if (plan.compile) {
      const compiled = await runSandboxed({
        image: plan.image,
        workDir,
        // The only step allowed to write into the work directory.
        mount: 'rw',
        entrypoint: plan.compile.entrypoint,
        args: plan.compile.args,
        stdin: '',
        timeoutMs: COMPILE_TIMEOUT_MS,
        memoryLimitMb: job.memoryLimitMb,
        outputCapBytes: OUTPUT_CAP_BYTES,
      })

      if (compiled.timedOut || compiled.oomKilled || compiled.exitCode !== 0) {
        // A compile failure is a verdict, not an infrastructure error — even
        // when the cause is a compile-time memory bomb.
        return {
          submissionId: job.submissionId,
          verdict: 'COMPILE_ERROR',
          runtimeMs: null,
          memoryKb: null,
          compileOutput: compileMessage(compiled.stderr, compiled.timedOut, compiled.oomKilled),
          results: [],
        }
      }
    }

    const results: RunnerResult[] = []
    let verdict: Verdict = 'ACCEPTED'
    let slowestMs = 0

    for (const testCase of job.testCases) {
      const run = await runSandboxed({
        image: plan.image,
        // Read-only: the program must not be able to rewrite the binary it is.
        workDir,
        mount: 'ro',
        entrypoint: plan.run.entrypoint,
        args: plan.run.args,
        stdin: testCase.input,
        timeoutMs: job.timeLimitMs,
        memoryLimitMb: job.memoryLimitMb,
        outputCapBytes: OUTPUT_CAP_BYTES,
      })

      slowestMs = Math.max(slowestMs, run.wallMs)

      const outcome = classify(run, testCase.expectedOutput, job.timeLimitMs)
      verdict = worst(verdict, outcome.verdict)

      results.push({
        testCaseId: testCase.id,
        passed: outcome.verdict === 'ACCEPTED',
        runtimeMs: run.wallMs,
        memoryKb: null,
        actualOutput: run.stdout.slice(0, OUTPUT_CAP_BYTES),
        errorMessage: outcome.message,
      })
    }

    return {
      submissionId: job.submissionId,
      verdict,
      runtimeMs: slowestMs,
      memoryKb: null,
      compileOutput: null,
      results,
    }
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

interface Outcome {
  verdict: Verdict
  message: string | null
}

function classify(
  run: {
    exitCode: number | null
    stdout: string
    stderr: string
    timedOut: boolean
    oomKilled: boolean
    stdoutTruncated: boolean
    wallMs: number
  },
  expected: string,
  timeLimitMs: number,
): Outcome {
  // Checked before the timeout: a program killed for memory often also hits the
  // clock on the way down, and "you ran out of memory" is the useful message.
  if (run.oomKilled) {
    return { verdict: 'MEMORY_LIMIT_EXCEEDED', message: 'Memory limit exceeded.' }
  }
  if (run.timedOut) {
    return { verdict: 'TIME_LIMIT_EXCEEDED', message: 'Time limit exceeded.' }
  }
  /*
   * The program overran, measured by the daemon.
   *
   * `wallMs` is `StartedAt` to `FinishedAt` — the container's own life, with
   * none of our create-and-start overhead in it. That distinction is the whole
   * reason this check exists rather than reading our own stopwatch: under four
   * concurrent containers on the development host, startup alone was seconds,
   * and one trivial correct submission in ten came back `TIME_LIMIT_EXCEEDED`
   * for it. A verdict must not depend on how busy the host was.
   */
  if (run.wallMs > timeLimitMs) {
    return { verdict: 'TIME_LIMIT_EXCEEDED', message: 'Time limit exceeded.' }
  }
  /*
   * The *inner* timeout landing.
   *
   * `--ulimit cpu` makes the kernel stop the process once it has burned its CPU
   * budget. Measured on this host it arrives as a plain SIGKILL — exit 137, not
   * the 152 that a handled `SIGXCPU` would give — so the exit code alone cannot
   * say why.
   *
   * It can be read here anyway, because the other two ways a sandboxed process
   * gets SIGKILLed have already been ruled out above: the memory limit sets
   * `OOMKilled`, and our own kill sets `timedOut`. Nothing else inside a
   * container with no network, no shell and one process is in a position to
   * send it. So a bare 137 is the CPU budget, and it has to read as a time
   * limit — "runtime error" would send someone hunting a bug that is not there.
   */
  if (run.exitCode === 137 || run.exitCode === 152) {
    return { verdict: 'TIME_LIMIT_EXCEEDED', message: 'Time limit exceeded.' }
  }
  if (run.stdoutTruncated) {
    return {
      verdict: 'RUNTIME_ERROR',
      message: 'Output exceeded 64 KB and was truncated.',
    }
  }
  if (run.exitCode !== 0) {
    return {
      verdict: 'RUNTIME_ERROR',
      message: firstLines(run.stderr) || `Exited with status ${String(run.exitCode)}.`,
    }
  }
  if (normalise(run.stdout) !== normalise(expected)) {
    return { verdict: 'WRONG_ANSWER', message: null }
  }
  return { verdict: 'ACCEPTED', message: null }
}

function compileMessage(stderr: string, timedOut: boolean, oomKilled: boolean): string {
  if (oomKilled) {
    return 'The compiler ran out of memory.'
  }
  if (timedOut) {
    return 'Compilation took too long and was stopped.'
  }
  return stderr.slice(0, OUTPUT_CAP_BYTES)
}

/** Enough of a stack trace to be useful, not enough to fill the panel. */
function firstLines(text: string, count = 8): string {
  return text.split('\n').slice(0, count).join('\n').trim()
}
