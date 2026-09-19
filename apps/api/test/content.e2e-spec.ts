import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { prisma } from '@guruji/database'
import type { Paginated, ProblemDetail, ProblemListItem } from '@guruji/types'
import request from 'supertest'
import type Redis from 'ioredis'
import { AppModule } from '../src/app.module'
import { configureApp } from '../src/app-setup'
import { REDIS } from '../src/redis/redis.module'

describe('content (e2e)', () => {
  let app: INestApplication
  let redis: Redis

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = configureApp(moduleRef.createNestApplication())
    await app.init()
    redis = app.get<Redis>(REDIS)
  })

  beforeEach(async () => {
    // Content responses are cached for up to an hour. A previous run's cache
    // would make these assertions about the database meaningless.
    const keys = await redis.keys('content:*')
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  })

  afterAll(async () => {
    await app.close()
  })

  function get(path: string): request.Test {
    return request(app.getHttpServer()).get(path)
  }

  /* ---------------------------------------------------------------------- */

  it('serves the curriculum as a tree, not a flat list', async () => {
    const response = await get('/api/roadmap').expect(200)
    const sections = response.body.sections as { section: string; nodes: unknown[] }[]

    expect(sections.length).toBeGreaterThan(0)
    // FOUNDATION is the entry point and must come first, whatever else changes.
    expect(sections[0]?.section).toBe('FOUNDATION')

    const nodeCount = countNodes(response.body.sections)
    expect(nodeCount).toBe(await prisma.roadmapNode.count())
  })

  it('never returns a hidden test case, on any content route', async () => {
    const hidden = await prisma.testCase.findMany({
      where: { isHidden: true },
      select: { id: true, input: true, expectedOutput: true, problem: { select: { slug: true } } },
    })
    expect(hidden.length).toBeGreaterThan(0)

    const slugs = [...new Set(hidden.map((t) => t.problem.slug))]
    const bodies: string[] = []

    bodies.push(JSON.stringify((await get('/api/problems?limit=50').expect(200)).body))
    bodies.push(JSON.stringify((await get('/api/topics').expect(200)).body))
    for (const slug of slugs) {
      bodies.push(JSON.stringify((await get(`/api/problems/${slug}`).expect(200)).body))
      bodies.push(JSON.stringify((await get(`/api/topics/arrays`).expect(200)).body))
    }

    const haystack = bodies.join('\n')
    for (const testCase of hidden) {
      expect(haystack, `hidden case ${testCase.id} leaked`).not.toContain(testCase.id)
    }

    // The id check above proves no hidden row was serialised. This proves the
    // positive side: what comes back is exactly the sample set, in order — so a
    // leak cannot hide behind a response that happens to omit ids.
    for (const slug of slugs) {
      const body = (await get(`/api/problems/${slug}`).expect(200)).body as ProblemDetail
      const samples = await prisma.testCase.findMany({
        where: { problem: { slug }, isSample: true },
        orderBy: { displayOrder: 'asc' },
        select: { id: true },
      })
      expect(body.sampleTestCases.map((t) => t.id)).toEqual(samples.map((t) => t.id))
    }
  })

  it('returns only the samples a problem declares', async () => {
    const problem = await prisma.problem.findFirstOrThrow({
      where: { reviewStatus: 'PUBLISHED' },
      select: { slug: true, _count: { select: { testCases: { where: { isSample: true } } } } },
    })

    const body = (await get(`/api/problems/${problem.slug}`).expect(200)).body as ProblemDetail
    expect(body.sampleTestCases).toHaveLength(problem._count.testCases)
  })

  /* ---------------------------------------------------------------------- */

  it('filters by difficulty, topic, pattern and title, alone and combined', async () => {
    const hard = await list('/api/problems?difficulty=HARD&limit=50')
    expect(hard.items.length).toBeGreaterThan(0)
    expect(hard.items.every((p) => p.difficulty === 'HARD')).toBe(true)

    const arrays = await list('/api/problems?topic=arrays&limit=50')
    expect(arrays.items.length).toBeGreaterThan(0)
    expect(arrays.items.every((p) => p.topics.some((t) => t.slug === 'arrays'))).toBe(true)

    const combined = await list('/api/problems?topic=arrays&difficulty=HARD&limit=50')
    const expected = await prisma.problem.count({
      where: {
        reviewStatus: 'PUBLISHED',
        difficulty: 'HARD',
        topics: { some: { topic: { slug: 'arrays' } } },
      },
    })
    expect(combined.items).toHaveLength(expected)

    // A filter that matches nothing is an empty list, not an error.
    const none = await list('/api/problems?topic=arrays&pattern=tree-bfs&limit=50')
    expect(none.items).toHaveLength(0)
    expect(none.hasMore).toBe(false)
  })

  it('searches titles without case sensitivity', async () => {
    const lower = await list('/api/problems?q=belt')
    const upper = await list('/api/problems?q=BELT')
    expect(lower.items.map((p) => p.slug)).toEqual(upper.items.map((p) => p.slug))
    expect(lower.items.length).toBeGreaterThan(0)
  })

  it('rejects a filter the API does not define', async () => {
    // `status` is derived from submissions, which do not exist until Phase 4.
    // Accepting and ignoring it would be a filter that silently lies.
    await get('/api/problems?status=SOLVED').expect(400)
  })

  /* ---------------------------------------------------------------------- */

  it('paginates by cursor without repeating or skipping a row', async () => {
    const all = await list('/api/problems?limit=50')
    const everySlug = all.items.map((p) => p.slug)
    expect(everySlug.length).toBeGreaterThan(4)

    const walked: string[] = []
    let cursor: string | null = null
    do {
      const page: Paginated<ProblemListItem> = await list(
        `/api/problems?limit=2${cursor === null ? '' : `&cursor=${encodeURIComponent(cursor)}`}`,
      )
      walked.push(...page.items.map((p) => p.slug))
      cursor = page.nextCursor
    } while (cursor !== null)

    expect(walked).toEqual(everySlug)
    expect(new Set(walked).size).toBe(walked.length)
  })

  it('keeps a page boundary stable when a row is inserted mid-scroll', async () => {
    const before = (await list('/api/problems?limit=50')).items.map((p) => p.slug)
    const page1 = await list('/api/problems?limit=3')
    expect(page1.nextCursor).not.toBeNull()

    // Offset pagination would now repeat a row: a newer problem shifts every
    // subsequent row one place down. A keyset cursor cannot.
    const intruder = await insertProblem()

    try {
      const page2 = await list(
        `/api/problems?limit=3&cursor=${encodeURIComponent(page1.nextCursor as string)}`,
      )
      const seen = [...page1.items, ...page2.items].map((p) => p.slug)

      expect(new Set(seen).size).toBe(seen.length)
      expect(seen).not.toContain(intruder.slug)
      expect(seen).toEqual(before.slice(0, seen.length))
    } finally {
      await prisma.problem.delete({ where: { id: intruder.id } })
    }
  })

  it('refuses a cursor it did not issue', async () => {
    const response = await get('/api/problems?cursor=not-a-real-cursor').expect(400)
    expect(response.body.error.code).toBe('INVALID_CURSOR')
  })

  /* ---------------------------------------------------------------------- */

  it('answers a missing problem and a missing topic with a stable code', async () => {
    const problem = await get('/api/problems/no-such-problem').expect(404)
    expect(problem.body.error.code).toBe('PROBLEM_NOT_FOUND')

    const topic = await get('/api/topics/no-such-topic').expect(404)
    expect(topic.body.error.code).toBe('TOPIC_NOT_FOUND')
  })

  it('serves one hint at a time, never the ladder', async () => {
    const problem = await prisma.problem.findFirstOrThrow({
      where: { hints: { some: {} } },
      select: {
        slug: true,
        hints: { select: { level: true, content: true }, orderBy: { level: 'asc' } },
      },
    })

    const first = await get(`/api/problems/${problem.slug}/hints/1`).expect(200)
    expect(first.body).toEqual({ level: 1, content: problem.hints[0]?.content })
    // The response carries one hint and nothing that could reveal the next.
    expect(Object.keys(first.body)).toEqual(['level', 'content'])

    await get(`/api/problems/${problem.slug}/hints/99`).expect(404)
  })

  /* ---------------------------------------------------------------------- */

  async function list(path: string): Promise<Paginated<ProblemListItem>> {
    const response = await get(path).expect(200)
    return response.body as Paginated<ProblemListItem>
  }

  async function insertProblem(): Promise<{ id: string; slug: string }> {
    return prisma.problem.create({
      data: {
        slug: `e2e-intruder-${randomUUID()}`,
        title: 'E2E Intruder',
        difficulty: 'EASY',
        statement: 'Inserted by a test.',
        constraints: 'None.',
        examples: [],
        starterCode: {},
        timeLimitMs: 1000,
        memoryLimitMb: 128,
        estimatedMinutes: 1,
        reviewStatus: 'PUBLISHED',
      },
      select: { id: true, slug: true },
    })
  }
})

function countNodes(sections: { nodes: { children: unknown[] }[] }[]): number {
  let total = 0
  const walk = (nodes: { children: unknown[] }[]): void => {
    for (const node of nodes) {
      total += 1
      walk(node.children as { children: unknown[] }[])
    }
  }
  for (const section of sections) {
    walk(section.nodes)
  }
  return total
}
