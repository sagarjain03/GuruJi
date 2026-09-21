import { IsOptional, IsString, MaxLength } from 'class-validator'

export class ProblemRequestDto {
  @IsString()
  problemSlug!: string
}

export class AnalyzeCodeDto extends ProblemRequestDto {
  @IsString()
  @MaxLength(50000)
  code!: string
}

export class ExplainWrongAnswerDto extends AnalyzeCodeDto {
  @IsString()
  @MaxLength(10000)
  failedInput!: string

  @IsString()
  @MaxLength(10000)
  expectedOutput!: string

  @IsString()
  @MaxLength(10000)
  actualOutput!: string
}

export class ExplainDto extends ProblemRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  question?: string
}