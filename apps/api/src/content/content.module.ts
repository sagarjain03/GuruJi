import { Module } from '@nestjs/common'
import { ContentController } from './content.controller'
import { ContentCache } from './content-cache.service'
import { ProblemRepository } from './problem.repository'
import { ProblemsService } from './problems.service'
import { TaxonomyService } from './taxonomy.service'

/** Topics, patterns, the roadmap tree and the problem bank. All read-only. */
@Module({
  controllers: [ContentController],
  providers: [TaxonomyService, ProblemsService, ProblemRepository, ContentCache],
  exports: [ProblemRepository],
})
export class ContentModule {}
