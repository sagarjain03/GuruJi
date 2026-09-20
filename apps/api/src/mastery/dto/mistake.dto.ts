import { Transform } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator'
import { MISTAKE_TEXT_MAX, type CreateMistakeRequest, type MistakeQuery } from '@guruji/types'

const CATEGORIES = [
  'LOGIC',
  'SYNTAX',
  'EDGE_CASE',
  'COMPLEXITY',
  'IMPLEMENTATION',
  'MISREAD_PROBLEM',
  'WRONG_PATTERN',
  'OFF_BY_ONE',
  'OVERFLOW',
] as const

export class CreateMistakeDto implements CreateMistakeRequest {
  @IsUUID()
  problemId!: string

  // Optional because a mistake can be logged from reflection, not only from a
  // verdict — reading a solution a week later and realising what you missed is
  // exactly the moment worth capturing.
  @IsOptional()
  @IsUUID()
  submissionId?: string

  @IsIn(CATEGORIES)
  category!: (typeof CATEGORIES)[number]

  @IsString()
  @MaxLength(MISTAKE_TEXT_MAX)
  whatWentWrong!: string

  @IsOptional()
  @IsString()
  @MaxLength(MISTAKE_TEXT_MAX)
  correctIdea?: string
}

export class MistakeQueryDto implements MistakeQuery {
  @IsOptional()
  @IsIn(CATEGORIES)
  category?: (typeof CATEGORIES)[number]

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
