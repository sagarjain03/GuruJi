import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { prisma, type Verdict } from '@guruji/database'
import type { ActivityResponse, AnalyticsOverview, ErrorEnvelope, TopicAnalytics, TrendsResponse } from '@guruji/types'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { configureApp } from '../src/app-setup'

const PASSWORD = 'a-long-enough-password'

function daysAgo(days: number, hour = 12): Date {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  date.setUTCHours(hour, 0, 0, 0)
  return date
}

const day = (date: Date) => date.toISOString().slice(0, 10)

describe('analytics ranges (e2e)', () => {
  let app: INestApplication
  let token: string
  let email: string
  let easyId: string
  let otherEasyId: string
  let mediumId: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = configureApp(moduleRef.createNestApplication())
    await app.init()

    email = `analytics-${randomUUID()}@example.com`
    const registered = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: PASSWORD, displayName: 'Analytics Tester' })
      .expect(201)
    token = registered.body.accessToken as string
    const { id: userId } = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } })

    const easy = await prisma.problem.findMany({ where: { difficulty: 'EASY' }, select: { id: true }, take: 2 })
    const medium = await prisma.problem.findFirstOrThrow({ where: { difficulty: 'MEDIUM' }, select: { id: true } })
    easyId = easy[0]?.id ?? ''
    otherEasyId = easy[1]?.id ?? ''
    mediumId = medium.id

    // Written straight to the table: this suite is about reading history, and
    // judging real code through the sandbox would only make it slow and flaky.
    const graded = (problemId: string, verdict: Verdict, createdAt: Date, timeSpentMs = 60_000) => ({
      userId,
      problemId,
      language: 'PYTHON' as const,
      code: 'pass',
      status: 'COMPLETED' as const,
      verdict,
      timeSpentMs,
      createdAt,
    })
    await prisma.submission.createMany({
      data: [
        graded(easyId, 'WRONG_ANSWER', daysAgo(2)),
        { ...graded(easyId, 'ACCEPTED', daysAgo(2), 120_000), hintsUsedAtSubmit: 2 },
        graded(otherEasyId, 'ACCEPTED', daysAgo(1), 30_000),
        graded(mediumId, 'TIME_LIMIT_EXCEEDED', daysAgo(1)),
        // Outside every default range, inside an explicit one.
        graded(mediumId, 'WRONG_ANSWER', daysAgo(200)),
        // Never counted: a run, and a judge failure.
        { ...graded(mediumId, 'ACCEPTED', daysAgo(1)), isRun: true },
        graded(mediumId, 'INTERNAL_ERROR', daysAgo(1)),
      ],
    })
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } })
    await app.close()
  })

  const get = (path: string) => request(app.getHttpServer()).get(`/api${path}`).set('authorization', `Bearer ${token}`)

  describe('GET /analytics/activity', () => {
    it('defaults to the last year and counts distinct problems per UTC day', async () => {
      const body = (await get('/analytics/activity').expect(200)).body as ActivityResponse

      expect(body.to).toBe(day(new Date()))
      expect(body.days).toEqual([
        { date: day(daysAgo(200)), attempted: 1, solved: 0 },
        { date: day(daysAgo(2)), attempted: 1, solved: 1 },
        { date: day(daysAgo(1)), attempted: 2, solved: 1 },
      ])
    })

    it('honours an explicit range', async () => {
      const from = day(daysAgo(1))
      const body = (await get(`/analytics/activity?from=${from}&to=${from}`).expect(200)).body as ActivityResponse

      expect(body).toEqual({ from, to: from, days: [{ date: from, attempted: 2, solved: 1 }] })
    })

    it.each([
      ['a span over a year and a day', `from=2020-01-01&to=${day(new Date())}`],
      ['a backwards range', `from=${day(daysAgo(1))}&to=${day(daysAgo(5))}`],
      ['a malformed date', 'from=last-tuesday'],
    ])('refuses %s with INVALID_RANGE', async (_name, query) => {
      const body = (await get(`/analytics/activity?${query}`).expect(400)).body as ErrorEnvelope
      expect(body.error.code).toBe('INVALID_RANGE')
    })
  })

  describe('GET /analytics/trends', () => {
    it('returns every week of the default twelve, with accuracy over graded submissions', async () => {
      const body = (await get('/analytics/trends').expect(200)).body as TrendsResponse

      expect(body.weeks.length).toBeGreaterThanOrEqual(12)
      expect(body.weeks.length).toBeLessThanOrEqual(13)
      const totals = body.weeks.reduce(
        (sum, week) => ({ submissions: sum.submissions + week.submissions, accepted: sum.accepted + week.accepted }),
        { submissions: 0, accepted: 0 },
      )
      // Four graded submissions in range: the run and the judge failure are not evidence.
      expect(totals).toEqual({ submissions: 4, accepted: 2 })
      expect(body.weeks.filter((week) => week.submissions === 0).every((week) => week.accuracy === null)).toBe(true)
    })

    it('refuses an oversized range', async () => {
      await get('/analytics/trends?from=2000-01-01').expect(400)
    })
  })

  describe('GET /analytics/topics', () => {
    it('splits distinct problems by difficulty, attempted beside solved', async () => {
      const body = (await get('/analytics/topics').expect(200)).body as TopicAnalytics

      expect(body.difficulty).toEqual({
        easy: { attempted: 2, solved: 2 },
        medium: { attempted: 1, solved: 0 },
        hard: { attempted: 0, solved: 0 },
      })
      expect(Array.isArray(body.topics)).toBe(true)
      expect(Array.isArray(body.patterns)).toBe(true)
    })
  })

  describe('GET /analytics/overview', () => {
    it('reports first-try accuracy and hints from the same graded history', async () => {
      const body = (await get('/analytics/overview').expect(200)).body as AnalyticsOverview

      // Three problems attempted. Only one was right on its first graded
      // submission: the easy one fixed later does not count, and the medium
      // one's first attempt is the wrong answer from 200 days ago.
      expect(body.firstTryAccuracy).toBeCloseTo(1 / 3)
      expect(body.hintsUsed).toBe(2)
    })
  })

  it('refuses anonymous reads', async () => {
    for (const path of ['activity', 'topics', 'trends']) {
      await request(app.getHttpServer()).get(`/api/analytics/${path}`).expect(401)
    }
  })
})
