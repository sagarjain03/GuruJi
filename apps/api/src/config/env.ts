import { z } from 'zod'

/**
 * Every environment variable the API needs, and nothing it does not.
 *
 * A service that boots with half its configuration missing fails later, in
 * production, on a code path nobody was watching. This schema is checked before
 * the Nest application is created, so a missing variable is a startup crash
 * with the offending key named.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_GLOBAL_PREFIX: z.string().min(1).default('api'),

  // Comma-separated allow-list. No wildcard: credentials travel on these requests.
  CORS_ORIGINS: z.string().min(1),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Two different secrets on purpose: a leaked access secret must not let an
  // attacker mint refresh tokens.
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().min(1).default('15m'),
  JWT_REFRESH_TTL: z.string().min(1).default('30d'),

  /**
   * Shared with the code runner, and with nothing else.
   *
   * It authenticates the result callback — the one route that writes a verdict
   * without a user session behind it. Same minimum length as the JWT secrets:
   * a guessable one turns that route into "anybody can mark any submission
   * accepted".
   */
  CODE_RUNNER_SHARED_SECRET: z.string().min(32),

  GROQ_API_KEY: z.string().min(1).optional(),
  GROQ_FAST_MODEL: z.string().min(1).default('llama-3.1-8b-instant'),
  GROQ_QUALITY_MODEL: z.string().min(1).default('llama-3.3-70b-versatile'),

  // OWASP guidance, mirrored in docs/security.md.
  ARGON2_MEMORY_COST: z.coerce.number().int().positive().default(19456),
  ARGON2_TIME_COST: z.coerce.number().int().positive().default(2),
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source)

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${problems}`)
  }

  return result.data
}

/** `CORS_ORIGINS` is a comma-separated list; the server never accepts `*`. */
export function parseOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}
