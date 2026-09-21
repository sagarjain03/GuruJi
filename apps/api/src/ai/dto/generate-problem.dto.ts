import { IsString, MaxLength } from 'class-validator'

export class GenerateProblemDto {
  @IsString()
  @MaxLength(5000)
  brief!: string
}