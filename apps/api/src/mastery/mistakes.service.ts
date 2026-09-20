import { Injectable } from '@nestjs/common'
import { prisma, type MistakeCategory, type Prisma } from '@guruji/database'
import type {
  CreateMistakeRequest,
  Mistake,
  MistakePattern,
  MistakePatternsResponse,
  Paginated,
} from '@guruji/types'
import { NotFoundError } from '../common/app-error'
import { decodeCursor, encodeCursor } from '../content/cursor'

const MISTAKE_SELECT = {
  id: true,
  problemId: true,
  submissionId: true,
  category: true,
  whatWentWrong: true,
  correctIdea: true,
  aiAnalysis: true,
  createdAt: true,
  problem: { select: { slug: true, title: true } },
} as const

/**
 * The mistake journal.
 *
 * Writing down what went wrong is the part that makes a wrong answer worth
 * something. The aggregation is the part that makes the journal worth keeping:
 * one logged mistake is a note, and six of the same kind is a diagnosis.
 */
@Injectable()
export class MistakesService {
  async create(userId: string, request: CreateMistakeRequest): Promise<Mistake> {
    const problem = await prisma.problem.findFirst({
      where: { id: request.problemId, reviewStatus: 'PUBLISHED' },
      select: { id: true },
    })
    if (problem === null) {
      throw new NotFoundError('PROBLEM_NOT_FOUND', 'That problem does not exist.')
    }

    /*
     * The submission is checked against *this* user, not merely that it exists.
     *
     * Otherwise anyone could attach their journal entry to a stranger's
     * submission id, and `GET /mistakes` would happily join it back out again.
     */
    if (request.submissionId !== undefined) {
      const submission = await prisma.submission.findFirst({
        where: { id: request.submissionId, userId },
        select: { id: true },
      })
      if (submission === null) {
        throw new NotFoundError('SUBMISSION_NOT_FOUND', 'That submission does not exist.')
      }
    }

    const row = await prisma.mistake.create({
      data: {
        // From the verified token, never from the body.
        userId,
        problemId: request.problemId,
        ...(request.submissionId === undefined ? {} : { submissionId: request.submissionId }),
        category: request.category,
        whatWentWrong: request.whatWentWrong,
        ...(request.correctIdea === undefined ? {} : { correctIdea: request.correctIdea }),
      },
      select: MISTAKE_SELECT,
    })

    return toWire(row)
  }

  async list(
    userId: string,
    query: { cursor?: string; limit: number; category?: MistakeCategory; problemId?: string },
  ): Promise<Paginated<Mistake>> {
    const cursor = query.cursor === undefined ? null : decodeCursor(query.cursor)

    const where: Prisma.MistakeWhereInput = {
      userId,
      ...(query.category === undefined ? {} : { category: query.category }),
      ...(query.problemId === undefined ? {} : { problemId: query.problemId }),
      ...(cursor === null
        ? {}
        : {
            OR: [
              { createdAt: { lt: new Date(cursor.createdAt) } },
              { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
            ],
          }),
    }

    const rows = await prisma.mistake.findMany({
      where,
      select: MISTAKE_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    })

    const hasMore = rows.length > query.limit
    const page = hasMore ? rows.slice(0, query.limit) : rows
    const last = page.at(-1)

    return {
      items: page.map((row) => toWire(row)),
      nextCursor:
        hasMore && last !== undefined
          ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : null,
      hasMore,
    }
  }

  /**
   * What keeps happening, and where.
   *
   * A count alone is a scoreboard, and nobody practises differently because of
   * a scoreboard. The topics are what turn "six off-by-one errors" into "six
   * off-by-one errors, four of them in binary search" — which is a thing to go
   * and do something about.
   */
  async patterns(userId: string): Promise<MistakePatternsResponse> {
    const rows = await prisma.mistake.findMany({
      where: { userId },
      select: {
        category: true,
        createdAt: true,
        problem: { select: { topics: { select: { topic: { select: { slug: true, name: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
      // Bounded. The journal is a recent-history tool; a mistake from two years
      // ago is not the pattern anyone is trying to break.
      take: 500,
    })

    const byCategory = new Map<MistakeCategory, { count: number; lastSeenAt: Date; topics: Map<string, { name: string; count: number }> }>()

    for (const row of rows) {
      const entry = byCategory.get(row.category) ?? {
        count: 0,
        // Rows arrive newest first, so the first one seen is the latest.
        lastSeenAt: row.createdAt,
        topics: new Map<string, { name: string; count: number }>(),
      }
      entry.count += 1

      for (const { topic } of row.problem.topics) {
        const topicEntry = entry.topics.get(topic.slug) ?? { name: topic.name, count: 0 }
        topicEntry.count += 1
        entry.topics.set(topic.slug, topicEntry)
      }

      byCategory.set(row.category, entry)
    }

    const patterns: MistakePattern[] = [...byCategory.entries()]
      .map(([category, entry]) => ({
        category,
        count: entry.count,
        lastSeenAt: entry.lastSeenAt.toISOString(),
        topics: [...entry.topics.entries()]
          .map(([slug, topic]) => ({ slug, name: topic.name, count: topic.count }))
          .sort((a, b) => b.count - a.count),
      }))
      // Most frequent first: the top of this list is what to work on.
      .sort((a, b) => b.count - a.count)

    return { patterns, total: rows.length }
  }
}

function toWire(row: {
  id: string
  problemId: string
  submissionId: string | null
  category: MistakeCategory
  whatWentWrong: string
  correctIdea: string | null
  aiAnalysis: string | null
  createdAt: Date
  problem: { slug: string; title: string }
}): Mistake {
  return {
    id: row.id,
    problemId: row.problemId,
    problemSlug: row.problem.slug,
    problemTitle: row.problem.title,
    submissionId: row.submissionId,
    category: row.category,
    whatWentWrong: row.whatWentWrong,
    correctIdea: row.correctIdea,
    aiAnalysis: row.aiAnalysis,
    createdAt: row.createdAt.toISOString(),
  }
}
