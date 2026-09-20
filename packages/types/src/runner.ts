import { z } from 'zod'
import { languageSchema } from './auth'
import { verdictSchema } from './submission'

/**
 * The contract between the API and the code runner.
 *
 * The runner is deliberately ignorant: a job carries code, limits and test
 * cases, and **nothing that identifies a user**. A compromised runner therefore
 * leaks nothing about who wrote what. See docs/code-execution.md.
 */
/**
 * The BullMQ queue both sides open. A literal typed twice is a literal that
 * eventually disagrees with itself, and the failure mode is a worker that sits
 * idle against a queue nobody is filling.
 */
export const SUBMISSION_QUEUE = 'submissions'

/** Attempts per job, then the dead-letter path. Kept here for the same reason. */
export const SUBMISSION_JOB_ATTEMPTS = 3

export const runnerTestCaseSchema = z.object({
  id: z.uuid(),
  input: z.string(),
  expectedOutput: z.string(),
})
export type RunnerTestCase = z.infer<typeof runnerTestCaseSchema>

export const runnerJobSchema = z.object({
  submissionId: z.uuid(),
  language: languageSchema,
  code: z.string(),
  timeLimitMs: z.number().int().positive(),
  memoryLimitMb: z.number().int().positive(),
  testCases: z.array(runnerTestCaseSchema).min(1),
})
export type RunnerJob = z.infer<typeof runnerJobSchema>

export const runnerResultSchema = z.object({
  testCaseId: z.uuid(),
  passed: z.boolean(),
  runtimeMs: z.number().int().nullable(),
  memoryKb: z.number().int().nullable(),
  actualOutput: z.string().nullable(),
  errorMessage: z.string().nullable(),
})
export type RunnerResult = z.infer<typeof runnerResultSchema>

/** What the runner posts back. The API is the only writer to the database. */
export const runnerCallbackSchema = z.object({
  submissionId: z.uuid(),
  verdict: verdictSchema,
  runtimeMs: z.number().int().nullable(),
  memoryKb: z.number().int().nullable(),
  compileOutput: z.string().nullable(),
  results: z.array(runnerResultSchema),
})
export type RunnerCallback = z.infer<typeof runnerCallbackSchema>

/** Header carrying the shared secret on that callback. */
export const RUNNER_SECRET_HEADER = 'x-runner-secret'
