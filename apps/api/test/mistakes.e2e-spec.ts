import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { prisma } from '@guruji/database'
import type { AnalyticsOverview, Mistake, MistakePatternsResponse } from '@guruji/types'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { configureApp } from '../src/app-setup'

const PASSWORD = 'a-long-enough-password'
const SLUG = 'pair-sums-to-target'

describe('mistakes and analytics (e2e)', () => {
  let app: INestApplication
  let token: string
  let otherToken: string
  let email: string
  let otherEmail: string
  let problemId: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = configureApp(moduleRef.createNestApplication())
    await app.init()

    email = `mistake-${randomUUID()}@example.com`
    otherEmail = `mistake-${randomUUID()}@example.com`
    token = await register(email)
    otherToken = await register(otherEmail)

    const problem = await prisma.problem.findFirstOrThrow({
      where: { slug: SLUG },
      select: { id: true },
    })
    problemId = problem.id
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [email, otherEmail] } } })
    await app.close()
  })

  async function register(address: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: address, password: PASSWORD, displayName: 'Mistake Tester' })
      .expect(201)
    return response.body.accessToken as string
  }

  function log(bearer: string, body: Record<string, unknown>): request.Test {
    return request(app.getHttpServer())
      .post('/api/mistakes')
      .set('authorization', `Bearer ${bearer}`)
      .send({ problemId, category: 'OFF_BY_ONE', whatWentWrong: 'Loop ran one too far.', ...body })
  }

  /* ---------------------------------------------------------------------- */

  it('stores what went wrong and gives it back with the problem attached', async () => {
    const response = await log(token, { correctIdea: 'Stop at n - 1.' }).expect(201)
    const mistake = response.body as Mistake

    expect(mistake.category).toBe('OFF_BY_ONE')
    expect(mistake.correctIdea).toBe('Stop at n - 1.')
    // The journal is read as a list of problems, so the entry carries enough to
    // render one without a second request per row.
    expect(mistake.problemSlug).toBe(SLUG)
    expect(mistake.problemTitle).toBeTruthy()
    // Phase 8's column, empty until there is a mentor to fill it.
    expect(mistake.aiAnalysis).toBeNull()
  })

  it('refuses a category outside the closed set', async () => {
    // Free text here would make every entry a category of one, and the
    // aggregation below would have nothing to aggregate.
    await log(token, { category: 'BRAIN_FOG' }).expect(400)
  })

  it('refuses to attach an entry to someone else’s submission', async () => {
    const accepted = await request(app.getHttpServer())
      .post('/api/submissions')
      .set('authorization', `Bearer ${otherToken}`)
      .send({ problemId, language: 'PYTHON', code: 'print(1)', isRun: true })
      .expect(202)

    // Checked against *this* user, not merely that the id exists — otherwise
    // the list endpoint would happily join a stranger's submission back out.
    await log(token, { submissionId: accepted.body.id }).expect(404)
  })

  it('refuses an anonymous entry', async () => {
    await request(app.getHttpServer())
      .post('/api/mistakes')
      .send({ problemId, category: 'LOGIC', whatWentWrong: 'x' })
      .expect(401)
  })

  it('lists only the caller’s own entries, newest first', async () => {
    await log(otherToken, { category: 'LOGIC', whatWentWrong: 'Not yours.' }).expect(201)
    await log(token, { category: 'LOGIC', whatWentWrong: 'Wrong invariant.' }).expect(201)

    const response = await request(app.getHttpServer())
      .get('/api/mistakes?limit=50')
      .set('authorization', `Bearer ${token}`)
      .expect(200)

    const body = response.body as { items: Mistake[] }
    expect(body.items.length).toBeGreaterThan(0)
    expect(body.items.every((item) => item.whatWentWrong !== 'Not yours.')).toBe(true)

    const times = body.items.map((item) => Date.parse(item.createdAt))
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })

  it('filters by category', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/mistakes?category=OFF_BY_ONE')
      .set('authorization', `Bearer ${token}`)
      .expect(200)

    const body = response.body as { items: Mistake[] }
    expect(body.items.length).toBeGreaterThan(0)
    expect(body.items.every((item) => item.category === 'OFF_BY_ONE')).toBe(true)
  })

  it('aggregates into something worth acting on', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/mistakes/patterns')
      .set('authorization', `Bearer ${token}`)
      .expect(200)

    const body = response.body as MistakePatternsResponse

    // Most frequent first: the top of this list is what to go and practise.
    const counts = body.patterns.map((pattern) => pattern.count)
    expect(counts).toEqual([...counts].sort((a, b) => b - a))

    // A count alone is a scoreboard. The topics are what turn it into a
    // diagnosis — "off by one, and it keeps happening in arrays".
    expect(body.patterns[0]?.topics.length).toBeGreaterThan(0)
    expect(body.total).toBeGreaterThan(0)
  })

  describe('analytics overview', () => {
    it('answers with a whole dashboard in one request', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/analytics/overview')
        .set('authorization', `Bearer ${token}`)
        .expect(200)

      const body = response.body as AnalyticsOverview

      expect(body.solvedByDifficulty).toEqual({ easy: 0, medium: 0, hard: 0 })
      expect(body.streak.current).toBe(0)
      expect(body.streak.lastActiveDate).toBeNull()
      expect(Array.isArray(body.topics)).toBe(true)
      expect(Array.isArray(body.activity)).toBe(true)
    })

    it('refuses an anonymous read', async () => {
      await request(app.getHttpServer()).get('/api/analytics/overview').expect(401)
    })
  })
})
