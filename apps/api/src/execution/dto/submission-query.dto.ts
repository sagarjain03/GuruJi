import { Transform } from 'class-transformer'
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator'
import type { SubmissionQuery } from '@guruji/types'

/** Query parameters for `GET /submissions`. Cursor-based, like every list here. */
export class SubmissionQueryDto implements SubmissionQuery {
  @IsOptional()
  @IsUUID()
  problemId?: string

  @IsOptional()
  @IsString()
  @MaxLength(400)
  cursor?: string

  // Query strings are always text, and `transform: true` does not coerce
  // without this — `@IsInt` would then reject every request.
  @Transform(({ value }) => (value === undefined ? 20 : Number(value)))
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20
}
