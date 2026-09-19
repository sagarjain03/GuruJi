import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/client/client'
import { PATTERNS, TOPICS } from './taxonomy'
import { seedAll, type SeedCounts } from './run'

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

describe('seed', () => {
  let first: SeedCounts

  beforeAll(async () => {
    first = await seedAll(db)
  })

  afterAll(async () => {
    await db.$disconnect()
  })

  it('produces the curriculum the docs describe', () => {
    expect(first.topics).toBe(TOPICS.length)
    expect(first.patterns).toBe(PATTERNS.length)
    // One roadmap node per topic — the tree is a curriculum, not a tag cloud.
    expect(first.roadmapNodes).toBe(TOPICS.length)
    expect(first.problems).toBeGreaterThan(0)
  })

  it('is idempotent: a second run changes no counts', async () => {
    const second = await seedAll(db)
    expect(second).toEqual(first)
  })

  /**
   * The stronger claim, and the one that matters from Phase 4: re-seeding must
   * not reissue ids. A seed that deletes and recreates its children passes a
   * count check and still orphans every submission that referenced a test case.
   */
  it('is idempotent: a second run reissues no test case or hint ids', async () => {
    const before = await snapshotIds()
    await seedAll(db)
    expect(await snapshotIds()).toEqual(before)
  })

  it('gives every problem samples to show and hidden cases to grade with', async () => {
    const problems = await db.problem.findMany({
      select: {
        slug: true,
        testCases: { select: { isSample: true, isHidden: true } },
        hints: { select: { level: true }, orderBy: { level: 'asc' } },
      },
    })

    for (const problem of problems) {
      const samples = problem.testCases.filter((t) => t.isSample)
      const hidden = problem.testCases.filter((t) => t.isHidden)

      expect(samples.length, `${problem.slug} has no sample test case`).toBeGreaterThan(0)
      expect(hidden.length, `${problem.slug} has no hidden test case`).toBeGreaterThan(0)

      // A sample is never hidden: it is shown on the problem page by definition.
      expect(
        samples.every((t) => !t.isHidden),
        `${problem.slug} has a hidden sample`,
      ).toBe(true)

      // Hints escalate from level 1 with no gaps, or the ladder cannot be walked.
      expect(problem.hints.map((h) => h.level)).toEqual(problem.hints.map((_, index) => index + 1))
    }
  })

  it('declares no prerequisite a topic cannot reach', async () => {
    const topics = await db.topic.findMany({
      select: {
        slug: true,
        prerequisites: { select: { prerequisite: { select: { slug: true } } } },
      },
    })
    const known = new Set(topics.map((t) => t.slug))

    for (const topic of topics) {
      for (const edge of topic.prerequisites) {
        expect(known.has(edge.prerequisite.slug)).toBe(true)
        // A topic that requires itself would make the roadmap unenterable.
        expect(edge.prerequisite.slug).not.toBe(topic.slug)
      }
    }
  })
})

async function snapshotIds(): Promise<{ testCases: string[]; hints: string[] }> {
  const [testCases, hints] = await Promise.all([
    db.testCase.findMany({ select: { id: true }, orderBy: { id: 'asc' } }),
    db.hint.findMany({ select: { id: true }, orderBy: { id: 'asc' } }),
  ])
  return { testCases: testCases.map((t) => t.id), hints: hints.map((h) => h.id) }
}
