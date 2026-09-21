import { HttpStatus, Injectable } from '@nestjs/common'
import { prisma, type Language, type Prisma } from '@guruji/database'
import {
  OUTPUT_CAP_BYTES,
  type Paginated,
  type RunnerCallback,
  type Submission,
  type SubmissionAccepted,
  type SubmissionDetail,
  type SubmissionResult,
  type SubmitRequest,
} from '@guruji/types'
import { AppError, NotFoundError } from '../common/app-error'
import { RateLimitService } from '../auth/rate-limit.service'
import { decodeCursor, encodeCursor } from '../content/cursor'
import { ProgressService } from '../mastery/progress.service'
import { RecommendationsService } from '../recommendations/recommendations.service'
import { RevisionService } from '../revision/revision.service'
import { SubmissionQueueService } from './submission-queue.service'

/** docs/api.md — ten a minute per user, counted in Redis so it holds across instances. */
const SUBMIT_LIMIT = 10
const SUBMIT_WINDOW_MS = 60_000

/** The verdict, plus the one thing the runner is never told: whose it is. */
export interface RecordedResult {
  userId: string
  submission: SubmissionDetail
}

const SUBMISSION_SELECT = {
  id: true,
  problemId: true,
  language: true,
  status: true,
  verdict: true,
  runtimeMs: true,
  memoryKb: true,
  passedCount: true,
  totalCount: true,
  compileOutput: true,
  isRun: true,
  createdAt: true,
  completedAt: true,
} as const

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly queue: SubmissionQueueService,
    private readonly rateLimit: RateLimitService,
    private readonly progress: ProgressService,
    private readonly revision: RevisionService,
    private readonly recommendations: RecommendationsService,
  ) {}

  /**
   * Validate, persist, enqueue — in that order, and nothing else.
   *
   * The response is a 202 with an id. The verdict arrives over the WebSocket,
   * because a request that waits for a container to compile C++ is a request
   * that holds a handler for twenty seconds.
   */
  async submit(userId: string, request: SubmitRequest): Promise<SubmissionAccepted> {
    await this.rateLimit.hit(`ratelimit:submit:${userId}`, SUBMIT_LIMIT, SUBMIT_WINDOW_MS)

    const problem = await prisma.problem.findFirst({
      where: { id: request.problemId, reviewStatus: 'PUBLISHED' },
      select: { id: true, timeLimitMs: true, memoryLimitMb: true },
    })
    if (problem === null) {
      throw new NotFoundError('PROBLEM_NOT_FOUND', 'That problem does not exist.')
    }

    // Run grades the samples only; Submit grades everything. The distinction is
    // made here, from the database, rather than trusted from the request.
    const testCases = await prisma.testCase.findMany({
      where: { problemId: problem.id, ...(request.isRun ? { isSample: true } : {}) },
      select: { id: true, input: true, expectedOutput: true },
      orderBy: { displayOrder: 'asc' },
    })

    if (testCases.length === 0) {
      throw new AppError(
        'NO_TEST_CASES',
        'That problem has no test cases to run against yet.',
        HttpStatus.CONFLICT,
      )
    }

    const hintsUsedAtSubmit = await prisma.aIMessage.count({
      where: {
        role: 'ASSISTANT',
        mode: 'HINT',
        conversation: { userId, problemId: problem.id },
      },
    })

    const submission = await prisma.submission.create({
      data: {
        // From the verified token, never from the body.
        userId,
        problemId: problem.id,
        language: request.language,
        // Its own copy of the code: editing the draft afterwards must not
        // rewrite the history of what was actually judged.
        code: request.code,
        isRun: request.isRun,
        totalCount: testCases.length,
        timeSpentMs: request.timeSpentMs,
        // The browser's counter is advisory only. Mastery uses the persisted
        // mentor history so a client cannot claim it solved without hints.
        hintsUsedAtSubmit,
      },
      select: { id: true, status: true },
    })

    /*
     * The job carries no user id. A compromised runner therefore learns what
     * code ran, but not whose it was — see docs/code-execution.md.
     */
    await this.queue.enqueue({
      submissionId: submission.id,
      language: request.language,
      code: request.code,
      timeLimitMs: problem.timeLimitMs,
      memoryLimitMb: problem.memoryLimitMb,
      testCases,
    })

    return { id: submission.id, status: submission.status }
  }

  /** Ownership is a WHERE clause, not a comparison after the read. */
  async findOne(userId: string, id: string): Promise<SubmissionDetail> {
    const row = await prisma.submission.findFirst({
      where: { id, userId },
      select: {
        ...SUBMISSION_SELECT,
        code: true,
        results: {
          select: {
            passed: true,
            runtimeMs: true,
            memoryKb: true,
            actualOutput: true,
            errorMessage: true,
            testCase: {
              select: { input: true, expectedOutput: true, isSample: true, displayOrder: true },
            },
          },
          orderBy: { testCase: { displayOrder: 'asc' } },
        },
      },
    })

    if (row === null) {
      throw new NotFoundError('SUBMISSION_NOT_FOUND', 'That submission does not exist.')
    }

    return {
      ...this.toWire(row),
      code: row.code,
      results: row.results.map((result, index) => this.resultToWire(result, index)),
    }
  }

  async list(
    userId: string,
    query: { cursor?: string; limit: number; problemId?: string },
  ): Promise<Paginated<Submission>> {
    const cursor = query.cursor === undefined ? null : decodeCursor(query.cursor)

    const where: Prisma.SubmissionWhereInput = {
      userId,
      ...(query.problemId === undefined ? {} : { problemId: query.problemId }),
      ...(cursor === null
        ? {}
        : {
            OR: [
              { createdAt: { lt: new Date(cursor.createdAt) } },
              { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
            ],
          }),
    }

    // One extra row answers "is there another page" without a second count query.
    const rows = await prisma.submission.findMany({
      where,
      select: SUBMISSION_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    })

    const hasMore = rows.length > query.limit
    const page = hasMore ? rows.slice(0, query.limit) : rows
    const last = page.at(-1)

    return {
      items: page.map((row) => this.toWire(row)),
      nextCursor:
        hasMore && last !== undefined
          ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : null,
      hasMore,
    }
  }

  /**
   * The runner's verdict, written in one transaction.
   *
   * Results and the parent row move together: a crash between them would leave
   * a submission that says ACCEPTED with no test results behind it, and there
   * is no way to tell afterwards whether that was a bug or a real run.
   */
  async recordResult(payload: RunnerCallback): Promise<RecordedResult | null> {
    const submission = await prisma.submission.findUnique({
      where: { id: payload.submissionId },
      select: { id: true, userId: true, status: true },
    })

    // An unknown id is not an error worth 500-ing over: it is what a retried
    // callback for a deleted submission looks like.
    if (submission === null) {
      return null
    }
    // BullMQ retries at-least-once, so the same verdict can arrive twice. The
    // second one is dropped rather than re-written: rewriting would move
    // completedAt and push a second result event for a submission the browser
    // already has.
    if (submission.status === 'COMPLETED' || submission.status === 'FAILED') {
      return null
    }

    const passedCount = payload.results.filter((result) => result.passed).length
    const internal = payload.verdict === 'INTERNAL_ERROR'

    /*
     * Interactive rather than an array of writes, because the progress update
     * has to *read* — whether this problem has been attempted before, and
     * whether it was already solved — and those reads must see the same world
     * the writes do.
     *
     * Everything below lands together or not at all. Mastery written outside
     * this boundary is mastery that can fail on its own, invisibly: the user
     * sees their verdict and the dashboard quietly disagrees with it forever.
     */
    await prisma.$transaction(async (tx) => {
      await tx.submissionResult.deleteMany({ where: { submissionId: payload.submissionId } })
      await tx.submissionResult.createMany({
        data: payload.results.map((result) => ({
          submissionId: payload.submissionId,
          testCaseId: result.testCaseId,
          passed: result.passed,
          runtimeMs: result.runtimeMs,
          memoryKb: result.memoryKb,
          // Capped again at write time. The runner caps at the source, and this
          // is the column that would otherwise hold whatever got past it.
          actualOutput: truncate(result.actualOutput),
          errorMessage: truncate(result.errorMessage),
        })),
      })

      const updated = await tx.submission.update({
        where: { id: payload.submissionId },
        data: {
          // FAILED alongside an INTERNAL_ERROR verdict is what "our runner
          // broke" looks like in the database. Phase 5 reads this rather than
          // treating every finished submission as a judgement of the user.
          status: internal ? 'FAILED' : 'COMPLETED',
          verdict: payload.verdict,
          runtimeMs: payload.runtimeMs,
          memoryKb: payload.memoryKb,
          compileOutput: truncate(payload.compileOutput),
          passedCount,
          completedAt: new Date(),
        },
        select: {
          id: true,
          userId: true,
          problemId: true,
          verdict: true,
          isRun: true,
          hintsUsedAtSubmit: true,
          timeSpentMs: true,
        },
      })

      await this.progress.apply(tx, {
        submissionId: updated.id,
        userId: updated.userId,
        problemId: updated.problemId,
        verdict: updated.verdict ?? 'INTERNAL_ERROR',
        isRun: updated.isRun,
        hintsUsedAtSubmit: updated.hintsUsedAtSubmit,
        timeSpentMs: updated.timeSpentMs,
      })

      /*
       * Scheduling rides in the same transaction as the counters.
       *
       * Mastery moving while revision does not is a silent corruption of the
       * learning model: the score says you know it, and nothing is ever
       * scheduled to check whether you still do. The two commit together or
       * neither does.
       */
      await this.revision.onSubmission(tx, {
        submissionId: updated.id,
        userId: updated.userId,
        problemId: updated.problemId,
        verdict: updated.verdict ?? 'INTERNAL_ERROR',
        isRun: updated.isRun,
      })
    })

    /*
     * Outside the transaction, and on purpose.
     *
     * This is a cache drop, not a write anyone depends on being atomic — and a
     * Redis hiccup must not roll back a verdict that was correctly judged. The
     * cost of it failing is fifteen minutes of a slightly stale suggestion; the
     * cost of it being inside is losing the submission.
     */
    await this.recommendations.invalidate(submission.userId)

    return {
      userId: submission.userId,
      submission: await this.findOne(submission.userId, submission.id),
    }
  }

  /** Who to push the WebSocket event to. The runner never learns this. */
  async ownerOf(submissionId: string): Promise<string | null> {
    const row = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: { userId: true },
    })
    return row?.userId ?? null
  }

  async markRunning(submissionId: string): Promise<void> {
    await prisma.submission.updateMany({
      // Only from QUEUED: a retry that starts after the verdict landed must not
      // drag a finished submission back to RUNNING.
      where: { id: submissionId, status: 'QUEUED' },
      data: { status: 'RUNNING' },
    })
  }

  private toWire(row: {
    id: string
    problemId: string
    language: Language
    status: string
    verdict: string | null
    runtimeMs: number | null
    memoryKb: number | null
    passedCount: number
    totalCount: number
    compileOutput: string | null
    isRun: boolean
    createdAt: Date
    completedAt: Date | null
  }): Submission {
    return {
      id: row.id,
      problemId: row.problemId,
      language: row.language,
      status: row.status as Submission['status'],
      verdict: row.verdict as Submission['verdict'],
      runtimeMs: row.runtimeMs,
      memoryKb: row.memoryKb,
      passedCount: row.passedCount,
      totalCount: row.totalCount,
      compileOutput: row.compileOutput,
      isRun: row.isRun,
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
    }
  }

  /**
   * A hidden case gives up its pass/fail and its timings, and nothing else.
   *
   * Its input, its expected output and the program's answer to it are each most
   * of the way to revealing the secret input — which is the whole value of
   * having hidden cases at all.
   */
  private resultToWire(
    row: {
      passed: boolean
      runtimeMs: number | null
      memoryKb: number | null
      actualOutput: string | null
      errorMessage: string | null
      testCase: { input: string; expectedOutput: string; isSample: boolean }
    },
    index: number,
  ): SubmissionResult {
    const base: SubmissionResult = {
      index,
      isSample: row.testCase.isSample,
      passed: row.passed,
      runtimeMs: row.runtimeMs,
      memoryKb: row.memoryKb,
    }

    if (!row.testCase.isSample) {
      return base
    }

    return {
      ...base,
      input: row.testCase.input,
      expectedOutput: row.testCase.expectedOutput,
      ...(row.actualOutput === null ? {} : { actualOutput: row.actualOutput }),
      ...(row.errorMessage === null ? {} : { errorMessage: row.errorMessage }),
    }
  }
}

function truncate(value: string | null): string | null {
  return value === null ? null : value.slice(0, OUTPUT_CAP_BYTES)
}
