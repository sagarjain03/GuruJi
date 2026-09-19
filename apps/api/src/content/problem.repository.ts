import { Injectable } from '@nestjs/common'
import { prisma, Prisma } from '@guruji/database'
import type {
  Difficulty,
  Hint,
  Paginated,
  ProblemDetail,
  ProblemListItem,
  ProblemQuery,
  StarterCode,
  TaxonomyRef,
} from '@guruji/types'
import { decodeCursor, encodeCursor } from './cursor'

/**
 * The tag shape every list row carries. Selected rather than included so a new
 * field on Topic cannot start appearing in API responses by accident.
 */
const TAG_SELECT = {
  relevance: true,
  topic: { select: { slug: true, name: true } },
} as const

const LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  difficulty: true,
  estimatedMinutes: true,
  acceptanceRate: true,
  createdAt: true,
  topics: { select: TAG_SELECT },
  patterns: { select: { relevance: true, pattern: { select: { slug: true, name: true } } } },
} as const

/**
 * Reads of the problem bank.
 *
 * **Hidden test cases are filtered here, not in a controller or a service.** A
 * new endpoint written later cannot expose them by forgetting a `where`, because
 * there is no query in this file that returns them — that is the entire point of
 * putting the filter at this layer, per docs/api.md.
 */
@Injectable()
export class ProblemRepository {
  async list(query: ProblemQuery): Promise<Paginated<ProblemListItem>> {
    const where = this.buildWhere(query)

    // One extra row answers "is there a next page" without a second count query.
    const rows = await prisma.problem.findMany({
      where,
      select: LIST_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    })

    const hasMore = rows.length > query.limit
    const page = hasMore ? rows.slice(0, query.limit) : rows
    const last = page.at(-1)

    return {
      items: page.map((row) => this.toListItem(row)),
      nextCursor:
        hasMore && last !== undefined
          ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : null,
      hasMore,
    }
  }

  async findBySlug(slug: string): Promise<ProblemDetail | null> {
    const row = await prisma.problem.findFirst({
      where: { slug, reviewStatus: 'PUBLISHED' },
      select: {
        ...LIST_SELECT,
        statement: true,
        constraints: true,
        examples: true,
        starterCode: true,
        timeLimitMs: true,
        memoryLimitMb: true,
        source: true,
        sourceUrl: true,
        // Samples only. There is deliberately no branch of this query that can
        // return a hidden case.
        testCases: {
          where: { isSample: true },
          orderBy: { displayOrder: 'asc' },
          select: { id: true, input: true, expectedOutput: true, displayOrder: true },
        },
        _count: { select: { hints: true } },
      },
    })

    if (row === null) {
      return null
    }

    return {
      ...this.toListItem(row),
      statement: row.statement,
      constraints: row.constraints,
      examples: this.toExamples(row.examples),
      starterCode: this.toStarterCode(row.starterCode),
      timeLimitMs: row.timeLimitMs,
      memoryLimitMb: row.memoryLimitMb,
      source: row.source,
      sourceUrl: row.sourceUrl,
      sampleTestCases: row.testCases,
      hintCount: row._count.hints,
    }
  }

  /**
   * One hint, by level. Hints are never returned as a list: handing over all of
   * them at once is handing over the solution.
   */
  async findHint(slug: string, level: number): Promise<Hint | null> {
    const row = await prisma.hint.findFirst({
      where: { level, problem: { slug, reviewStatus: 'PUBLISHED' } },
      select: { level: true, content: true },
    })
    return row
  }

  private buildWhere(query: ProblemQuery): Prisma.ProblemWhereInput {
    const where: Prisma.ProblemWhereInput = { reviewStatus: 'PUBLISHED' }

    if (query.difficulty !== undefined) {
      where.difficulty = query.difficulty as Difficulty
    }
    if (query.topic !== undefined) {
      where.topics = { some: { topic: { slug: query.topic } } }
    }
    if (query.pattern !== undefined) {
      where.patterns = { some: { pattern: { slug: query.pattern } } }
    }
    if (query.q !== undefined && query.q.length > 0) {
      where.title = { contains: query.q, mode: 'insensitive' }
    }

    if (query.cursor !== undefined) {
      const cursor = decodeCursor(query.cursor)
      const createdAt = new Date(cursor.createdAt)
      // Strictly after the cursor row in (createdAt desc, id desc) order. An
      // `lt` on createdAt alone would drop every row sharing that timestamp.
      where.OR = [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: cursor.id } }]
    }

    return where
  }

  private toListItem(row: {
    id: string
    slug: string
    title: string
    difficulty: string
    estimatedMinutes: number
    acceptanceRate: number | null
    topics: { relevance: string; topic: { slug: string; name: string } }[]
    patterns: { relevance: string; pattern: { slug: string; name: string } }[]
  }): ProblemListItem {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      difficulty: row.difficulty as ProblemListItem['difficulty'],
      estimatedMinutes: row.estimatedMinutes,
      acceptanceRate: row.acceptanceRate,
      topics: row.topics.map((t): TaxonomyRef => ({
        slug: t.topic.slug,
        name: t.topic.name,
        relevance: t.relevance as TaxonomyRef['relevance'],
      })),
      patterns: row.patterns.map((p): TaxonomyRef => ({
        slug: p.pattern.slug,
        name: p.pattern.name,
        relevance: p.relevance as TaxonomyRef['relevance'],
      })),
    }
  }

  /**
   * `examples` and `starterCode` are jsonb, so Prisma types them as `JsonValue`
   * and the shape has to be re-established at this boundary. The seed is the
   * only writer today; when problem authoring becomes an endpoint the write side
   * validates against the same schemas in `@guruji/types`.
   */
  private toExamples(value: unknown): ProblemDetail['examples'] {
    if (!Array.isArray(value)) {
      return []
    }
    return value.flatMap((entry) => {
      if (typeof entry !== 'object' || entry === null) {
        return []
      }
      const record = entry as Record<string, unknown>
      if (typeof record.input !== 'string' || typeof record.output !== 'string') {
        return []
      }
      return [
        {
          input: record.input,
          output: record.output,
          explanation: typeof record.explanation === 'string' ? record.explanation : null,
        },
      ]
    })
  }

  private toStarterCode(value: unknown): StarterCode {
    if (typeof value !== 'object' || value === null) {
      return {}
    }
    const out: StarterCode = {}
    for (const [language, code] of Object.entries(value as Record<string, unknown>)) {
      if (typeof code === 'string') {
        out[language as keyof StarterCode] = code
      }
    }
    return out
  }
}
