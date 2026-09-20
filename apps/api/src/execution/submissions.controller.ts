import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import type {
  Paginated,
  Submission,
  SubmissionAccepted,
  SubmissionDetail,
} from '@guruji/types'
import { AccessTokenGuard, type AuthenticatedUser } from '../auth/guards/access-token.guard'
import { CurrentUser } from '../common/decorators/current-user'
import { SubmissionQueryDto } from './dto/submission-query.dto'
import { SubmitDto } from './dto/submit.dto'
import { SubmissionsService } from './submissions.service'

/**
 * Running code, and the history of having run it.
 *
 * Guarded as a whole. There is no anonymous submission: every row belongs to
 * exactly one person, and the id it belongs to comes from the verified token.
 */
@Controller('submissions')
@UseGuards(AccessTokenGuard)
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  /**
   * 202, not 200.
   *
   * The work is queued, not done. Answering 200 with an empty verdict would be
   * a lie the client then has to decode.
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitDto,
  ): Promise<SubmissionAccepted> {
    return this.submissions.submit(user.id, dto)
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SubmissionQueryDto,
  ): Promise<Paginated<Submission>> {
    return this.submissions.list(user.id, query)
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SubmissionDetail> {
    return this.submissions.findOne(user.id, id)
  }
}
