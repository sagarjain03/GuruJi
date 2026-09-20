import { z } from 'zod'
import { languageSchema } from './auth'
import { cursorQuerySchema } from './pagination'

/** docs/code-execution.md: code is capped at 64 KB before it reaches the queue. */
export const SUBMISSION_CODE_MAX = 64 * 1024

/** Per test case, and again for compiler output. */
export const OUTPUT_CAP_BYTES = 64 * 1024

export const submissionStatusSchema = z.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'])
export type SubmissionStatus = z.infer<typeof submissionStatusSchema>

export const verdictSchema = z.enum([
  'ACCEPTED',
  'WRONG_ANSWER',
  'TIME_LIMIT_EXCEEDED',
  'MEMORY_LIMIT_EXCEEDED',
  'RUNTIME_ERROR',
  'COMPILE_ERROR',
  'INTERNAL_ERROR',
])
export type Verdict = z.infer<typeof verdictSchema>

/**
 * `INTERNAL_ERROR` is ours, not the user's.
 *
 * Phase 5 reads this when it updates mastery: a submission that failed because
 * our runner broke must not look like the user getting the problem wrong, or it
 * corrupts mastery, reschedules revision and skews every recommendation after.
 */
export function countsAgainstAccuracy(verdict: Verdict | null, isRun: boolean): boolean {
  return !isRun && verdict !== null && verdict !== 'INTERNAL_ERROR'
}

export const submitRequestSchema = z.object({
  problemId: z.uuid(),
  language: languageSchema,
  code: z.string().max(SUBMISSION_CODE_MAX, 'That is too much code to submit.'),
  /** true runs the sample cases only; false grades against every case. */
  isRun: z.boolean(),
  timeSpentMs: z.number().int().min(0).max(24 * 60 * 60 * 1000).default(0),
  hintsUsedAtSubmit: z.number().int().min(0).max(100).default(0),
})
export type SubmitRequest = z.infer<typeof submitRequestSchema>

/** `POST /submissions` answers 202 with this and nothing else — the work is queued. */
export const submissionAcceptedSchema = z.object({
  id: z.uuid(),
  status: submissionStatusSchema,
})
export type SubmissionAccepted = z.infer<typeof submissionAcceptedSchema>

/**
 * One test case's outcome.
 *
 * `input`, `expectedOutput` and `actualOutput` are present **only for sample
 * cases**. A hidden case's actual output is the program's answer to a secret
 * input, which is most of the way to revealing the input itself.
 */
export const submissionResultSchema = z.object({
  index: z.number().int(),
  isSample: z.boolean(),
  passed: z.boolean(),
  runtimeMs: z.number().int().nullable(),
  memoryKb: z.number().int().nullable(),
  input: z.string().optional(),
  expectedOutput: z.string().optional(),
  actualOutput: z.string().optional(),
  errorMessage: z.string().optional(),
})
export type SubmissionResult = z.infer<typeof submissionResultSchema>

export const submissionSchema = z.object({
  id: z.uuid(),
  problemId: z.uuid(),
  language: languageSchema,
  status: submissionStatusSchema,
  verdict: verdictSchema.nullable(),
  runtimeMs: z.number().int().nullable(),
  memoryKb: z.number().int().nullable(),
  passedCount: z.number().int(),
  totalCount: z.number().int(),
  compileOutput: z.string().nullable(),
  isRun: z.boolean(),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
})
export type Submission = z.infer<typeof submissionSchema>

export const submissionDetailSchema = submissionSchema.extend({
  code: z.string(),
  results: z.array(submissionResultSchema),
})
export type SubmissionDetail = z.infer<typeof submissionDetailSchema>

export const submissionQuerySchema = cursorQuerySchema.extend({
  problemId: z.uuid().optional(),
})
export type SubmissionQuery = z.infer<typeof submissionQuerySchema>

/* -------------------------------------------------------------------------- */
/* Live updates                                                               */
/* -------------------------------------------------------------------------- */

/** Pushed while the job moves through the queue. */
export const submissionStatusEventSchema = z.object({
  submissionId: z.uuid(),
  status: submissionStatusSchema,
})
export type SubmissionStatusEvent = z.infer<typeof submissionStatusEventSchema>

/** Pushed once, when the verdict exists. */
export const submissionResultEventSchema = z.object({
  submissionId: z.uuid(),
  submission: submissionDetailSchema,
})
export type SubmissionResultEvent = z.infer<typeof submissionResultEventSchema>
