import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { prisma } from '@guruji/database'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { configureApp } from '../src/app-setup'

const PASSWORD = 'a-long-enough-password'

interface View {
  id: string
  kind: string
  problemId: string | null
  slug: string | null
  reason: string
  score: number
}

/**
 * The engine against the real database.
 *
 * The scoring and the ladder are pure and unit-tested. What only this can check
 * is that the pools produce anything at all, that the cache is dropped when it
 * has to be, and that a cold-start user gets something honest rather than an
 * empty list.
 */
describe('recommendations (e2e)', () => {
  let app: INestApplication
  let token: string
  let email: string
  let userId: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = configureApp(moduleRef.createNestApplication())
    await app.init()

    email = `rec-${randomUUID()}@example.com`
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: PASSWORD, displayName: 'Rec Tester' })
      .expect(201)
    token = response.body.accessToken as string
    userId = (await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } })).id
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } })
    await app.close()
  })

  const get = (path: string) =>
    request(app.getHttpServer()).get(path).set('authorization', `Bearer ${token}`)

  /* ---------------------------------------------------------------------- */

  it('gives a brand-new user something, with an honest reason', async () => {
    const response = await get('/api/recommendations').expect(200)
    const batch = response.body as View[]

    expect(batch.length).toBeGreaterThan(0)

    /*
     * Cold start. Every signal is undefined, and the engine says so rather than
     * inventing a weakness to justify its first pick — a plausible invented
     * explanation would teach the user to trust something that is guessing.
     */
    expect(batch[0]?.reason).toContain('roadmap')
    expect(batch.every((entry) => entry.reason.length > 0)).toBe(true)
  })

  it('never returns a problem the prerequisites do not allow', async () => {
    const response = await get('/api/recommendations').expect(200)
    const batch = response.body as View[]

    /*
     * Blocked means a prerequisite that is *reachable and unmet*, not merely
     * present.
     *
     * A prerequisite topic with no published problems is satisfied by default —
     * otherwise the gate is a dead end rather than a gate, since "solve
     * something here first" is an instruction nobody can follow. This
     * curriculum has exactly that at the head of its chain.
     */
    const solvedTopics = new Set(
      (
        await prisma.userTopicProgress.findMany({
          where: { userId, solved: { gt: 0 } },
          select: { topicId: true },
        })
      ).map((row) => row.topicId),
    )
    const emptyTopics = new Set(
      (
        await prisma.topic.findMany({
          where: { problems: { none: { problem: { reviewStatus: 'PUBLISHED' } } } },
          select: { id: true },
        })
      ).map((row) => row.id),
    )

    const edges = await prisma.topicPrerequisite.findMany({
      select: { topicId: true, prerequisiteId: true },
    })
    const blockedIds = new Set(
      edges
        .filter(
          (edge) => !solvedTopics.has(edge.prerequisiteId) && !emptyTopics.has(edge.prerequisiteId),
        )
        .map((edge) => edge.topicId),
    )

    for (const entry of batch) {
      if (entry.problemId === null) {
        continue
      }
      const topics = await prisma.problemTopic.findMany({
        where: { problemId: entry.problemId },
        select: { topicId: true },
      })
      // A gate, not a weight. Nothing behind one reaches the user at all.
      expect(topics.every((topic) => !blockedIds.has(topic.topicId))).toBe(true)
    }
  })

  it('holds topic diversity across the batch', async () => {
    const response = await get('/api/recommendations').expect(200)
    const batch = response.body as View[]

    const perTopic = new Map<string, number>()
    for (const entry of batch) {
      if (entry.problemId === null) {
        continue
      }
      const topics = await prisma.problemTopic.findMany({
        where: { problemId: entry.problemId },
        select: { topicId: true },
      })
      for (const { topicId } of topics) {
        perTopic.set(topicId, (perTopic.get(topicId) ?? 0) + 1)
      }
    }

    // Without this the engine degenerates: a user weak at DP gets DP all day,
    // until they stop opening the app.
    expect([...perTopic.values()].every((count) => count <= 2)).toBe(true)
  })

  it('answers TRAIN NOW with an activity and a reason', async () => {
    const response = await get('/api/recommendations/next').expect(200)
    const body = response.body as { kind: string; reason: string }

    expect(['REVISION', 'WEAK_TOPIC', 'NEW_PATTERN', 'NEW_PROBLEM', 'MOCK_CHALLENGE']).toContain(
      body.kind,
    )
    expect(body.reason.length).toBeGreaterThan(0)
  })

  it('serves the same batch from cache within the window', async () => {
    const first = (await get('/api/recommendations').expect(200)).body as View[]
    const second = (await get('/api/recommendations').expect(200)).body as View[]

    // Identical ids mean the second call did not re-run the engine. Worth
    // asserting because the batch is written to the database each time it is
    // built, and a cache that silently misses would fill that table on every
    // dashboard load.
    expect(second.map((entry) => entry.id)).toEqual(first.map((entry) => entry.id))
  })

  it('drops the cache when the user submits', async () => {
    const before = (await get('/api/recommendations').expect(200)).body as View[]

    const problem = await prisma.problem.findFirstOrThrow({
      where: { reviewStatus: 'PUBLISHED' },
      select: { id: true },
    })

    const accepted = await request(app.getHttpServer())
      .post('/api/submissions')
      .set('authorization', `Bearer ${token}`)
      .send({ problemId: problem.id, language: 'PYTHON', code: 'print(1)', isRun: false })
      .expect(202)

    await request(app.getHttpServer())
      .post('/api/internal/submissions/callback')
      .set('x-runner-secret', process.env.CODE_RUNNER_SHARED_SECRET ?? '')
      .send({
        submissionId: accepted.body.id,
        verdict: 'ACCEPTED',
        runtimeMs: 10,
        memoryKb: null,
        compileOutput: null,
        results: [],
      })
      .expect(204)

    const after = (await get('/api/recommendations').expect(200)).body as View[]

    // A stale recommendation after a submission defeats the entire premise, so
    // the invalidation is not optional.
    expect(after.map((entry) => entry.id)).not.toEqual(before.map((entry) => entry.id))
  })

  it('stops recommending something once it is solved', async () => {
    const solved = await prisma.submission.findFirstOrThrow({
      where: { userId, verdict: 'ACCEPTED', isRun: false },
      select: { problemId: true },
    })

    const batch = (await get('/api/recommendations').expect(200)).body as View[]

    // Revision will bring it back on its own schedule. Offering it as *new*
    // work the day it was solved is the engine ignoring what it just recorded.
    const asNew = batch.filter(
      (entry) => entry.problemId === solved.problemId && entry.kind !== 'REVISION',
    )
    expect(asNew).toHaveLength(0)
  })

  it('records a dismissal and refuses someone else’s', async () => {
    const batch = (await get('/api/recommendations').expect(200)).body as View[]
    const target = batch[0]?.id ?? ''

    await request(app.getHttpServer())
      .post(`/api/recommendations/${target}/dismiss`)
      .set('authorization', `Bearer ${token}`)
      .expect(204)

    const row = await prisma.recommendation.findUniqueOrThrow({ where: { id: target } })
    expect(row.dismissedAt).not.toBeNull()

    const other = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `rec-other-${randomUUID()}@example.com`,
        password: PASSWORD,
        displayName: 'Other',
      })
      .expect(201)

    await request(app.getHttpServer())
      .post(`/api/recommendations/${target}/dismiss`)
      .set('authorization', `Bearer ${other.body.accessToken as string}`)
      // 404, not 403: confirming the id exists is itself a disclosure.
      .expect(404)
  })

  describe('onboarding', () => {
    const onboard = (body: Record<string, unknown>) =>
      request(app.getHttpServer())
        .put('/api/profile/onboarding')
        .set('authorization', `Bearer ${token}`)
        .send({
          experienceLevel: 'ADVANCED',
          preferredLanguage: 'PYTHON',
          dailyGoalMinutes: 45,
          timezone: 'Asia/Kolkata',
          ...body,
        })

    it('seeds difficulty from stated experience, and nothing else', async () => {
      await onboard({}).expect(200)

      const profile = await prisma.profile.findUniqueOrThrow({ where: { userId } })
      expect(profile.onboardingCompletedAt).not.toBeNull()
      expect(profile.timezone).toBe('Asia/Kolkata')
      // Advanced aims higher than the default.
      expect(profile.difficultyTolerance).toBeGreaterThan(0.5)

      /*
       * And no mastery was invented. A score written from "I am advanced" is
       * fabricated data the engine would then reason from confidently. Only
       * solved problems create mastery rows.
       */
      const solvedTopics = await prisma.userTopicProgress.findMany({
        where: { userId, solved: 0 },
      })
      expect(solvedTopics).toHaveLength(0)
    })

    it('aims lower for a beginner', async () => {
      await onboard({ experienceLevel: 'BEGINNER' }).expect(200)

      const profile = await prisma.profile.findUniqueOrThrow({ where: { userId } })
      expect(profile.difficultyTolerance).toBeLessThan(0.3)
    })

    it('refuses a timezone the runtime does not know', async () => {
      // Refused at the edge, not silently turned into UTC later — which would
      // move the user's revision day without telling them.
      await onboard({ timezone: 'Mars/Olympus_Mons' }).expect(400)
    })

    it('refuses an answer outside the closed sets', async () => {
      await onboard({ experienceLevel: 'GRANDMASTER' }).expect(400)
      await onboard({ dailyGoalMinutes: 0 }).expect(400)
    })
  })

  it('refuses an anonymous read', async () => {
    await request(app.getHttpServer()).get('/api/recommendations').expect(401)
    await request(app.getHttpServer()).get('/api/recommendations/next').expect(401)
  })
})
