import { Injectable } from '@nestjs/common'
import { prisma, type Language } from '@guruji/database'
import type { Draft } from '@guruji/types'
import { NotFoundError } from '../common/app-error'

const DRAFT_SELECT = {
  problemId: true,
  language: true,
  code: true,
  updatedAt: true,
} as const

/**
 * Drafts are private by construction.
 *
 * Every query below filters on `userId` in the `WHERE` clause rather than
 * fetching a row and comparing afterwards. A check that happens after the read
 * is a check someone eventually forgets, and the row is already in memory by
 * then.
 */
@Injectable()
export class DraftsService {
  async listForProblem(userId: string, slug: string): Promise<Draft[]> {
    const problemId = await this.resolveProblem(slug)

    const rows = await prisma.draft.findMany({
      where: { userId, problemId },
      select: DRAFT_SELECT,
      orderBy: { language: 'asc' },
    })

    return rows.map((row) => this.toWire(row))
  }

  /**
   * Autosave. An upsert on `(userId, problemId, language)` rather than an
   * insert-or-update pair: two keystrokes arriving together would otherwise race
   * and leave a duplicate the unique index would then reject.
   */
  async save(userId: string, slug: string, language: Language, code: string): Promise<Draft> {
    const problemId = await this.resolveProblem(slug)

    const row = await prisma.draft.upsert({
      where: { userId_problemId_language: { userId, problemId, language } },
      create: { userId, problemId, language, code },
      update: { code },
      select: DRAFT_SELECT,
    })

    return this.toWire(row)
  }

  private async resolveProblem(slug: string): Promise<string> {
    const problem = await prisma.problem.findFirst({
      where: { slug, reviewStatus: 'PUBLISHED' },
      select: { id: true },
    })
    if (problem === null) {
      throw new NotFoundError('PROBLEM_NOT_FOUND', 'That problem does not exist.')
    }
    return problem.id
  }

  private toWire(row: {
    problemId: string
    language: Language
    code: string
    updatedAt: Date
  }): Draft {
    return {
      problemId: row.problemId,
      language: row.language,
      code: row.code,
      updatedAt: row.updatedAt.toISOString(),
    }
  }
}
