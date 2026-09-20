import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { OUTPUT_CAP_BYTES, type Language, type RunnerCallback } from '@guruji/types'
import { judge } from '../src/judge'
import { docker } from '../src/sandbox/docker'

/**
 * The suite that gates Phase 4.
 *
 * Every row asserts *containment and the correct verdict*, not merely that
 * nothing crashed. A sandbox that holds but reports `WRONG_ANSWER` for an
 * infinite loop is still a bug — the person reading it would go looking at
 * their logic instead of their complexity.
 *
 * These start real containers, so they need Docker running and the sandbox
 * images built (`pnpm --filter @guruji/code-runner images:build`).
 */

function job(language: Language, code: string, expectedOutput = '', timeLimitMs = 3000) {
  return {
    submissionId: randomUUID(),
    language,
    code,
    timeLimitMs,
    memoryLimitMb: 256,
    testCases: [{ id: randomUUID(), input: '', expectedOutput }],
  }
}

/** Nothing of ours may still be running once a verdict exists. */
async function survivingContainers(): Promise<string[]> {
  const raw = await docker(['ps', '--filter', 'name=guruji-sbx-', '--format', '{{.ID}}'])
  return raw.split('\n').filter((line) => line.trim().length > 0)
}

async function expectNoSurvivors(): Promise<void> {
  expect(await survivingContainers()).toEqual([])
}

describe('adversarial suite', () => {
  it('contains an infinite loop and reports the time limit', async () => {
    const result = await judge(job('PYTHON', 'while True:\n    pass\n'))

    expect(result.verdict).toBe('TIME_LIMIT_EXCEEDED')
    // The Phase 1 spike found the defect this guards: killing the docker CLI
    // leaves the container running and burning a core for minutes afterwards.
    await expectNoSurvivors()
  })

  it('holds a fork bomb at the pid limit', async () => {
    const result = await judge(
      job(
        'PYTHON',
        [
          'import os',
          'try:',
          '    while True:',
          '        os.fork()',
          'except OSError:',
          '    print("blocked")',
        ].join('\n'),
        'blocked',
      ),
    )

    /*
     * The verdict is not the claim here, and cannot be.
     *
     * Every child that `fork()` returns into runs the rest of this program too,
     * so by the time the pid limit bites there are dozens of processes taking
     * turns on one stdout. Whether that lands as ACCEPTED, a mangled
     * WRONG_ANSWER, or a kill depends on scheduling. What must hold every time
     * is that the limit refuses the forks and the host never takes the load.
     */
    expect(['ACCEPTED', 'WRONG_ANSWER', 'RUNTIME_ERROR', 'TIME_LIMIT_EXCEEDED']).toContain(
      result.verdict,
    )
    await expectNoSurvivors()
  })

  it('OOM-kills a program that actually consumes 4 GB', async () => {
    /*
     * The bytes are written, not merely reserved.
     *
     * `bytearray(4 << 30)` looks like the same test and is not: CPython maps
     * it lazily, the pages are never faulted in, and the cgroup has nothing to
     * account. That version passes a 256 MB limit and then dies on the clock
     * instead — a `TIME_LIMIT_EXCEEDED` that sends the reader looking at their
     * complexity for what is a memory bug.
     */
    /*
     * A deliberately long clock, unlike every other row.
     *
     * With the usual 5 seconds, whichever limit lands first decides the
     * verdict, and on a loaded host that is sometimes the clock — which proves
     * nothing about memory. The row is about the memory limit, so the clock is
     * moved out of its way.
     */
    const result = await judge(
      job(
        'PYTHON',
        ['blocks = []', 'for _ in range(64):', "    blocks.append(b'x' * (64 * 1024 * 1024))"].join(
          '\n',
        ),
        '',
        20_000,
      ),
    )

    expect(result.verdict).toBe('MEMORY_LIMIT_EXCEEDED')
    await expectNoSurvivors()
  })

  it('truncates an output flood and still kills the program', async () => {
    const result = await judge(
      job('PYTHON', 'while True:\n    print("A" * 1024)\n'),
    )

    // Truncating our read bounds *our* storage; the kill is what stops the
    // program. Both obligations, asserted separately.
    const written = result.results[0]?.actualOutput ?? ''
    expect(written.length).toBeLessThanOrEqual(OUTPUT_CAP_BYTES)
    expect(['RUNTIME_ERROR', 'TIME_LIMIT_EXCEEDED']).toContain(result.verdict)
    await expectNoSurvivors()
  })

  it('exposes nothing sensitive on the filesystem', async () => {
    const result = await judge(
      job(
        'PYTHON',
        [
          'import os',
          'findings = []',
          "for path in ('/var/run/docker.sock', '/run/docker.sock', '/root/.ssh', '/host', '/mnt/c', '/.env'):",
          '    if os.path.exists(path):',
          "        findings.append('exists:' + path)",
          '# /etc/shadow ships in the base image. What matters is that a uid with',
          '# no account cannot read it.',
          'try:',
          "    open('/etc/shadow').read()",
          "    findings.append('read:/etc/shadow')",
          'except OSError:',
          '    pass',
          "print('safe' if not findings else ','.join(findings))",
        ].join('\n'),
        'safe',
      ),
    )

    // The docker socket is the one that matters most: a mounted socket is root
    // on the host and defeats every other control at once.
    expect(result.verdict).toBe('ACCEPTED')
  })

  it('refuses a write outside /tmp', async () => {
    const result = await judge(
      job(
        'PYTHON',
        [
          'try:',
          "    open('/etc/guruji', 'w').write('x')",
          "    print('WROTE')",
          'except OSError:',
          "    print('blocked')",
        ].join('\n'),
        'blocked',
      ),
    )

    expect(result.verdict).toBe('ACCEPTED')
  })

  it('refuses to execute a binary dropped in /tmp', async () => {
    const result = await judge(
      job(
        'PYTHON',
        [
          'import os, shutil',
          "shutil.copy('/usr/local/bin/python3', '/tmp/payload')",
          "os.chmod('/tmp/payload', 0o755)",
          'try:',
          "    os.execv('/tmp/payload', ['/tmp/payload', '-c', 'print(1)'])",
          "    print('EXECUTED')",
          'except OSError:',
          "    print('blocked')",
        ].join('\n'),
        'blocked',
      ),
    )

    // noexec is what makes "write it then run it" a dead end.
    expect(result.verdict).toBe('ACCEPTED')
  })

  it('has no network at all', async () => {
    const result = await judge(
      job(
        'PYTHON',
        [
          'import socket, urllib.request',
          'results = []',
          'try:',
          "    socket.getaddrinfo('example.com', 80)",
          "    results.append('DNS')",
          'except Exception:',
          '    pass',
          'try:',
          "    urllib.request.urlopen('http://1.1.1.1', timeout=2)",
          "    results.append('HTTP')",
          'except Exception:',
          '    pass',
          "print('blocked' if not results else ','.join(results))",
        ].join('\n'),
        'blocked',
      ),
    )

    expect(result.verdict).toBe('ACCEPTED')
  })

  it('bounds a program filling /tmp', async () => {
    const result = await judge(
      job(
        'PYTHON',
        [
          'try:',
          "    with open('/tmp/fill', 'wb') as handle:",
          '        for _ in range(1024):',
          "            handle.write(b'x' * 1024 * 1024)",
          '            handle.flush()',
          "    print('FILLED')",
          'except OSError:',
          "    print('blocked')",
        ].join('\n'),
        'blocked',
      ),
    )

    /*
     * The tmpfs is 16 MB. A gigabyte of writes has to stop inside it, not on
     * the host disk.
     *
     * Which verdict comes back is not the claim being made. The write may fail
     * with ENOSPC, or the program may still be grinding against a full tmpfs
     * when the clock runs out — both mean bounded. What the row asserts is
     * containment, so the verdict set is wide and the survivor check is not.
     */
    expect(['ACCEPTED', 'RUNTIME_ERROR', 'TIME_LIMIT_EXCEEDED']).toContain(result.verdict)
    await expectNoSurvivors()
  })

  it('bounds a C++ compile-time memory bomb and calls it a compile error', async () => {
    const bomb = [
      'template<int N> struct Bomb { using type = typename Bomb<N - 1>::type; char pad[1 << 16]; };',
      'template<> struct Bomb<0> { using type = int; };',
      'int main() { Bomb<100000>::type x = 0; return x; }',
    ].join('\n')

    const result = await judge(job('CPP', bomb, ''))

    // A compiler reading attacker-controlled input is still a program under
    // the same limits — and its failure is a verdict, not an outage.
    expect(result.verdict).toBe('COMPILE_ERROR')
    expect(result.compileOutput).toBeTruthy()
    await expectNoSurvivors()
  })

  it('still grades an ordinary correct program', async () => {
    const result: RunnerCallback = await judge(
      job('PYTHON', 'print("hello")\n', 'hello'),
    )

    // The control set has to bound abuse without breaking normal work. A
    // sandbox that fails everything is not secure, it is broken.
    expect(result.verdict).toBe('ACCEPTED')
    expect(result.results[0]?.passed).toBe(true)
  })
})
