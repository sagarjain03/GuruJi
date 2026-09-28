import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { AI_MESSAGE_MAX } from './mentor.dto'

export class HintDto {
  @IsString()
  problemSlug!: string

  @IsInt()
  @Min(1)
  @Max(4)
  level!: number

  @IsOptional()
  @IsString()
  @MaxLength(AI_MESSAGE_MAX)
  message?: string
}