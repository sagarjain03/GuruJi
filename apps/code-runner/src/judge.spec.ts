import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { judge } from './judge'
import { runSandboxed, type SandboxResult } from './sandbox/docker'

// Hoisted above the imports by vitest: `judge` gets the fake, and no container starts.
vi.mock('./sandbox/docker', () => ({ runSandboxed: vi.fn() }))

const sandbox = vi.mocked(runSandboxed)

const LIMIT_MS = 2000

function run(overrides: Partial<SandboxResult>): SandboxResult {
  return {
    exitCode: 0,
    stdout: '42\n',
    stderr: '',
    timedOut: false,
    oomKilled: false,
    wallMs: 300,
    stdoutTruncated: false,
    ...overrides,
  }
}

const slowBoot = run({ wallMs: 2781 })
const stillRunning = run({ timedOut: true, exitCode: null, stdout: '', wallMs: 2100 })

function job(cases = 1) {
  return {
    submissionId: randomUUID(),
    language: 'PYTHON' as const,
    code: 'print(42)\n',
    timeLimitMs: LIMIT_MS,
    memoryLimitMb: 256,
    testCases: Array.from({ length: cases }, () => ({ id: randomUUID(), input: '', expectedOutput: '42\n' })),
  }
}

/**
 * A time limit is judged on wall clock inside the container, which includes
 * the interpreter booting. On a busy host that boot alone spiked past 2 s, and
 * about one correct submission in seven came back TIME_LIMIT_EXCEEDED. So a
 * case that overruns is run once more before the verdict stands.
 */
describe('judge: a time limit is confirmed before it is reported', () => {
  beforeEach(() => {
    sandbox.mockReset()
  })

  it('accepts a correct program whose first run was slowed by the host', async () => {
    sandbox.mockResolvedValueOnce(slowBoot).mockResolvedValueOnce(run({ wallMs: 310 }))

    const result = await judge(job())

    expect(result.verdict).toBe('ACCEPTED')
    expect(sandbox).toHaveBeenCalledTimes(2)
    // The run that counts is the one that finished inside the limit.
    expect(result.results[0]).toMatchObject({ passed: true, runtimeMs: 310, errorMessage: null })
    expect(result.runtimeMs).toBe(310)
  })

  it('reports a time limit that happens twice', async () => {
    sandbox.mockResolvedValue(stillRunning)

    const result = await judge(job())

    expect(result.verdict).toBe('TIME_LIMIT_EXCEEDED')
    expect(sandbox).toHaveBeenCalledTimes(2)
  })

  it('retries only until a time limit is confirmed: a slow program costs one extra run, not double', async () => {
    sandbox.mockResolvedValue(stillRunning)

    const result = await judge(job(4))

    expect(result.verdict).toBe('TIME_LIMIT_EXCEEDED')
    // Case 1 twice (confirmed), cases 2–4 once each.
    expect(sandbox).toHaveBeenCalledTimes(5)
    expect(result.results).toHaveLength(4)
  })

  it('keeps retrying host spikes on later cases while nothing is confirmed', async () => {
    sandbox
      .mockResolvedValueOnce(run({}))
      .mockResolvedValueOnce(slowBoot)
      .mockResolvedValueOnce(run({}))
      .mockResolvedValueOnce(slowBoot)
      .mockResolvedValueOnce(run({}))

    const result = await judge(job(3))

    expect(result.verdict).toBe('ACCEPTED')
    expect(sandbox).toHaveBeenCalledTimes(5)
  })

  it('never retries a verdict the host cannot cause', async () => {
    sandbox.mockResolvedValue(run({ stdout: '41\n' }))

    const result = await judge(job())

    expect(result.verdict).toBe('WRONG_ANSWER')
    expect(sandbox).toHaveBeenCalledTimes(1)
  })
})
