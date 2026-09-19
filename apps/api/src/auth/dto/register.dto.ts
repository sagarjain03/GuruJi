import { IsEmail, IsString, Length, MaxLength } from 'class-validator'
import { Transform } from 'class-transformer'
import type { RegisterRequest } from '@guruji/types'

export class RegisterDto implements RegisterRequest {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(320)
  email!: string

  // Length over composition rules, per docs/security.md.
  @IsString()
  @Length(12, 200, { message: 'Use at least 12 characters.' })
  password!: string

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 80, { message: 'Enter a name.' })
  displayName!: string
}
