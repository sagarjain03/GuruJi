import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Res, UseGuards } from '@nestjs/common'
import {
  contestSubmitRequestSchema,
  startContestRequestSchema,
  type ContestReport,
  type ContestView,
  type SubmissionAccepted,
} from '@guruji/types'
import type { Response } from 'express'
import { z } from 'zod'
import { AccessTokenGuard, type AuthenticatedUser } from '../auth/guards/access-token.guard'
import { AppError, NotFoundError } from '../common/app-error'
import { CurrentUser } from '../common/decorators/current-user'
import { ContestsService } from './contests.service'

/** A malformed id can name no contest: 404, before it reaches the database. */
function contestId(raw: string): string {
  if (!z.uuid().safeParse(raw).success) throw new NotFoundError('NOT_FOUND', 'That contest does not exist.')
  return raw
}

function parse<T>(schema: z.ZodType<T>, body: unknown, message: string): T {
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw new AppError('VALIDATION_FAILED', message)
  return parsed.data
}

@Controller('contests')
@UseGuards(AccessTokenGuard)
export class ContestsController {
  constructor(private readonly contests: ContestsService) {}

  @Post()
  start(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown): Promise<ContestView> {
    return this.contests.start(
      user.id,
      parse(startContestRequestSchema, body, 'A contest lasts 60 or 90 minutes.'),
    )
  }

  /**
   * The most recent contest, or 204 when there has never been one — an empty
   * 200 is not valid JSON, and the client treats 204 as "nothing".
   * Declared before `:id` so "latest" is never read as an id.
   */
  @Get('latest')
  async latest(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ContestView | undefined> {
    const contest = await this.contests.latest(user.id)
    if (contest === null) {
      response.status(HttpStatus.NO_CONTENT)
      return undefined
    }
    return contest
  }

  @Get(':id')
  view(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ContestView> {
    return this.contests.view(user.id, contestId(id))
  }

  /** 202, like `/submissions`: the verdict arrives later over the socket. */
  @Post(':id/submissions')
  @HttpCode(HttpStatus.ACCEPTED)
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<SubmissionAccepted> {
    return this.contests.submit(
      user.id,
      contestId(id),
      parse(contestSubmitRequestSchema, body, 'A submission needs a problem, a language and code.'),
    )
  }

  @Post(':id/finish')
  @HttpCode(HttpStatus.OK)
  finish(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ContestView> {
    return this.contests.finish(user.id, contestId(id))
  }

  @Get(':id/report')
  report(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ContestReport> {
    return this.contests.report(user.id, contestId(id))
  }
}
