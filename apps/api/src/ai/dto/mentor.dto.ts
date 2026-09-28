import { SUBMISSION_CODE_MAX } from '@guruji/types'
import { IsOptional, IsString, MaxLength } from 'class-validator'

/**
 * Every field below is sent to a paid model. A message is capped at 4 KB
 * (docs/security.md): past that it is context flooding, and each character is
 * a cost. Code is the exception — it is capped at what a submission may be.
 */
export const AI_MESSAGE_MAX = 4000

export class ProblemRequestDto {
  @IsString()
  problemSlug!: string
}

export class AnalyzeCodeDto extends ProblemRequestDto {
  @IsString()
  @MaxLength(SUBMISSION_CODE_MAX)
  code!: string
}

export class ExplainWrongAnswerDto extends AnalyzeCodeDto {
  @IsString()
  @MaxLength(AI_MESSAGE_MAX)
  failedInput!: string

  @IsString()
  @MaxLength(AI_MESSAGE_MAX)
  expectedOutput!: string

  @IsString()
  @MaxLength(AI_MESSAGE_MAX)
  actualOutput!: string
}

export class ExplainDto extends ProblemRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(AI_MESSAGE_MAX)
  question?: string
}