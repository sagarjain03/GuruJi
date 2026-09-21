import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class HintDto {
  @IsString()
  problemSlug!: string

  @IsInt()
  @Min(1)
  @Max(4)
  level!: number

  @IsOptional()
  @IsString()
  message?: string
}