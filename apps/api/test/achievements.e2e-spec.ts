import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { prisma, type Language, type Verdict } from '@guruji/database'
import type { Badge, TrophyCase } from '@guruji/types'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { configureApp } from '../src/app-setup'

/**
 * Achievements against the real database. History is written directly — as
 * the analytics suite does — because this file is about how badges read it,
 * not about judging code.
 */
describe('achievements (e2e)', () => {
  let app: INestApplication
  const emails: string[] = []

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = configureApp(moduleRef.createNestApplication())
    await app.init()
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } })
    await app.close()
  })

  async function signUp(): Promise<{ token: string; userId: string }> {
    const email = `badges-${randomUUID()}@example.com`
    emails.push(email)
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'a-long-enough-password', displayName: 'Badge Tester' })
      .expect(201)
    const { id } = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } })
    return { token: response.body.accessToken as string, userId: id }
  }

  const get = (token: string) =>
    request(app.getHttpServer()).get('/api/achievements').set('authorization', `Bearer ${token}`)
  const seen = (token: string, body: object) =>
    request(app.getHttpServer()).post('/api/achievements/seen').set('authorization', `Bearer ${token}`).send(body)
  const badge = (trophyCase: TrophyCase, slug: string): Badge => {
    const found = trophyCase.badges.find((entry) => entry.slug === slug)
    if (found === undefined) throw new Error(`no badge ${slug}`)
    return found
  }

  async function graded(userId: string, problemId: string, verdict: Verdict, minute: number, language: Language = 'PYTHON') {
    await prisma.submission.create({
      data: {
        userId,
        problemId,
        language,
        code: 'pass',
        status: 'COMPLETED',
        verdict,
        createdAt: new Date(Date.now() - 60 * 60_000 + minute * 60_000),
      },
    })
  }

  it('shows a fresh learner every badge, locked, with nothing to celebrate', async () => {
    const { token } = await signUp()
    const trophyCase = (await get(token).expect(200)).body as TrophyCase

    expect(trophyCase.badges).toHaveLength(12)
    expect(trophyCase.badges.every((entry) => entry.tier === null && entry.value === 0)).toBe(true)
    expect(badge(trophyCase, 'sharp-first-try').next).toEqual({ tier: 'BRONZE', threshold: 1 })
    expect(trophyCase.new).toEqual([])
  })

  describe('a learner with some history', () => {
    let token: string
    let userId: string

    beforeAll(async () => {
      ;({ token, userId } = await signUp())
      const easy = await prisma.problem.findMany({ where: { difficulty: 'EASY' }, select: { id: true }, take: 3 })
      const hard = await prisma.problem.findFirstOrThrow({ where: { difficulty: 'HARD' }, select: { id: true } })
      const [a, b, c] = easy.map((problem) => problem.id)

      // a, hard: right first time, in two languages. b: a comeback after two misses.
      await graded(userId, a ?? '', 'ACCEPTED', 1, 'PYTHON')
      await graded(userId, hard.id, 'ACCEPTED', 2, 'CPP')
      await graded(userId, b ?? '', 'WRONG_ANSWER', 3)
      await graded(userId, b ?? '', 'TIME_LIMIT_EXCEEDED', 4)
      await graded(userId, b ?? '', 'ACCEPTED', 5)
      // c: attempted only; a sample run and a judge failure never count.
      await graded(userId, c ?? '', 'WRONG_ANSWER', 6)
      await prisma.submission.create({
        data: { userId, problemId: c ?? '', language: 'PYTHON', code: 'x', status: 'COMPLETED', verdict: 'ACCEPTED', isRun: true },
      })
      await graded(userId, c ?? '', 'INTERNAL_ERROR', 7)

      await prisma.mistake.create({
        data: { userId, problemId: b ?? '', category: 'LOGIC', whatWentWrong: 'Wrong loop bound.', correctIdea: 'Stop at n - 1.' },
      })
    })

    it('reads each badge from the history, and never from runs or judge failures', async () => {
      const trophyCase = (await get(token).expect(200)).body as TrophyCase

      expect(badge(trophyCase, 'sharp-first-try')).toMatchObject({ value: 2, tier: 'BRONZE', next: { tier: 'SILVER', threshold: 5 } })
      expect(badge(trophyCase, 'hard-mode')).toMatchObject({ value: 1, tier: 'BRONZE' })
      expect(badge(trophyCase, 'comeback')).toMatchObject({ value: 1, tier: 'BRONZE' })
      expect(badge(trophyCase, 'polyglot')).toMatchObject({ value: 2, tier: 'BRONZE' })
      expect(badge(trophyCase, 'honest-journal')).toMatchObject({ value: 1, tier: 'BRONZE' })
      expect(badge(trophyCase, 'unaided')).toMatchObject({ value: 3, tier: 'BRONZE' })
      expect(badge(trophyCase, 'under-pressure').tier).toBeNull()
    })

    it('records each crossed tier once and celebrates it until seen', async () => {
      const first = (await get(token).expect(200)).body as TrophyCase
      const again = (await get(token).expect(200)).body as TrophyCase

      expect(again.new).toEqual(first.new)
      expect(first.new.map((unlock) => unlock.badge)).toEqual(
        expect.arrayContaining(['sharp-first-try', 'hard-mode', 'comeback', 'polyglot', 'honest-journal', 'unaided']),
      )
      const rows = await prisma.userAchievement.count({ where: { userId } })
      expect(rows).toBe(first.badges.reduce((total, entry) => total + entry.tiers.filter((tier) => tier.unlockedAt !== null).length, 0))

      await seen(token, { unlocks: first.new }).expect(204)
      const after = (await get(token).expect(200)).body as TrophyCase
      expect(after.new).toEqual([])
      expect(badge(after, 'sharp-first-try').tiers[0]?.unlockedAt).toBe(badge(first, 'sharp-first-try').tiers[0]?.unlockedAt)
    })

    it('refuses a malformed acknowledgement and shrugs off an unknown badge', async () => {
      await seen(token, { unlocks: 'all' }).expect(400)
      await seen(token, { unlocks: [{ badge: 'no-such-badge', tier: 'GOLD' }] }).expect(204)
    })
  })

  it('records a tier once when two requests evaluate at the same moment', async () => {
    const { token, userId } = await signUp()
    const problem = await prisma.problem.findFirstOrThrow({ where: { difficulty: 'EASY' }, select: { id: true } })
    await graded(userId, problem.id, 'ACCEPTED', 1)

    await Promise.all([get(token).expect(200), get(token).expect(200)])

    expect(await prisma.userAchievement.count({ where: { userId, badge: 'sharp-first-try' } })).toBe(1)
  })

  it('refuses an anonymous read', async () => {
    await request(app.getHttpServer()).get('/api/achievements').expect(401)
  })
})
