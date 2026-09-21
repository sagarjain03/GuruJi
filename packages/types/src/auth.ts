import { z } from 'zod'

/**
 * Wire-level copies of the enums the database also defines.
 *
 * The duplication is deliberate: this package is imported by the browser, and
 * pulling the Prisma client in with it would ship the ORM to the client.
 */
export const languageSchema = z.enum(['CPP', 'C', 'PYTHON', 'JAVASCRIPT'])
export type Language = z.infer<typeof languageSchema>

export const experienceLevelSchema = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'])
export type ExperienceLevel = z.infer<typeof experienceLevelSchema>

export const roleSchema = z.enum(['USER', 'ADMIN'])
export type Role = z.infer<typeof roleSchema>

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(320)
  .pipe(z.email('Enter a valid email address.'))

export const registerSchema = z.object({
  email: emailSchema,
  // Length over composition: 12 characters, no symbol theatre. See docs/security.md.
  password: z
    .string()
    .min(12, 'Use at least 12 characters.')
    .max(200, 'That password is too long.'),
  displayName: z.string().trim().min(1, 'Enter a name.').max(80),
})
export type RegisterRequest = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  email: emailSchema,
  // No length rule here — the login form must not describe the password policy.
  password: z.string().min(1, 'Enter your password.'),
})
export type LoginRequest = z.infer<typeof loginSchema>

export const publicUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  role: roleSchema,
  createdAt: z.iso.datetime(),
})
export type PublicUser = z.infer<typeof publicUserSchema>

export const publicProfileSchema = z.object({
  displayName: z.string(),
  preferredLanguage: languageSchema,
  experienceLevel: experienceLevelSchema,
  dailyGoalMinutes: z.number().int(),
  timezone: z.string(),
  currentStreak: z.number().int(),
  longestStreak: z.number().int(),
  onboardingCompletedAt: z.iso.datetime().nullable(),
})
export type PublicProfile = z.infer<typeof publicProfileSchema>

/**
 * What onboarding asks, and nothing it could not act on.
 *
 * Every field here changes something real: the language picks the starter
 * code, the experience level sets where the recommendation engine aims its
 * difficulty, the goal sizes the day. A question whose answer nothing reads is
 * a question that costs the user time for no reason.
 *
 * The timezone is detected by the browser rather than asked for — people do
 * not know their IANA name, and a wrong one moves their revision day.
 */
export const onboardingRequestSchema = z.object({
  experienceLevel: experienceLevelSchema,
  preferredLanguage: languageSchema,
  dailyGoalMinutes: z.number().int().min(10).max(240),
  timezone: z.string().min(1).max(64),
})
export type OnboardingRequest = z.infer<typeof onboardingRequestSchema>

/**
 * What register, login and refresh return.
 *
 * The refresh token is absent on purpose — it travels in an httpOnly cookie and
 * must never be readable from JavaScript.
 */
export const authSessionSchema = z.object({
  accessToken: z.string(),
  user: publicUserSchema,
  profile: publicProfileSchema,
})
export type AuthSession = z.infer<typeof authSessionSchema>

export const meSchema = z.object({
  user: publicUserSchema,
  profile: publicProfileSchema,
})
export type Me = z.infer<typeof meSchema>
