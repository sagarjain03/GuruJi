import { z } from 'zod'

/**
 * Stable, machine-readable error codes. The client branches on these; the
 * `message` is for humans and may change without warning.
 */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'EMAIL_ALREADY_REGISTERED',
  'INVALID_CREDENTIALS',
  'REFRESH_TOKEN_INVALID',
  'PROBLEM_NOT_FOUND',
  'TOPIC_NOT_FOUND',
  'INVALID_CURSOR',
  'INVALID_RANGE',
  'CONTEST_UNAVAILABLE',
  'CONTEST_ALREADY_ACTIVE',
  'CONTEST_ENDED',
  'CONTEST_NOT_FINISHED',
  'PROBLEM_NOT_IN_CONTEST',
  'CONTEST_HINTS_DISABLED',
  'PASSWORD_TOO_COMMON',
] as const

export const errorCodeSchema = z.enum(ERROR_CODES)
export type ErrorCode = z.infer<typeof errorCodeSchema>

/** Every error response on the API has this shape, produced by one filter. */
export const errorEnvelopeSchema = z.object({
  error: z.object({
    // Unknown codes are possible as the API grows; the client must not explode.
    code: z.string(),
    message: z.string(),
    details: z.unknown().nullable(),
    requestId: z.string(),
  }),
})

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>
