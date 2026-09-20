import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { prisma, type Difficulty } from '@guruji/database'
import { computeMastery, hintWeight, speedRatio, type MasteryCounters } from './mastery'

/** One counter that does not match what the submissions say. */
export interface Drift {
  userId: string
  topicId: string
  field: string
  stored: number
  recomputed: number
}

/** Floats are summed, so an exact comparison would report noise as a bug. */
const TOLERANCE = 0.001

/**
 * Recomputes mastery from source and **reports** what disagrees.
 *
 * It does not correct anything, and that is the whole design. The counters are
 * written inside the submission transaction, so a drift cannot be a lost race —
 * it means some write path reached the database without going through that
 * transaction. Silently repairing the number would leave that path in place and
 * remove the only evidence it exists.
 *
 * So: a drift is a bug report, logged at `error`, with enough in it to find the
 * write that caused it.
 */
@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name)

  /**
   * Nightly, in UTC.
   *
   * Every timestamp in this system is UTC, and a job scheduled in local time
   * fires twice or not at all on the two days a year the clocks move. See
   * docs/architecture.md.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM, { timeZone: 'UTC' })
  async nightly(): Promise<void> {
    const drifts = await this.reconcileAll()

    if (drifts.length === 0) {
      this.logger.log('mastery reconciliation: no drift')
      return
    }

    // Loud on purpose. Anything here means a write path is bypassing the
    // submission transaction, and the wrong number on a dashboard is the least
    // of what that implies.
    this.logger.error(
      { count: drifts.length, drifts: drifts.slice(0, 50) },
      'mastery reconciliation found drift — a write path is bypassing the submission transaction',
    )
  }

  /** Exposed so the job can be exercised directly rather than by waiting for 3am. */
  async reconcileAll(): Promise<Drift[]> {
    const rows = await prisma.userTopicProgress.findMany({
      select: { userId: true, topicId: true },
    })

    const drifts: Drift[] = []
    for (const row of rows) {
      drifts.push(...(await this.reconcile(row.userId, row.topicId)))
    }
    return drifts
  }

  async reconcile(userId: string, topicId: string): Promise<Drift[]> {
    const stored = await prisma.userTopicProgress.findUnique({
      where: { userId_topicId: { userId, topicId } },
    })
    if (stored === null) {
      return []
    }

    const truth = await this.recompute(userId, topicId)

    const compare: [string, number, number][] = [
      ['attempts', stored.attempts, truth.attempts],
      ['solved', stored.solved, truth.solved],
      ['firstAttemptSolved', stored.firstAttemptSolved, truth.firstAttemptSolved],
      ['easyAttempts', stored.easyAttempts, truth.easyAttempts],
      ['easySolved', stored.easySolved, truth.easySolved],
      ['mediumAttempts', stored.mediumAttempts, truth.mediumAttempts],
      ['mediumSolved', stored.mediumSolved, truth.mediumSolved],
      ['hardAttempts', stored.hardAttempts, truth.hardAttempts],
      ['hardSolved', stored.hardSolved, truth.hardSolved],
      ['patternsSolved', stored.patternsSolved, truth.patternsSolved],
      ['speedRatioSum', stored.speedRatioSum, truth.speedRatioSum],
      ['speedSamples', stored.speedSamples, truth.speedSamples],
      ['hintWeightedSolves', stored.hintWeightedSolves, truth.hintWeightedSolves],
      ['masteryScore', stored.masteryScore, computeMastery(truth).score],
    ]

    return compare
      .filter(([, storedValue, recomputed]) => Math.abs(storedValue - recomputed) > TOLERANCE)
      .map(([field, storedValue, recomputed]) => ({
        userId,
        topicId,
        field,
        stored: storedValue,
        recomputed,
      }))
  }

  /**
   * The counters as the submission history says they should be.
   *
   * Grouped in memory rather than in SQL. The aggregate is per *problem* —
   * first attempt, first solve — which is a window function in SQL and a `Map`
   * here, and the job runs once a night on one user's history at a time.
   */
  private async recompute(userId: string, topicId: string): Promise<MasteryCounters> {
    const submissions = await prisma.submission.findMany({
      where: {
        userId,
        isRun: false,
        status: 'COMPLETED',
        // Our failure is not the user's history.
        verdict: { not: 'INTERNAL_ERROR' },
        problem: { topics: { some: { topicId } } },
      },
      select: {
        problemId: true,
        verdict: true,
        createdAt: true,
        hintsUsedAtSubmit: true,
        timeSpentMs: true,
        problem: { select: { difficulty: true, estimatedMinutes: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    const byProblem = new Map<string, (typeof submissions)[number][]>()
    for (const submission of submissions) {
      const bucket = byProblem.get(submission.problemId) ?? []
      bucket.push(submission)
      byProblem.set(submission.problemId, bucket)
    }

    const counters: MasteryCounters = {
      attempts: 0,
      solved: 0,
      firstAttemptSolved: 0,
      revisionAttempts: 0,
      revisionSuccesses: 0,
      easyAttempts: 0,
      easySolved: 0,
      mediumAttempts: 0,
      mediumSolved: 0,
      hardAttempts: 0,
      hardSolved: 0,
      patternsSolved: 0,
      patternsAvailable: 0,
      speedRatioSum: 0,
      speedSamples: 0,
      hintWeightedSolves: 0,
    }

    for (const attempts of byProblem.values()) {
      const first = attempts[0]
      if (first === undefined) {
        continue
      }
      const solve = attempts.find((attempt) => attempt.verdict === 'ACCEPTED')
      const difficulty = first.problem.difficulty

      counters.attempts += 1
      addDifficulty(counters, difficulty, 'attempt')

      if (first.verdict === 'ACCEPTED') {
        counters.firstAttemptSolved += 1
      }

      if (solve !== undefined) {
        counters.solved += 1
        addDifficulty(counters, difficulty, 'solve')
        counters.speedRatioSum += speedRatio(solve.timeSpentMs, solve.problem.estimatedMinutes)
        counters.speedSamples += 1
        counters.hintWeightedSolves += hintWeight(solve.hintsUsedAtSubmit)
      }
    }

    counters.patternsSolved = await countDistinctPatterns(userId, topicId, true)
    counters.patternsAvailable = await countDistinctPatterns(userId, topicId, false)

    return counters
  }
}

function addDifficulty(
  counters: MasteryCounters,
  difficulty: Difficulty,
  kind: 'attempt' | 'solve',
): void {
  if (difficulty === 'EASY') {
    if (kind === 'attempt') counters.easyAttempts += 1
    else counters.easySolved += 1
  } else if (difficulty === 'MEDIUM') {
    if (kind === 'attempt') counters.mediumAttempts += 1
    else counters.mediumSolved += 1
  } else {
    if (kind === 'attempt') counters.hardAttempts += 1
    else counters.hardSolved += 1
  }
}

async function countDistinctPatterns(
  userId: string,
  topicId: string,
  solvedOnly: boolean,
): Promise<number> {
  const rows = await prisma.problemPattern.findMany({
    where: {
      problem: {
        topics: { some: { topicId } },
        ...(solvedOnly
          ? { submissions: { some: { userId, verdict: 'ACCEPTED', isRun: false } } }
          : {}),
      },
    },
    select: { patternId: true },
    distinct: ['patternId'],
  })
  return rows.length
}

