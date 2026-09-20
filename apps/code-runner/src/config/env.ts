import { z } from 'zod'

/**
 * What the runner is allowed to know.
 *
 * There is deliberately no `DATABASE_URL` and no `GROQ_API_KEY` here. The
 * runner is the component we assume will be compromised, so it holds no
 * credential that reaches anything holding user data — results go back through
 * an authenticated callback to the API, which is the only writer. See
 * docs/code-execution.md.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  REDIS_URL: z.string().min(1),

  /** Where the callback goes. Internal address, never a public one. */
  API_INTERNAL_URL: z.string().min(1).default('http://localhost:4000'),
  API_GLOBAL_PREFIX: z.string().min(1).default('api'),
  CODE_RUNNER_SHARED_SECRET: z.string().min(32),

  /**
   * Containers in flight at once. At 256 MB each this is bounded by host
   * memory long before it is bounded by CPU — 4 is the ceiling on the 3.9 GB
   * development host before it swaps.
   */
  CODE_RUNNER_MAX_CONCURRENCY: z.coerce.number().int().positive().max(64).default(4),

  /** Ceiling on a problem's own limit, not a replacement for it. */
  CODE_RUNNER_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  CODE_RUNNER_MEMORY_MB: z.coerce.number().int().positive().default(256),
  /** A template-heavy C++ file is genuinely slow. Still bounded. */
  COMPILE_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),

  SANDBOX_IMAGE_PREFIX: z.string().min(1).default('guruji-sandbox'),
  SANDBOX_IMAGE_TAG: z.string().min(1).default('1'),

  /** How long a sandbox container may exist before the reaper takes it. */
  REAPER_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  REAPER_MAX_AGE_MS: z.coerce.number().int().positive().default(120_000),
})

export type RunnerEnv = z.infer<typeof envSchema>

export function loadEnv(source: NodeJS.ProcessEnv = process.env): RunnerEnv {
  const result = envSchema.safeParse(source)

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${problems}`)
  }

  return result.data
}
