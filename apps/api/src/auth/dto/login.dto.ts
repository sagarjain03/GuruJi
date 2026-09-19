import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator'
import { Transform } from 'class-transformer'
import type { LoginRequest } from '@guruji/types'

export class LoginDto implements LoginRequest {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(320)
  email!: string

  // No length rule: the login form must not describe the password policy.
  @IsString()
  @MinLength(1, { message: 'Enter your password.' })
  password!: string
}
