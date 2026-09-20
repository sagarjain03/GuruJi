import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import type { Mistake, MistakePatternsResponse, Paginated } from '@guruji/types'
import { AccessTokenGuard, type AuthenticatedUser } from '../auth/guards/access-token.guard'
import { CurrentUser } from '../common/decorators/current-user'
import { CreateMistakeDto, MistakeQueryDto } from './dto/mistake.dto'
import { MistakesService } from './mistakes.service'

/**
 * The mistake journal. Guarded as a whole — it is the most personal thing in
 * the product and there is no anonymous read of one.
 */
@Controller('mistakes')
@UseGuards(AccessTokenGuard)
export class MistakesController {
  constructor(private readonly mistakes: MistakesService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMistakeDto): Promise<Mistake> {
    return this.mistakes.create(user.id, dto)
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MistakeQueryDto,
  ): Promise<Paginated<Mistake>> {
    return this.mistakes.list(user.id, query)
  }

  /**
   * Declared before nothing, but worth noting: this is a fixed segment, so it
   * can never be shadowed by an id route. There is no `GET /mistakes/:id` —
   * a single entry is never useful on its own, and the list already carries it.
   */
  @Get('patterns')
  patterns(@CurrentUser() user: AuthenticatedUser): Promise<MistakePatternsResponse> {
    return this.mistakes.patterns(user.id)
  }
}
