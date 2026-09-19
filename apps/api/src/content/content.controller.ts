import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common'
import type {
  Hint,
  Paginated,
  PatternSummary,
  ProblemDetail,
  ProblemListItem,
  Roadmap,
  TopicDetail,
  TopicSummary,
} from '@guruji/types'
import { ProblemQueryDto } from './dto/problem-query.dto'
import { ProblemsService } from './problems.service'
import { TaxonomyService } from './taxonomy.service'

/**
 * Content is readable without an account.
 *
 * The roadmap and the problem bank are the product's shop window; requiring a
 * login to see what the curriculum contains would hide the only thing that makes
 * someone want an account. Nothing here varies by user in Phase 2 — the mastery
 * and solved-status overlays land in Phase 5, and they bring an optional guard
 * with them.
 */
@Controller()
export class ContentController {
  constructor(
    private readonly taxonomy: TaxonomyService,
    private readonly problems: ProblemsService,
  ) {}

  @Get('topics')
  topics(): Promise<TopicSummary[]> {
    return this.taxonomy.topics()
  }

  @Get('topics/:slug')
  topic(@Param('slug') slug: string): Promise<TopicDetail> {
    return this.taxonomy.topic(slug)
  }

  @Get('patterns')
  patterns(): Promise<PatternSummary[]> {
    return this.taxonomy.patterns()
  }

  @Get('roadmap')
  roadmap(): Promise<Roadmap> {
    return this.taxonomy.roadmap()
  }

  @Get('problems')
  list(@Query() query: ProblemQueryDto): Promise<Paginated<ProblemListItem>> {
    return this.problems.list(query)
  }

  @Get('problems/:slug')
  detail(@Param('slug') slug: string): Promise<ProblemDetail> {
    return this.problems.detail(slug)
  }

  /**
   * One curated hint, by level. The client asks for the next level only when the
   * user deliberately requests it — which is also what makes hint dependency
   * measurable in Phase 5.
   */
  @Get('problems/:slug/hints/:level')
  hint(@Param('slug') slug: string, @Param('level', ParseIntPipe) level: number): Promise<Hint> {
    return this.problems.hint(slug, level)
  }
}
