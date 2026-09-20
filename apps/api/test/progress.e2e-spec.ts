import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { prisma } from '@guruji/database'
import { RUNNER_SECRET_HEADER, type SubmissionAccepted } from '@guruji/types'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { configureApp } from '../src/app-setup'

const PASSWORD = 'a-long-enough-password'
const SLUG = 'pair-sums-to-target'

/**
 * The counters, as the transaction actually leaves them.
 *
 * The formula itself is unit-tested and pure. What cannot be checked there is
 * whether the right things reach it: that a run is not an attempt, that a
 * retry is not a second attempt, and that our own failure never lands on the
 * user's record.
 */
describe('progress (e2e)', () => {
  let app: INestApplication
  let token: string
  let email: string
  let userId: string
  let problemId: string
  let topicId: string
  let secret: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = configureApp(moduleRef.createNestApplication())
    await app.init()

    email = `progress-${randomUUID()}@example.com`
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: PASSWORD, displayName: 'Progress Tester' })
      .expect(201)
    token = response.body.accessToken as string

    const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } })
    userId = user.id

    const problem = await prisma.problem.findFirstOrThrow({
      where: { slug: SLUG },
      select: { id: true, topics: { select: { topicId: true } } },
    })
    problemId = problem.id
    topicId = problem.topics[0]?.topicId ?? ''
    secret = process.env.CODE_RUNNER_SHARED_SECRET ?? ''
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } })
    await app.close()
  })

  /** Submits, then reports a verdict for it as the runner would. */
  async function judged(verdict: string, isRun = false): Promise<string> {
    const accepted = await request(app.getHttpServer())
      .post('/api/submissions')
      .set('authorization', `Bearer ${token}`)
      .send({ problemId, language: 'PYTHON', code: 'print(1)', isRun })
      .expect(202)

    const id = (accepted.body as SubmissionAccepted).id

    await request(app.getHttpServer())
      .post('/api/internal/submissions/callback')
      .set(RUNNER_SECRET_HEADER, secret)
      .send({
        submissionId: id,
        verdict,
        runtimeMs: 10,
        memoryKb: null,
        compileOutput: null,
        results: [],
      })
      .expect(204)

    return id
  }

  function topicProgress() {
    return prisma.userTopicProgress.findUnique({
      where: { userId_topicId: { userId, topicId } },
    })
  }

  /* ---------------------------------------------------------------------- */

  it('records nothing for an exploratory run', async () => {
    await judged('ACCEPTED', true)

    // Testing your thinking must never be punished, and must never be credited
    // either — a run against two sample cases is not evidence of anything.
    expect(await topicProgress()).toBeNull()
  })

  it('records nothing when our own runner broke', async () => {
    await judged('INTERNAL_ERROR')

    // The rule Phase 4 built the verdict for. If this ever counts, a broken
    // runner quietly rewrites the user's accuracy.
    expect(await topicProgress()).toBeNull()
  })

  it('counts a failed attempt as an attempt and not a solve', async () => {
    await judged('WRONG_ANSWER')

    const row = await topicProgress()
    expect(row?.attempts).toBe(1)
    expect(row?.solved).toBe(0)
    expect(row?.firstAttemptSolved).toBe(0)
    // Nothing solved, so nothing to be measured against.
    expect(row?.masteryScore).toBe(0)
  })

  it('does not count a retry of the same problem as a second attempt', async () => {
    await judged('WRONG_ANSWER')

    const row = await topicProgress()
    // Still one. Counting submissions instead of problems is what rewards
    // brute-force retrying, which is the habit the model exists to discourage.
    expect(row?.attempts).toBe(1)
  })

  it('credits the solve, but not as a first-attempt solve', async () => {
    await judged('ACCEPTED')

    const row = await topicProgress()
    expect(row?.solved).toBe(1)
    // It took three goes. `accuracy` is about the first one.
    expect(row?.firstAttemptSolved).toBe(0)
    expect(row?.masteryScore).toBeGreaterThan(0)
    expect(row?.lastPracticedAt).not.toBeNull()
  })

  it('does not credit the same problem twice', async () => {
    await judged('ACCEPTED')

    const row = await topicProgress()
    expect(row?.solved).toBe(1)
    expect(row?.attempts).toBe(1)
  })

  it('keeps a pattern row alongside the topic row', async () => {
    const rows = await prisma.userPatternProgress.findMany({ where: { userId } })

    // Two scores, because "bad at Graphs" and "bad at BFS" are different
    // diagnoses and collapsing them loses the one that is actionable.
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0]?.solved).toBe(1)
  })
})
