import { createServer, type Server } from 'node:http'
import { randomUUID } from 'node:crypto'
import { AddressInfo } from 'node:net'
import { Queue } from 'bullmq'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SUBMISSION_QUEUE, type RunnerCallback, type RunnerJob } from '@guruji/types'
import { loadEnv } from '../src/config/env'
import { startWorker } from '../src/worker'
import { docker } from '../src/sandbox/docker'
import { pino } from 'pino'

/**
 * The last adversarial row: a hundred submissions at once.
 *
 * What is being checked is not throughput. It is that concurrency is bounded —
 * the queue absorbs the burst, the worker runs a fixed number of containers,
 * every job drains, and the host is not asked to hold a hundred sandboxes at
 * 256 MB each.
 *
 * The API is replaced by a throwaway HTTP server that counts callbacks. That
 * keeps this about the queue and the worker, with no database in the way.
 */
const JOB_COUNT = 100

describe('bounded concurrency', () => {
  let server: Server
  let queue: Queue<RunnerJob>
  let worker: { close: () => Promise<void> }
  let received: RunnerCallback[] = []
  let peakContainers = 0
  let concurrency = 0

  beforeAll(async () => {
    const env = loadEnv()
    concurrency = env.CODE_RUNNER_MAX_CONCURRENCY

    server = createServer((request, response) => {
      let body = ''
      request.on('data', (chunk: Buffer) => (body += chunk.toString('utf8')))
      request.on('end', () => {
        received.push(JSON.parse(body) as RunnerCallback)
        response.writeHead(204).end()
      })
    })
    await new Promise<void>((resolve) => server.listen(0, resolve))

    const port = (server.address() as AddressInfo).port
    worker = startWorker(
      { ...env, API_INTERNAL_URL: `http://127.0.0.1:${String(port)}` },
      pino({ level: 'fatal' }),
    )

    queue = new Queue<RunnerJob>(SUBMISSION_QUEUE, {
      connection: { url: env.REDIS_URL },
      defaultJobOptions: { attempts: 1, removeOnComplete: true, removeOnFail: true },
    })
  })

  afterAll(async () => {
    await worker.close()
    await queue.obliterate({ force: true }).catch(() => undefined)
    await queue.close()
    await new Promise<void>((resolve) => server.close(() => {
      resolve()
    }))
  })

  it('drains a hundred submissions without ever exceeding the concurrency limit', async () => {
    received = []

    const watcher = setInterval(() => {
      void docker(['ps', '--filter', 'name=guruji-sbx-', '--format', '{{.ID}}'])
        .then((raw) => {
          const running = raw.split('\n').filter((line) => line.trim().length > 0).length
          peakContainers = Math.max(peakContainers, running)
        })
        .catch(() => undefined)
    }, 250)

    for (let index = 0; index < JOB_COUNT; index += 1) {
      const id = randomUUID()
      await queue.add('judge', {
        submissionId: id,
        language: 'PYTHON',
        code: 'print("ok")\n',
        timeLimitMs: 3000,
        memoryLimitMb: 256,
        testCases: [{ id: randomUUID(), input: '', expectedOutput: 'ok' }],
      })
    }

    /*
     * Very generous, and deliberately so. The claim is that the queue drains
     * and the host is never asked to hold more than the limit — not that it is
     * quick.
     *
     * Measured on the development host: a trivial run takes about 2 seconds
     * idle and about 11 under four concurrent containers, which is five Docker
     * CLI round trips each fighting for four cores and 3.9 GB. A hundred of
     * those is minutes. On a real execution host it is not, and the number here
     * is a property of this laptop rather than of the design.
     */
    await waitFor(() => received.length === JOB_COUNT, 600_000)
    clearInterval(watcher)

    expect(received).toHaveLength(JOB_COUNT)

    // Counted rather than asserted one by one: when this row fails, the useful
    // question is "which verdict, and how many", and `every()` answers neither.
    const byVerdict = received.reduce<Record<string, number>>((tally, callback) => {
      tally[callback.verdict] = (tally[callback.verdict] ?? 0) + 1
      return tally
    }, {})
    expect(byVerdict).toEqual({ ACCEPTED: JOB_COUNT })

    // The whole point of the queue. Without a bound, a hundred containers at
    // 256 MB is 25 GB of intent on a host that has four.
    expect(peakContainers).toBeGreaterThan(0)
    expect(peakContainers).toBeLessThanOrEqual(concurrency)
  })
})

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error('the queue did not drain in time')
}
