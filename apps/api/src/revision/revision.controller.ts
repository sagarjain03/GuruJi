import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { prisma } from '@guruji/database'
import {
  completeRevisionRequestSchema,
  type CompleteRevisionResponse,
  type DueQueue,
  type UpcomingDay,
} from '@guruji/types'
import { AccessTokenGuard, type AuthenticatedUser } from '../auth/guards/access-token.guard'
import { AppError, NotFoundError } from '../common/app-error'
import { CurrentUser } from '../common/decorators/current-user'
import { QueueService } from './queue.service'
import { RevisionService } from './revision.service'

@Controller('revision')
@UseGuards(AccessTokenGuard)
export class RevisionController {
  constructor(
    private readonly queue: QueueService,
    private readonly revision: RevisionService,
  ) {}

  /** What to do today, already ordered and already capped. */
  @Get('due')
  due(@CurrentUser() user: AuthenticatedUser): Promise<DueQueue> {
    return this.queue.due(user.id)
  }

  @Get('upcoming')
  upcoming(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') days?: string,
  ): Promise<UpcomingDay[]> {
    // Bounded here rather than trusted: an unbounded horizon is an unbounded
    // query, and nobody plans revision three years out.
    const horizon = Math.min(Math.max(Number(days ?? 7) || 7, 1), 30)
    return this.queue.upcoming(user.id, horizon)
  }

  /**
   * Records how a review went and reschedules it.
   *
   * The write and the mastery `retention` counters move in one transaction:
   * a review that reschedules without feeding retention would leave the model
   * claiming durability it never measured.
   */
  @Post(':id/complete')
  async complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<CompleteRevisionResponse> {
    // Zod rather than a class-validator DTO: the shape is already defined once,
    // in the contract both sides import.
    const parsed = completeRevisionRequestSchema.safeParse(body)
    if (!parsed.success) {
      throw new AppError('INVALID_REVISION_OUTCOME', 'That is not a valid revision outcome.')
    }

    const result = await prisma.$transaction((tx) =>
      this.revision.complete(
        tx,
        user.id,
        id,
        parsed.data.outcome,
        parsed.data.submissionId ?? null,
      ),
    )

    // 404, not 403: confirming the id exists is itself a disclosure.
    if (result === null) {
      throw new NotFoundError('REVISION_NOT_FOUND', 'That revision item does not exist.')
    }

    return { state: result.state, dueAt: result.dueAt.toISOString() }
  }

  /**
   * Spreads a backlog forward after a long absence.
   *
   * Explicit rather than automatic on read: re-spacing rewrites `dueAt` on many
   * rows, and a GET that quietly rewrites the schedule is a GET nobody can
   * reason about.
   */
  @Post('respace')
  async respace(@CurrentUser() user: AuthenticatedUser): Promise<{ moved: number }> {
    return { moved: await this.queue.respaceBacklog(user.id) }
  }
}
