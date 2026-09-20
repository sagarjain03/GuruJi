import { Body, Controller, Get, Param, ParseEnumPipe, Put, UseGuards } from '@nestjs/common'
import type { Draft, DraftsResponse } from '@guruji/types'
import { CurrentUser } from '../common/decorators/current-user'
import { AccessTokenGuard, type AuthenticatedUser } from '../auth/guards/access-token.guard'
import { DraftsService } from './drafts.service'
import { SaveDraftDto } from './dto/save-draft.dto'

/** Mirrors the `Language` enum. Declared here so the pipe has a value to check. */
const LANGUAGES = {
  CPP: 'CPP',
  C: 'C',
  PYTHON: 'PYTHON',
  JAVASCRIPT: 'JAVASCRIPT',
} as const

type LanguageParam = keyof typeof LANGUAGES

/**
 * Unsubmitted code.
 *
 * Guarded as a whole: unlike the content routes, there is no anonymous reading
 * of a draft — it belongs to exactly one person.
 */
@Controller('problems/:slug/drafts')
@UseGuards(AccessTokenGuard)
export class DraftsController {
  constructor(private readonly drafts: DraftsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
  ): Promise<DraftsResponse> {
    return { drafts: await this.drafts.listForProblem(user.id, slug) }
  }

  @Put(':language')
  save(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
    @Param('language', new ParseEnumPipe(LANGUAGES)) language: LanguageParam,
    @Body() dto: SaveDraftDto,
  ): Promise<Draft> {
    // The user id comes from the verified token, never from the request body.
    return this.drafts.save(user.id, slug, language, dto.code)
  }
}
