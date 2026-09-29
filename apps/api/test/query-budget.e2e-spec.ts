import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { getPrisma, prisma, type Language, type MistakeCategory, type Prisma, type RevisionOutcome, type Verdict } from '@guruji/database'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { configureApp } from '../src/app-setup'

/**
 * How many database round trips each read endpoint makes, for a learner with
 * a real amount of history.
 *
 * The number that matters is the count, not the milliseconds: a query per
 * topic or per problem is invisible with ten rows and a timeout with ten
 * thousand, and the only way to notice it early is to count. Every Prisma
 * operation the app makes goes through the counting extension installed
 * below, before the app is built.
 */
let operations = 0
let sqlMs = 0
let trace: { op: string; ms: number }[] = []
const counted = getPrisma().$extends({
  query: {
    async $allOperations({ model, operation, args, query }) {
      operations += 1
      const started = performance.now()
      try {
        return await query(args)
      } finally {
        const ms = performance.now() - started
        sqlMs += ms
        trace.push({ op: `${model ?? ''}.${operation}`, ms: Math.round(ms) })
      }
    },
  },
})
globalThis.__guruji_prisma__ = counted as unknown as typeof globalThis.__guruji_prisma__

const DAY = 86_400_000

describe('query budget (e2e)', () => {
  let app: INestApplication
  let token: string
  let userId: string
  let email: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = configureApp(moduleRef.createNestApplication())
    await app.init()

    email = `budget-${randomUUID()}@example.com`
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'a-long-enough-password', displayName: 'Budget Tester' })
      .expect(201)
    token = response.body.accessToken as string
    ;({ id: userId } = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } }))
    await seedHistory(userId)
  }, 300_000)

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } })
    await app.close()
  })

  /**
   * The most database operations each route may make. Set to what the route
   * does today: a new query per topic, per problem or per item pushes a route
   * over its number, and the change has to say why it needs the extra trip.
   */
  const BUDGET: Record<string, number> = {
    '/api/auth/me': 1,
    '/api/analytics/overview': 5,
    '/api/analytics/activity': 1,
    '/api/analytics/topics': 7,
    '/api/analytics/trends': 1,
    '/api/recommendations': 1,
    '/api/recommendations/next': 9,
    '/api/revision/due': 3,
    '/api/revision/upcoming': 2,
    '/api/mistakes': 1,
    '/api/mistakes/patterns': 1,
    '/api/achievements': 7,
    '/api/submissions': 1,
    '/api/contests/latest': 2,
    // Content is served from cache once warm.
    '/api/roadmap': 0,
    '/api/problems': 0,
    '/api/topics': 0,
    '/api/patterns': 0,
  }

  it('keeps every read endpoint within its query budget', async () => {
    const rows: { route: string; status: number; operations: number; sqlMs: number; wallMs: number; trace: typeof trace }[] = []
    for (const route of Object.keys(BUDGET)) {
      // Once to warm caches and compile queries, once to measure.
      await request(app.getHttpServer()).get(route).set('authorization', `Bearer ${token}`)
      // Let anything the warm-up left running finish before counting starts.
      await new Promise((resolve) => setTimeout(resolve, 100))
      operations = 0
      sqlMs = 0
      trace = []
      const started = performance.now()
      const response = await request(app.getHttpServer()).get(route).set('authorization', `Bearer ${token}`)
      rows.push({
        route,
        status: response.status,
        operations,
        sqlMs: Math.round(sqlMs),
        wallMs: Math.round(performance.now() - started),
        trace,
      })
    }
    if (process.env.QUERY_BUDGET_OUT) writeFileSync(process.env.QUERY_BUDGET_OUT, JSON.stringify(rows, null, 2))
    expect(rows.filter((row) => row.status >= 300).map((row) => `${row.route} ${row.status}`)).toEqual([])
    expect(
      rows.filter((row) => row.operations > (BUDGET[row.route] ?? 0)).map((row) => `${row.route}: ${row.operations} > ${BUDGET[row.route]}`),
    ).toEqual([])
  }, 300_000)
})

/**
 * Roughly a year of steady practice: every problem attempted, most solved,
 * some after misses; revision items for the solved ones; mistakes; progress
 * rows for every topic and pattern; a handful of finished contests.
 */
async function seedHistory(userId: string) {
  const problems = await prisma.problem.findMany({ select: { id: true } })
  const topics = await prisma.topic.findMany({ select: { id: true } })
  const patterns = await prisma.pattern.findMany({ select: { id: true } })
  const now = Date.now()
  const languages: Language[] = ['PYTHON', 'CPP', 'JAVASCRIPT', 'C']
  const verdicts: Verdict[] = ['WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED', 'RUNTIME_ERROR', 'COMPILE_ERROR']

  const submissions: Prisma.SubmissionCreateManyInput[] = []
  // Forty rounds over the problem set, spread across 300 days: about a
  // thousand graded submissions, a heavy year.
  for (let round = 0; round < 40; round += 1) {
    problems.forEach((problem, index) => {
      const misses = (index + round) % 3
      for (let attempt = 0; attempt <= misses; attempt += 1) {
        const accepted = attempt === misses && (index + round) % 5 !== 0
        submissions.push({
          id: randomUUID(),
          userId,
          problemId: problem.id,
          language: languages[(index + attempt) % languages.length] as Language,
          code: 'pass',
          status: 'COMPLETED',
          verdict: accepted ? 'ACCEPTED' : (verdicts[(index + attempt) % verdicts.length] as Verdict),
          hintsUsedAtSubmit: (index + attempt) % 4 === 0 ? 1 : 0,
          timeSpentMs: 600_000,
          createdAt: new Date(now - ((round * problems.length + index) % 300) * DAY - attempt * 60_000),
        })
      }
    })
  }
  await prisma.submission.createMany({ data: submissions })

  await prisma.userTopicProgress.createMany({
    data: topics.map((topic, index) => ({ userId, topicId: topic.id, attempts: 10 + index, solved: 5 + index, masteryScore: (index * 7) % 100 })),
  })
  await prisma.userPatternProgress.createMany({
    data: patterns.map((pattern, index) => ({ userId, patternId: pattern.id, attempts: 4 + index, solved: 2 + index, masteryScore: (index * 11) % 100 })),
  })

  const items = problems.slice(0, Math.floor(problems.length * 0.8)).map((problem, index) => ({
    id: randomUUID(),
    userId,
    problemId: problem.id,
    dueAt: new Date(now + ((index % 30) - 10) * DAY),
    state: 'REVIEWING' as const,
  }))
  await prisma.revisionItem.createMany({ data: items })
  await prisma.revisionReview.createMany({
    data: items.flatMap((item, index) =>
      Array.from({ length: (index % 3) + 1 }, (_, review) => ({
        revisionItemId: item.id,
        outcome: (['SOLVED_EASILY', 'SOLVED_WITH_EFFORT', 'STRUGGLED', 'FAILED'] as const)[(index + review) % 4] as RevisionOutcome,
        intervalDays: review + 1,
      })),
    ),
  })

  await prisma.mistake.createMany({
    data: problems.slice(0, 40).map((problem, index) => ({
      userId,
      problemId: problem.id,
      category: (['LOGIC', 'EDGE_CASE', 'COMPLEXITY', 'IMPLEMENTATION'] as const)[index % 4] as MistakeCategory,
      whatWentWrong: 'Off by one at the boundary.',
      correctIdea: index % 2 === 0 ? 'Loop to n - 1.' : null,
    })),
  })

  for (let contest = 0; contest < 5; contest += 1) {
    const startedAt = new Date(now - (contest + 1) * 20 * DAY)
    const picked = problems.slice(contest * 3, contest * 3 + 3)
    const created = await prisma.contest.create({
      data: {
        userId,
        durationMinutes: 60,
        startedAt,
        deadlineAt: new Date(startedAt.getTime() + 60 * 60_000),
        maxScore: 600,
        status: 'FINISHED',
        finishedAt: new Date(startedAt.getTime() + 60 * 60_000),
        finishReason: 'TIME_UP',
        problems: {
          create: picked.map((problem, position) => ({ problemId: problem.id, position, points: 100 * (position + 1), wasSolvedBefore: false })),
        },
      },
    })
    for (const problem of picked) {
      const submission = await prisma.submission.create({
        data: { userId, problemId: problem.id, language: 'PYTHON', code: 'pass', status: 'COMPLETED', verdict: 'ACCEPTED', createdAt: new Date(startedAt.getTime() + 10 * 60_000) },
      })
      await prisma.contestSubmission.create({ data: { contestId: created.id, problemId: problem.id, submissionId: submission.id } })
    }
  }
}
