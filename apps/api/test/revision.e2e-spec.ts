import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { prisma } from '@guruji/database'
import {
  RUNNER_SECRET_HEADER,
  type DueQueue,
  type SubmissionAccepted,
  type UpcomingDay,
} from '@guruji/types'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { configureApp } from '../src/app-setup'
import { ProgressService } from '../src/mastery/progress.service'
import { DEFAULT_DAILY_CAP, QueueService } from '../src/revision/queue.service'
import { RevisionService } from '../src/revision/revision.service'

const PASSWORD = 'a-long-enough-password'
const SLUG = 'pair-sums-to-target'

/**
 * The scheduler is pure and unit-tested. What is checked here is everything it
 * touches: that a solve schedules, that the two write paths commit together,
 * and that the queue is bounded rather than honest-but-unusable.
 */
describe('revision (e2e)', () => {
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

    email = `revision-${randomUUID()}@example.com`
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: PASSWORD, displayName: 'Revision Tester' })
      .expect(201)
    token = response.body.accessToken as string

    userId = (await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } })).id

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

  function item() {
    return prisma.revisionItem.findUnique({
      where: { userId_problemId: { userId, problemId } },
    })
  }

  /* ---------------------------------------------------------------------- */

  it('schedules nothing for a run or for our own failure', async () => {
    await judged('ACCEPTED', true)
    expect(await item()).toBeNull()

    await judged('INTERNAL_ERROR')
    expect(await item()).toBeNull()
  })

  it('schedules nothing for a problem that has never been solved', async () => {
    await judged('WRONG_ANSWER')

    // Getting something wrong the first time is Phase 5's business. There is
    // nothing to bring back yet.
    expect(await item()).toBeNull()
  })

  it('schedules a first solve for tomorrow', async () => {
    await judged('ACCEPTED')

    const row = await item()
    expect(row?.intervalDays).toBe(1)
    expect(row?.state).toBe('LEARNING')
    expect(row?.ease).toBe(2.5)

    // Day 1, not day 0 — re-solving within the hour proves only that it is
    // still in working memory.
    const hours = ((row?.dueAt.getTime() ?? 0) - Date.now()) / 3_600_000
    expect(hours).toBeGreaterThan(20)
    expect(hours).toBeLessThan(28)
  })

  it('shortens the interval when an ordinary attempt later fails', async () => {
    const before = await item()

    await judged('WRONG_ANSWER')

    const after = await item()
    // The gap has just been demonstrated. Waiting for the scheduled date to act
    // on information already in hand is the system being pedantic.
    expect(after?.ease).toBeLessThan(before?.ease ?? 0)
    expect(after?.repetitions).toBe((before?.repetitions ?? 0) + 1)
  })

  it('records a review, reschedules it, and feeds retention', async () => {
    const row = await item()
    const progressBefore = await prisma.userTopicProgress.findUnique({
      where: { userId_topicId: { userId, topicId } },
    })

    const response = await request(app.getHttpServer())
      .post(`/api/revision/${row?.id ?? ''}/complete`)
      .set('authorization', `Bearer ${token}`)
      .send({ outcome: 'SOLVED_WITH_EFFORT' })
      .expect(201)

    expect(response.body.state).toBeTruthy()

    const reviews = await prisma.revisionReview.findMany({
      where: { revisionItemId: row?.id ?? '' },
    })
    // Kept as history, not folded into the item: `retention` is a rate over
    // attempts, and a counter that only moves forward cannot be recomputed.
    expect(reviews).toHaveLength(1)

    const progressAfter = await prisma.userTopicProgress.findUnique({
      where: { userId_topicId: { userId, topicId } },
    })
    expect(progressAfter?.revisionAttempts).toBe((progressBefore?.revisionAttempts ?? 0) + 1)
    expect(progressAfter?.revisionSuccesses).toBe((progressBefore?.revisionSuccesses ?? 0) + 1)
  })

  it('counts a struggle as an attempt but not a success', async () => {
    const row = await item()
    const before = await prisma.userTopicProgress.findUnique({
      where: { userId_topicId: { userId, topicId } },
    })

    await request(app.getHttpServer())
      .post(`/api/revision/${row?.id ?? ''}/complete`)
      .set('authorization', `Bearer ${token}`)
      .send({ outcome: 'STRUGGLED' })
      .expect(201)

    const after = await prisma.userTopicProgress.findUnique({
      where: { userId_topicId: { userId, topicId } },
    })

    // The answer arrived; the recall did not.
    expect(after?.revisionAttempts).toBe((before?.revisionAttempts ?? 0) + 1)
    expect(after?.revisionSuccesses).toBe(before?.revisionSuccesses ?? 0)
  })

  it('refuses to complete another person’s revision item', async () => {
    const other = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `revision-${randomUUID()}@example.com`,
        password: PASSWORD,
        displayName: 'Other',
      })
      .expect(201)

    const row = await item()
    await request(app.getHttpServer())
      .post(`/api/revision/${row?.id ?? ''}/complete`)
      .set('authorization', `Bearer ${other.body.accessToken as string}`)
      .send({ outcome: 'SOLVED_EASILY' })
      // 404, not 403: confirming the id exists is itself a disclosure.
      .expect(404)
  })

  it('refuses an outcome outside the closed set', async () => {
    const row = await item()
    await request(app.getHttpServer())
      .post(`/api/revision/${row?.id ?? ''}/complete`)
      .set('authorization', `Bearer ${token}`)
      .send({ outcome: 'NAILED_IT' })
      .expect(400)
  })

  describe('the daily queue', () => {
    it('caps the queue and carries the rest forward rather than dropping it', async () => {
      // A backlog: more due than anyone can reasonably do in a day.
      const problems = await prisma.problem.findMany({
        where: { reviewStatus: 'PUBLISHED' },
        select: { id: true },
        take: DEFAULT_DAILY_CAP + 5,
      })

      const yesterday = new Date(Date.now() - 86_400_000)
      for (const problem of problems) {
        await prisma.revisionItem.upsert({
          where: { userId_problemId: { userId, problemId: problem.id } },
          create: { userId, problemId: problem.id, dueAt: yesterday },
          update: { dueAt: yesterday },
        })
      }

      const response = await request(app.getHttpServer())
        .get('/api/revision/due')
        .set('authorization', `Bearer ${token}`)
        .expect(200)

      const queue = response.body as DueQueue

      /*
       * The single most important behaviour in the module. An uncapped queue
       * after a week away shows forty problems — about thirteen hours — and the
       * predictable outcome is that the user does none of them and stops
       * opening the app.
       */
      expect(queue.items.length).toBeLessThanOrEqual(queue.cap)
      expect(queue.totalDue).toBeGreaterThan(queue.cap)
      // Shown, not hidden. "24 to catch up on, 10 today" is a plan.
      expect(queue.carriedForward).toBe(queue.totalDue - queue.items.length)
    })

    it('puts lapsed items first', async () => {
      const rows = await prisma.revisionItem.findMany({ where: { userId }, take: 3 })
      const lapsedId = rows[rows.length - 1]?.id ?? ''
      await prisma.revisionItem.update({ where: { id: lapsedId }, data: { state: 'LAPSED' } })

      const response = await request(app.getHttpServer())
        .get('/api/revision/due')
        .set('authorization', `Bearer ${token}`)
        .expect(200)

      // Knowledge you had and lost is the cheapest thing to recover, so it is
      // the highest-return practice available.
      expect((response.body as DueQueue).items[0]?.id).toBe(lapsedId)
    })

    it('re-spaces a backlog forward instead of dumping it', async () => {
      const queueService = app.get(QueueService)
      const moved = await queueService.respaceBacklog(userId)

      expect(moved).toBeGreaterThan(0)

      const response = await request(app.getHttpServer())
        .get('/api/revision/due')
        .set('authorization', `Bearer ${token}`)
        .expect(200)

      const queue = response.body as DueQueue
      // Everything beyond today's cap now has a date of its own, so the user
      // sees a day's work rather than a wall.
      expect(queue.totalDue).toBeLessThanOrEqual(queue.cap)
      // And nothing was thrown away.
      expect(await prisma.revisionItem.count({ where: { userId } })).toBeGreaterThan(queue.cap)
    })

    it('rolls mastery back when scheduling fails, and the other way round', async () => {
      const revision = app.get(RevisionService)
      const progress = app.get(ProgressService)

      /*
       * Its own user.
       *
       * The queue tests above scheduled every published problem for the shared
       * one, so there is no unscheduled problem left to prove anything with —
       * and a rollback assertion against counters other tests have been moving
       * proves nothing anyway.
       */
      const isolatedEmail = `revision-atomic-${randomUUID()}@example.com`
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: isolatedEmail, password: PASSWORD, displayName: 'Atomic' })
        .expect(201)
      const isolatedUserId = (
        await prisma.user.findUniqueOrThrow({
          where: { email: isolatedEmail },
          select: { id: true },
        })
      ).id

      const fresh = await prisma.problem.findFirstOrThrow({
        where: { reviewStatus: 'PUBLISHED' },
        select: { id: true, topics: { select: { topicId: true } } },
      })
      const freshTopicId = fresh.topics[0]?.topicId ?? ''

      const before = await prisma.userTopicProgress.findUnique({
        where: { userId_topicId: { userId: isolatedUserId, topicId: freshTopicId } },
      })

      /*
       * Both writes, then a deliberate failure in the same transaction.
       *
       * Mastery moving while revision does not is a silent corruption of the
       * learning model — the score says you know it and nothing is ever
       * scheduled to check whether you still do. This asserts they are one
       * unit, not two writes that happen to run next to each other.
       */
      await expect(
        prisma.$transaction(async (tx) => {
          await progress.apply(tx, {
            submissionId: randomUUID(),
            userId: isolatedUserId,
            problemId: fresh.id,
            verdict: 'ACCEPTED',
            isRun: false,
            hintsUsedAtSubmit: 0,
            timeSpentMs: 60_000,
          })
          await revision.onSubmission(tx, {
            submissionId: randomUUID(),
            userId: isolatedUserId,
            problemId: fresh.id,
            verdict: 'ACCEPTED',
            isRun: false,
          })
          throw new Error('forced rollback')
        }),
      ).rejects.toThrow('forced rollback')

      const after = await prisma.userTopicProgress.findUnique({
        where: { userId_topicId: { userId: isolatedUserId, topicId: freshTopicId } },
      })

      expect(after?.solved ?? 0).toBe(before?.solved ?? 0)
      expect(
        await prisma.revisionItem.findUnique({
          where: { userId_problemId: { userId: isolatedUserId, problemId: fresh.id } },
        }),
      ).toBeNull()

      await prisma.user.deleteMany({ where: { email: isolatedEmail } })
    })

    it('shows the week ahead, already capped', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/revision/upcoming?days=7')
        .set('authorization', `Bearer ${token}`)
        .expect(200)

      const days = response.body as UpcomingDay[]
      expect(days).toHaveLength(7)
      // The calendar shows what will actually be offered, not a raw count the
      // queue will then quietly truncate.
      expect(days.every((day) => day.capped <= DEFAULT_DAILY_CAP)).toBe(true)
      expect(days.every((day) => day.capped <= day.due)).toBe(true)
    })
  })
})
