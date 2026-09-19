import { Transform } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import type { ProblemQuery } from '@guruji/types'

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const

/**
 * Query parameters for `GET /problems`.
 *
 * Every field is camelCase and so is the wire format — this project shares types
 * between the API and the browser, so there is no snake_case conversion layer
 * and no query-parameter name to remember. See docs/api.md.
 */
export class ProblemQueryDto implements ProblemQuery {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  topic?: string

  @IsOptional()
  @IsString()
  @MaxLength(80)
  pattern?: string

  @IsOptional()
  @IsIn(DIFFICULTIES)
  difficulty?: (typeof DIFFICULTIES)[number]

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string

  @IsOptional()
  @IsString()
  @MaxLength(400)
  cursor?: string

  // Query strings are always text; `transform: true` on the global pipe does not
  // coerce without this, and `@IsInt` would then reject every request.
  @Transform(({ value }) => (value === undefined ? 20 : Number(value)))
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20
}
