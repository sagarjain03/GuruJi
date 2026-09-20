import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { prisma } from '@guruji/database'
import {
  RUNNER_SECRET_HEADER,
  SUBMISSION_CODE_MAX,
  countsAgainstAccuracy,
  type SubmissionAccepted,
  type SubmissionDetail,
} from '@guruji/types'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { configureApp } from '../src/app-setup'

const PASSWORD = 'a-long-enough-password'
const SLUG = 'pair-sums-to-target'

/**
 * The API half of Phase 4, with no runner attached.
 *
 * The sandbox is exercised by the adversarial suite in `apps/code-runner`.
 * What is checked here is everything around it: what gets accepted, what the
 * queue is handed, who is allowed to report a verdict, and what happens to the
 * row when one arrives.
 */
describe('submissions (e2e)', () => {
  let app: INestApplication
  let token: string
  let otherToken: string
  let email: string
  let otherEmail: string
  let problemId: string
  let secret: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = configureApp(moduleRef.createNestApplication())
    await app.init()

    email = `submit-${randomUUID()}@example.com`
    otherEmail = `submit-${randomUUID()}@example.com`
    token = await register(email)
    otherToken = await register(otherEmail)

    const problem = await prisma.problem.findFirstOrThrow({
      where: { slug: SLUG },
      select: { id: true },
    })
    problemId = problem.id
    secret = process.env.CODE_RUNNER_SHARED_SECRET ?? ''
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [email, otherEmail] } } })
    await app.close()
  })

  async function register(address: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: address, password: PASSWORD, displayName: 'Submit Tester' })
      .expect(201)
    return response.body.accessToken as string
  }

  function submit(bearer: string, body: Record<string, unknown>): request.Test {
    return request(app.getHttpServer())
      .post('/api/submissions')
      .set('authorization', `Bearer ${bearer}`)
      .send({ problemId, language: 'PYTHON', code: 'print(1)', isRun: true, ...body })
  }

  // `object`, not `unknown`: the malformed-payload row deliberately sends a
  // shape the contract rejects, so this cannot be the callback type itself.
  function callback(body: object, header: string | null = secret): request.Test {
    const call = request(app.getHttpServer()).post('/api/internal/submissions/callback')
    if (header !== null) {
      call.set(RUNNER_SECRET_HEADER, header)
    }
    return call.send(body)
  }

  /* ---------------------------------------------------------------------- */

  it('answers 202 with an id — the work is queued, not done', async () => {
    const response = await submit(token, {}).expect(202)
    const accepted = response.body as SubmissionAccepted

    expect(accepted.id).toBeTruthy()
    expect(accepted.status).toBe('QUEUED')

    // Answering 200 with an empty verdict would be a lie the client then has to
    // decode. The row exists and is waiting; that is exactly what 202 means.
    const row = await prisma.submission.findUniqueOrThrow({ where: { id: accepted.id } })
    expect(row.status).toBe('QUEUED')
    expect(row.verdict).toBeNull()
  })

  it('takes the test-case count from the database, not the request', async () => {
    const run = await submit(token, { isRun: true }).expect(202)
    const full = await submit(token, { isRun: false }).expect(202)

    const runRow = await prisma.submission.findUniqueOrThrow({
      where: { id: (run.body as SubmissionAccepted).id },
    })
    const fullRow = await prisma.submission.findUniqueOrThrow({
      where: { id: (full.body as SubmissionAccepted).id },
    })

    // Run grades the samples; Submit grades everything. If these were equal,
    // "Submit" would be running a strictly easier check than it claims to.
    expect(runRow.totalCount).toBeGreaterThan(0)
    expect(fullRow.totalCount).toBeGreaterThan(runRow.totalCount)
  })

  it('refuses code past the cap before anything is enqueued', async () => {
    await submit(token, { code: 'x'.repeat(SUBMISSION_CODE_MAX + 1) }).expect(400)
  })

  it('refuses an unsupported language', async () => {
    await submit(token, { language: 'RUST' }).expect(400)
  })

  it('refuses an unknown problem', async () => {
    await submit(token, { problemId: randomUUID() }).expect(404)
  })

  it('refuses an anonymous submission', async () => {
    await request(app.getHttpServer())
      .post('/api/submissions')
      .send({ problemId, language: 'PYTHON', code: 'print(1)', isRun: true })
      .expect(401)
  })

  it('will not show one person another person’s submission', async () => {
    const response = await submit(token, {}).expect(202)
    const id = (response.body as SubmissionAccepted).id

    await request(app.getHttpServer())
      .get(`/api/submissions/${id}`)
      .set('authorization', `Bearer ${otherToken}`)
      // 404, not 403: confirming the id exists is itself a disclosure.
      .expect(404)
  })

  it('rejects a callback with no secret, and one with the wrong secret', async () => {
    const response = await submit(token, {}).expect(202)
    const id = (response.body as SubmissionAccepted).id
    const payload = verdictPayload(id, 'ACCEPTED')

    await callback(payload, null).expect(401)
    await callback(payload, 'not-the-secret-but-long-enough-to-compare').expect(401)

    // The row must be untouched by a rejected callback — otherwise the guard is
    // decorative.
    const row = await prisma.submission.findUniqueOrThrow({ where: { id } })
    expect(row.status).toBe('QUEUED')
  })

  it('records a verdict, its per-case results and the completion time', async () => {
    const response = await submit(token, { isRun: true }).expect(202)
    const id = (response.body as SubmissionAccepted).id

    const cases = await sampleCaseIds()
    await callback({
      submissionId: id,
      verdict: 'WRONG_ANSWER',
      runtimeMs: 42,
      memoryKb: null,
      compileOutput: null,
      results: cases.map((testCaseId, index) => ({
        testCaseId,
        passed: index === 0,
        runtimeMs: 21,
        memoryKb: null,
        actualOutput: 'nope',
        errorMessage: null,
      })),
    }).expect(204)

    const detail = await fetchDetail(id)
    expect(detail.status).toBe('COMPLETED')
    expect(detail.verdict).toBe('WRONG_ANSWER')
    expect(detail.passedCount).toBe(1)
    expect(detail.completedAt).not.toBeNull()
    expect(detail.results).toHaveLength(cases.length)
  })

  it('ignores a repeated callback rather than rewriting the verdict', async () => {
    const response = await submit(token, {}).expect(202)
    const id = (response.body as SubmissionAccepted).id

    await callback(verdictPayload(id, 'ACCEPTED')).expect(204)
    const first = await fetchDetail(id)

    // BullMQ is at-least-once, so the same result can arrive twice. The second
    // one must not move completedAt or re-fire the result event.
    await callback(verdictPayload(id, 'WRONG_ANSWER')).expect(204)
    const second = await fetchDetail(id)

    expect(second.verdict).toBe('ACCEPTED')
    expect(second.completedAt).toBe(first.completedAt)
  })

  it('caps stored output rather than trusting the runner to have done it', async () => {
    const response = await submit(token, {}).expect(202)
    const id = (response.body as SubmissionAccepted).id
    const cases = await sampleCaseIds()

    await callback({
      submissionId: id,
      verdict: 'WRONG_ANSWER',
      runtimeMs: 1,
      memoryKb: null,
      compileOutput: 'C'.repeat(200_000),
      results: [
        {
          testCaseId: cases[0],
          passed: false,
          runtimeMs: 1,
          memoryKb: null,
          actualOutput: 'A'.repeat(200_000),
          errorMessage: null,
        },
      ],
    }).expect(204)

    const row = await prisma.submission.findUniqueOrThrow({
      where: { id },
      select: { compileOutput: true, results: { select: { actualOutput: true } } },
    })
    expect(row.compileOutput?.length).toBe(64 * 1024)
    expect(row.results[0]?.actualOutput?.length).toBe(64 * 1024)
  })

  it('records our own failure as FAILED, and never as the user being wrong', async () => {
    const response = await submit(token, { isRun: false }).expect(202)
    const id = (response.body as SubmissionAccepted).id

    await callback({
      submissionId: id,
      verdict: 'INTERNAL_ERROR',
      runtimeMs: null,
      memoryKb: null,
      compileOutput: null,
      results: [],
    }).expect(204)

    const detail = await fetchDetail(id)
    expect(detail.status).toBe('FAILED')
    expect(detail.verdict).toBe('INTERNAL_ERROR')

    // The rule Phase 5 depends on. A broken runner must not corrupt mastery,
    // reschedule revision, or skew every recommendation downstream.
    expect(countsAgainstAccuracy(detail.verdict, detail.isRun)).toBe(false)
  })

  it('rejects a callback that does not match the contract', async () => {
    await callback({ submissionId: randomUUID(), verdict: 'NOT_A_VERDICT' }).expect(400)
  })

  it('lists the caller’s own submissions, newest first', async () => {
    // Deliberately does not submit again. Ten a minute is the documented limit
    // and the tests above have already spent it — an eleventh submission here
    // would fail on the rate limiter doing its job, which is not what this row
    // is about. The rows those tests created are what gets listed.
    const response = await request(app.getHttpServer())
      .get(`/api/submissions?problemId=${problemId}&limit=5`)
      .set('authorization', `Bearer ${token}`)
      .expect(200)

    const body = response.body as { items: { createdAt: string }[]; hasMore: boolean }
    expect(body.items.length).toBeGreaterThan(0)

    const times = body.items.map((item) => Date.parse(item.createdAt))
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })

  /* ---------------------------------------------------------------------- */

  async function sampleCaseIds(): Promise<string[]> {
    const rows = await prisma.testCase.findMany({
      where: { problemId, isSample: true },
      select: { id: true },
      orderBy: { displayOrder: 'asc' },
    })
    return rows.map((row) => row.id)
  }

  function verdictPayload(submissionId: string, verdict: string) {
    return {
      submissionId,
      verdict,
      runtimeMs: 10,
      memoryKb: null,
      compileOutput: null,
      results: [],
    }
  }

  async function fetchDetail(id: string): Promise<SubmissionDetail> {
    const response = await request(app.getHttpServer())
      .get(`/api/submissions/${id}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200)
    return response.body as SubmissionDetail
  }
})
