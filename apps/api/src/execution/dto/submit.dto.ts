import { Transform } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator'
import { SUBMISSION_CODE_MAX, type SubmitRequest } from '@guruji/types'

const LANGUAGES = ['CPP', 'C', 'PYTHON', 'JAVASCRIPT'] as const

/**
 * Everything checked before a single byte reaches the queue.
 *
 * The size cap in particular is not a formality: the code is copied into the
 * job payload, into Redis, and into a file mounted at the sandbox. An unbounded
 * field here is an unbounded write in three places.
 */
export class SubmitDto implements SubmitRequest {
  @IsUUID()
  problemId!: string

  @IsIn(LANGUAGES)
  language!: (typeof LANGUAGES)[number]

  @IsString()
  @MaxLength(SUBMISSION_CODE_MAX, { message: 'That is too much code to submit.' })
  code!: string

  /** true runs the sample cases only; false grades against every case. */
  @IsBoolean()
  isRun!: boolean

  // Self-reported, and treated as such: it is a hint for the mastery model in
  // Phase 5, not a measurement, so it is bounded rather than trusted.
  @Transform(({ value }) => (value === undefined ? 0 : Number(value)))
  @IsInt()
  @Min(0)
  @Max(24 * 60 * 60 * 1000)
  timeSpentMs: number = 0

  @Transform(({ value }) => (value === undefined ? 0 : Number(value)))
  @IsInt()
  @Min(0)
  @Max(100)
  hintsUsedAtSubmit: number = 0
}
