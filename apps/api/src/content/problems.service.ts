import { Injectable } from '@nestjs/common'
import type { Hint, Paginated, ProblemDetail, ProblemListItem, ProblemQuery } from '@guruji/types'
import { NotFoundError } from '../common/app-error'
import { CACHE_TTL, ContentCache } from './content-cache.service'
import { ProblemRepository } from './problem.repository'

@Injectable()
export class ProblemsService {
  constructor(
    private readonly repository: ProblemRepository,
    private readonly cache: ContentCache,
  ) {}

  async list(query: ProblemQuery): Promise<Paginated<ProblemListItem>> {
    return this.cache.wrap(this.listKey(query), CACHE_TTL.problemList, () =>
      this.repository.list(query),
    )
  }

  async detail(slug: string): Promise<ProblemDetail> {
    const problem = await this.repository.findBySlug(slug)
    if (problem === null) {
      throw new NotFoundError('PROBLEM_NOT_FOUND', 'That problem does not exist.')
    }
    return problem
  }

  async hint(slug: string, level: number): Promise<Hint> {
    const hint = await this.repository.findHint(slug, level)
    if (hint === null) {
      throw new NotFoundError('PROBLEM_NOT_FOUND', 'There is no hint at that level.')
    }
    return hint
  }

  /**
   * The cache key carries every filter, because two different filters must never
   * share a cached page. The cursor is part of it for the same reason.
   */
  private listKey(query: ProblemQuery): string {
    const parts = [
      query.topic ?? '-',
      query.pattern ?? '-',
      query.difficulty ?? '-',
      query.q ?? '-',
      query.cursor ?? '-',
      String(query.limit),
    ]
    return `content:problems:v1:${parts.join('|')}`
  }
}
