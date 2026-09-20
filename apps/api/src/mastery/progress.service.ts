import { Injectable } from '@nestjs/common'
import type { Difficulty, Prisma } from '@guruji/database'
import { computeMastery, type MasteryCounters } from './mastery'
import { HINT_LEVEL_WEIGHTS } from './mastery-weights'

/** Everything a progress update needs to know about the submission that caused it. */
export interface GradedSubmission {
  userId: string
  problemId: string
  verdict: string
  isRun: boolean
  hintsUsedAtSubmit: number
  timeSpentMs: number
  /** Excluded from the id-based "have they been here before" checks. */
  submissionId: string
}

/** What changes about one (user, topic) or (user, pattern) row. */
interface CounterDelta {
  attempts: number
  solved: number
  firstAttemptSolved: number
  easyAttempts: number
  easySolved: number
  mediumAttempts: number
  mediumSolved: number
  hardAttempts: number
  hardSolved: number
  speedRatioSum: number
  speedSamples: number
  hintWeightedSolves: number
}

const NOTHING: CounterDelta = {
  attempts: 0,
  solved: 0,
  firstAttemptSolved: 0,
  easyAttempts: 0,
  easySolved: 0,
  mediumAttempts: 0,
  mediumSolved: 0,
  hardAttempts: 0,
  hardSolved: 0,
  speedRatioSum: 0,
  speedSamples: 0,
  hintWeightedSolves: 0,
}

/**
 * Keeps the mastery counters in step with what actually happened.
 *
 * Runs **inside** the submission-completion transaction, so a verdict and the
 * progress it implies land together or not at all. A separate write after the
 * fact is a write that can fail on its own, and the failure is invisible: the
 * user sees their verdict, the dashboard quietly disagrees with it forever.
 */
@Injectable()
export class ProgressService {
  /**
   * Nothing here counts twice, and nothing counts what it should not.
   *
   * `isRun` submissions never arrive — testing your thinking is not an attempt.
   * Neither does `INTERNAL_ERROR`: our runner breaking is not the user being
   * wrong, and recording it would corrupt every score downstream.
   */
  async apply(tx: Prisma.TransactionClient, submission: GradedSubmission): Promise<void> {
    if (submission.isRun || submission.verdict === 'INTERNAL_ERROR') {
      return
    }

    const problem = await tx.problem.findUnique({
      where: { id: submission.problemId },
      select: {
        difficulty: true,
        estimatedMinutes: true,
        topics: { select: { topicId: true } },
        patterns: { select: { patternId: true } },
      },
    })
    if (problem === null) {
      return
    }

    const history = await this.readHistory(tx, submission)
    const delta = this.deltaFor(problem.difficulty, problem.estimatedMinutes, submission, history)

    // Every counter would be zero: a repeat attempt at a problem already
    // solved. Nothing to write, and writing it would still touch `updatedAt`.
    if (delta === null) {
      return
    }

    for (const { topicId } of problem.topics) {
      await this.applyTopic(tx, submission.userId, topicId, delta)
    }
    for (const { patternId } of problem.patterns) {
      await this.applyPattern(tx, submission.userId, patternId, delta)
    }
  }

  /**
   * Was this problem new, and was it already solved?
   *
   * Both questions are about *problems*, not submissions. Someone who submits
   * the same problem eight times has attempted one problem, and a model that
   * counts eight rewards brute force — which is the habit this whole thing
   * exists to avoid encouraging.
   */
  private async readHistory(
    tx: Prisma.TransactionClient,
    submission: GradedSubmission,
  ): Promise<{ isFirstAttempt: boolean; alreadySolved: boolean }> {
    const previous = await tx.submission.findMany({
      where: {
        userId: submission.userId,
        problemId: submission.problemId,
        isRun: false,
        id: { not: submission.submissionId },
        // A submission our own infrastructure lost is not an attempt the user made.
        verdict: { not: 'INTERNAL_ERROR' },
        status: 'COMPLETED',
      },
      select: { verdict: true },
    })

    return {
      isFirstAttempt: previous.length === 0,
      alreadySolved: previous.some((row) => row.verdict === 'ACCEPTED'),
    }
  }

  private deltaFor(
    difficulty: Difficulty,
    estimatedMinutes: number,
    submission: GradedSubmission,
    history: { isFirstAttempt: boolean; alreadySolved: boolean },
  ): CounterDelta | null {
    const solvedNow = submission.verdict === 'ACCEPTED' && !history.alreadySolved

    if (!history.isFirstAttempt && !solvedNow) {
      return null
    }

    const attempt = history.isFirstAttempt ? 1 : 0
    const solve = solvedNow ? 1 : 0

    const delta: CounterDelta = {
      ...NOTHING,
      attempts: attempt,
      solved: solve,
      // The honest accuracy signal: right the first time, unprompted by a
      // previous failure on the same problem.
      firstAttemptSolved: history.isFirstAttempt && solvedNow ? 1 : 0,
    }

    if (difficulty === 'EASY') {
      delta.easyAttempts = attempt
      delta.easySolved = solve
    } else if (difficulty === 'MEDIUM') {
      delta.mediumAttempts = attempt
      delta.mediumSolved = solve
    } else {
      delta.hardAttempts = attempt
      delta.hardSolved = solve
    }

    if (solvedNow) {
      delta.speedRatioSum = speedRatio(submission.timeSpentMs, estimatedMinutes)
      delta.speedSamples = 1
      delta.hintWeightedSolves = hintWeight(submission.hintsUsedAtSubmit)
    }

    return delta
  }

  private async applyTopic(
    tx: Prisma.TransactionClient,
    userId: string,
    topicId: string,
    delta: CounterDelta,
  ): Promise<void> {
    const row = await tx.userTopicProgress.upsert({
      where: { userId_topicId: { userId, topicId } },
      create: { userId, topicId, ...delta, lastPracticedAt: new Date() },
      update: { ...increments(delta), lastPracticedAt: new Date() },
    })

    /*
     * Coverage is counted rather than incremented.
     *
     * "Distinct patterns solved in this topic" cannot be derived from a delta —
     * the problem just solved may share every pattern with one solved last
     * week. Recomputing it is a bounded query, and only on a solve, which is
     * the rarer event. Guessing at it would be cheaper and wrong.
     */
    const patternsSolved = delta.solved > 0 ? await countPatternsSolved(tx, userId, topicId) : row.patternsSolved
    const patternsAvailable = await countPatternsAvailable(tx, topicId)

    const score = computeMastery(toCounters(row, patternsSolved, patternsAvailable)).score

    await tx.userTopicProgress.update({
      where: { userId_topicId: { userId, topicId } },
      data: { patternsSolved, masteryScore: score },
    })
  }

  private async applyPattern(
    tx: Prisma.TransactionClient,
    userId: string,
    patternId: string,
    delta: CounterDelta,
  ): Promise<void> {
    const row = await tx.userPatternProgress.upsert({
      where: { userId_patternId: { userId, patternId } },
      create: { userId, patternId, ...delta, lastPracticedAt: new Date() },
      update: { ...increments(delta), lastPracticedAt: new Date() },
    })

    // A pattern row has no coverage of its own — coverage is a topic-level
    // idea, so the formula treats it as unmeasured and redistributes its weight.
    const score = computeMastery(toCounters(row, 0, 0)).score

    await tx.userPatternProgress.update({
      where: { userId_patternId: { userId, patternId } },
      data: { masteryScore: score },
    })
  }
}

/** Prisma's atomic `increment`, so two submissions landing together both count. */
function increments(delta: CounterDelta): Record<string, { increment: number }> {
  return Object.fromEntries(
    Object.entries(delta).map(([field, value]) => [field, { increment: value }]),
  )
}

async function countPatternsSolved(
  tx: Prisma.TransactionClient,
  userId: string,
  topicId: string,
): Promise<number> {
  const rows = await tx.problemPattern.findMany({
    where: {
      problem: {
        topics: { some: { topicId } },
        submissions: { some: { userId, verdict: 'ACCEPTED', isRun: false } },
      },
    },
    select: { patternId: true },
    distinct: ['patternId'],
  })
  return rows.length
}

async function countPatternsAvailable(
  tx: Prisma.TransactionClient,
  topicId: string,
): Promise<number> {
  const rows = await tx.problemPattern.findMany({
    where: { problem: { topics: { some: { topicId } } } },
    select: { patternId: true },
    distinct: ['patternId'],
  })
  return rows.length
}

/** The stored row, in the shape the pure formula expects. */
function toCounters(
  row: {
    attempts: number
    solved: number
    firstAttemptSolved: number
    revisionAttempts: number
    revisionSuccesses: number
    easyAttempts: number
    easySolved: number
    mediumAttempts: number
    mediumSolved: number
    hardAttempts: number
    hardSolved: number
    speedRatioSum: number
    speedSamples: number
    hintWeightedSolves: number
  },
  patternsSolved: number,
  patternsAvailable: number,
): MasteryCounters {
  return { ...row, patternsSolved, patternsAvailable }
}

/**
 * How the time taken compares with what the problem was expected to take.
 *
 * Clamped per problem before it is ever averaged, so a tab left open overnight
 * costs exactly one bad sample instead of poisoning the mean. A self-reported
 * zero means the client did not measure it — not that it was instant — so it
 * contributes the neutral 1 rather than a free maximum.
 */
function speedRatio(timeSpentMs: number, estimatedMinutes: number): number {
  if (timeSpentMs <= 0 || estimatedMinutes <= 0) {
    return 1
  }
  const takenMinutes = timeSpentMs / 60_000
  return Math.min(1, Math.max(0, estimatedMinutes / takenMinutes))
}

/** Level 1 is a nudge, level 4 is most of the answer. They are not the same. */
function hintWeight(hintsUsed: number): number {
  const index = Math.min(Math.max(hintsUsed, 0), HINT_LEVEL_WEIGHTS.length - 1)
  return HINT_LEVEL_WEIGHTS[index] ?? 1
}
