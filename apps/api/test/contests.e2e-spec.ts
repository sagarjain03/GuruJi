import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { prisma, type Verdict } from '@guruji/database'
import type { AnalyticsOverview, ContestReport, ContestView, ErrorEnvelope } from '@guruji/types'
import request from 'supertest'
import { AI_PROVIDER } from '../src/ai/ai.service'
import { AppModule } from '../src/app.module'
import { configureApp } from '../src/app-setup'

/**
 * Mock contests against the real database.
 *
 * Routes are exercised through HTTP. Where a rule depends on a verdict —
 * scoring, the report — the graded submissions are written directly, as the
 * analytics suite does: this file is about contest rules, and waiting on the
 * sandbox would only make it slow and flaky.
 */
describe('contests (e2e)', () => {
  let app: INestApplication
  const emails: string[] = []

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      // Curated hints never reach a model; anything else fails, so no test needs a live AI.
      .overrideProvider(AI_PROVIDER)
      .useValue({
        complete: async () => {
          throw new Error('provider down')
        },
        completeStructured: async () => {
          throw new Error('provider down')
        },
      })
      .compile()
    app = configureApp(moduleRef.createNestApplication())
    await app.init()
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } })
    await app.close()
  })

  async function signUp(): Promise<{ token: string; userId: string }> {
    const email = `contest-${randomUUID()}@example.com`
    emails.push(email)
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'a-long-enough-password', displayName: 'Contest Tester' })
      .expect(201)
    const { id } = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } })
    return { token: response.body.accessToken as string, userId: id }
  }

  const as = (token: string) => ({
    get: (path: string) => request(app.getHttpServer()).get(`/api${path}`).set('authorization', `Bearer ${token}`),
    post: (path: string, body: object = {}) =>
      request(app.getHttpServer()).post(`/api${path}`).set('authorization', `Bearer ${token}`).send(body),
  })

  /** A graded submission as the judge would leave it, linked into the contest. */
  async function graded(userId: string, contestId: string, problemId: string, verdict: Verdict, createdAt: Date) {
    const submission = await prisma.submission.create({
      data: { userId, problemId, language: 'PYTHON', code: 'pass', status: 'COMPLETED', verdict, createdAt },
      select: { id: true },
    })
    await prisma.contestSubmission.create({ data: { contestId, problemId, submissionId: submission.id } })
    return submission.id
  }

  /* ---------------------------------------------------------------------- */

  describe('one learner, start to report', () => {
    let token: string
    let userId: string
    let contest: ContestView

    beforeAll(async () => {
      ;({ token, userId } = await signUp())
    })

    it('says nothing has happened yet for someone who never started one', async () => {
      await as(token).get('/contests/latest').expect(204)
    })

    it('starts a 60-minute contest of three distinct problems, one per difficulty', async () => {
      contest = (await as(token).post('/contests', { durationMinutes: 60 }).expect(201)).body as ContestView

      expect(contest.status).toBe('ACTIVE')
      expect(contest.hintsAllowed).toBe(false)
      expect(new Date(contest.deadlineAt).getTime() - new Date(contest.startedAt).getTime()).toBe(60 * 60_000)
      expect(contest.problems.map((problem) => problem.position)).toEqual([1, 2, 3])
      expect(contest.problems.map((problem) => problem.difficulty)).toEqual(['EASY', 'MEDIUM', 'HARD'])
      expect(new Set(contest.problems.map((problem) => problem.problemId)).size).toBe(3)
      expect(contest.maxScore).toBe(600)
      expect(contest.problems.every((problem) => problem.state === 'UNSOLVED' && !problem.wasSolvedBefore)).toBe(true)
      expect(contest.serverNow).toBeTruthy()
    })

    it('refuses a second contest while one is running, pointing at the running one', async () => {
      const body = (await as(token).post('/contests', { durationMinutes: 90 }).expect(409)).body as ErrorEnvelope

      expect(body.error.code).toBe('CONTEST_ALREADY_ACTIVE')
      expect(body.error.details).toEqual({ contestId: contest.id })
    })

    it('refuses a duration other than 60 or 90', async () => {
      await as(token).post('/contests', { durationMinutes: 45 }).expect(400)
    })

    it('refuses a field it does not know, rather than silently dropping it', async () => {
      // Mass assignment fails loudly everywhere else in the API; here too.
      await as(token).post('/contests', { durationMinutes: 60, score: 600 }).expect(400)
    })

    it('resumes: latest returns the running contest with the same deadline', async () => {
      const latest = (await as(token).get('/contests/latest').expect(200)).body as ContestView

      expect(latest.id).toBe(contest.id)
      expect(latest.deadlineAt).toBe(contest.deadlineAt)
    })

    it('accepts a submission for a contest problem through the real submit path', async () => {
      const problemId = contest.problems[0]?.problemId ?? ''
      const accepted = (
        await as(token)
          .post(`/contests/${contest.id}/submissions`, { problemId, language: 'PYTHON', code: 'print(1)\n' })
          .expect(202)
      ).body as { id: string }

      const link = await prisma.contestSubmission.findUnique({ where: { submissionId: accepted.id } })
      expect(link).toMatchObject({ contestId: contest.id, problemId })
      const submission = await prisma.submission.findUniqueOrThrow({ where: { id: accepted.id }, select: { isRun: true } })
      expect(submission.isRun).toBe(false)
    })

    it('refuses a problem that is not in the contest', async () => {
      const outsider = await prisma.problem.findFirstOrThrow({
        where: { id: { notIn: contest.problems.map((problem) => problem.problemId) } },
        select: { id: true },
      })
      const body = (
        await as(token)
          .post(`/contests/${contest.id}/submissions`, { problemId: outsider.id, language: 'PYTHON', code: 'x' })
          .expect(422)
      ).body as ErrorEnvelope
      expect(body.error.code).toBe('PROBLEM_NOT_IN_CONTEST')
    })

    it('turns the mentor off for contest problems only', async () => {
      const inContest = contest.problems[0]?.slug ?? ''
      const refused = (await as(token).post('/ai/hint', { problemSlug: inContest, level: 1 }).expect(403)).body as ErrorEnvelope
      expect(refused.error.code).toBe('CONTEST_HINTS_DISABLED')
      await as(token).post('/ai/show-solution', { problemSlug: inContest }).expect(403)

      const outside = await prisma.problem.findFirstOrThrow({
        where: { slug: { notIn: contest.problems.map((problem) => problem.slug) } },
        select: { slug: true },
      })
      // Curated level-1 hint: served without a model.
      await as(token).post('/ai/hint', { problemSlug: outside.slug, level: 1 }).expect(201)
    })

    it('refuses the report while the contest is still running', async () => {
      const body = (await as(token).get(`/contests/${contest.id}/report`).expect(409)).body as ErrorEnvelope
      expect(body.error.code).toBe('CONTEST_NOT_FINISHED')
    })

    it('finishes itself when the deadline passes, and closes submissions', async () => {
      const [easy, medium] = contest.problems
      // Time runs out: the whole contest moves two hours into the past.
      const started = new Date(Date.now() - 2 * 60 * 60_000)
      const minute = (m: number) => new Date(started.getTime() + m * 60_000)
      await prisma.contest.update({ where: { id: contest.id }, data: { startedAt: started, deadlineAt: minute(60) } })
      // The easy one solved at minute 12; the medium one wrong twice with a
      // logged mistake; the hard one never touched; and an ACCEPTED on the
      // medium one after time was up, which must not count.
      await graded(userId, contest.id, easy?.problemId ?? '', 'ACCEPTED', minute(12))
      const wrong = await graded(userId, contest.id, medium?.problemId ?? '', 'WRONG_ANSWER', minute(20))
      await graded(userId, contest.id, medium?.problemId ?? '', 'WRONG_ANSWER', minute(31))
      await graded(userId, contest.id, medium?.problemId ?? '', 'ACCEPTED', minute(65))
      await prisma.mistake.create({
        data: { userId, problemId: medium?.problemId ?? '', submissionId: wrong, category: 'LOGIC', whatWentWrong: 'Wrong end of the heap.' },
      })

      const body = (
        await as(token)
          .post(`/contests/${contest.id}/submissions`, { problemId: easy?.problemId ?? '', language: 'PYTHON', code: 'x' })
          .expect(409)
      ).body as ErrorEnvelope
      expect(body.error.code).toBe('CONTEST_ENDED')

      const finished = (await as(token).get(`/contests/${contest.id}`).expect(200)).body as ContestView
      expect(finished.status).toBe('FINISHED')
      expect(finished.finishReason).toBe('TIME_UP')
      // Finished at the deadline, not whenever someone next looked.
      expect(finished.finishedAt).toBe(minute(60).toISOString())
      expect(finished.problems.map((problem) => problem.state)).toEqual(['SOLVED', 'ATTEMPTED', 'UNSOLVED'])
    })

    it('scores only what was accepted in time, and names a weak area with its evidence', async () => {
      const report = (await as(token).get(`/contests/${contest.id}/report`).expect(200)).body as ContestReport
      expect(report.score).toBe(contest.problems[0]?.points)
      expect(report.problems.map((problem) => problem.solved)).toEqual([true, false, false])
      // Two wrong answers and the late ACCEPTED: attempts, but the late one is not a solve.
      expect(report.problems.map((problem) => problem.attempts).slice(1)).toEqual([3, 0])
      expect(report.problems[0]?.timeToSolveMs).toBe(12 * 60_000)
      expect(report.problems[1]?.mistakeCategories).toEqual(['LOGIC'])
      expect(report.weakArea).not.toBeNull()
      expect(report.weakArea?.reason).toContain('Unsolved:')
      expect(report.slowest).toBeNull()
    })

    it('lets the mentor back on once the contest is over', async () => {
      await as(token).post('/ai/hint', { problemSlug: contest.problems[0]?.slug ?? '', level: 1 }).expect(201)
    })

    it('counts contest submissions like any graded submission', async () => {
      const overview = (await as(token).get('/analytics/overview').expect(200)).body as AnalyticsOverview
      expect(overview.totalSolved).toBeGreaterThanOrEqual(1)
    })

    it('lets a new contest start once the last one is finished', async () => {
      const next = (await as(token).post('/contests', { durationMinutes: 90 }).expect(201)).body as ContestView
      expect(next.id).not.toBe(contest.id)
      await as(token).post(`/contests/${next.id}/finish`).expect(200)
    })
  })

  describe('boundaries', () => {
    it('hides another learner’s contest and a malformed id behind the same 404', async () => {
      const owner = await signUp()
      const stranger = await signUp()
      const contest = (await as(owner.token).post('/contests', { durationMinutes: 60 }).expect(201)).body as ContestView

      await as(stranger.token).get(`/contests/${contest.id}`).expect(404)
      await as(stranger.token).post(`/contests/${contest.id}/finish`).expect(404)
      await as(owner.token).get('/contests/not-a-uuid').expect(404)

      // Finishing is idempotent: the second finish changes nothing.
      const first = (await as(owner.token).post(`/contests/${contest.id}/finish`).expect(200)).body as ContestView
      const second = (await as(owner.token).post(`/contests/${contest.id}/finish`).expect(200)).body as ContestView
      expect(first.finishReason).toBe('EARLY')
      expect(second.finishedAt).toBe(first.finishedAt)

      // The stranger has no contest of their own: start one with hints allowed.
      const open = (
        await as(stranger.token).post('/contests', { durationMinutes: 60, hintsAllowed: true }).expect(201)
      ).body as ContestView
      await as(stranger.token).post('/ai/hint', { problemSlug: open.problems[0]?.slug ?? '', level: 1 }).expect(201)
    })

    it('lets exactly one of two simultaneous starts through', async () => {
      const racer = await signUp()
      const [a, b] = await Promise.all([
        as(racer.token).post('/contests', { durationMinutes: 60 }),
        as(racer.token).post('/contests', { durationMinutes: 60 }),
      ])

      expect([a.status, b.status].sort()).toEqual([201, 409])
      expect(await prisma.contest.count({ where: { userId: racer.userId, status: 'ACTIVE' } })).toBe(1)
    })

  })
})
