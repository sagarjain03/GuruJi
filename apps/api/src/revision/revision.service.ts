import { Injectable } from '@nestjs/common'
import type { Prisma, RevisionOutcome as DbOutcome, RevisionState } from '@guruji/database'
import {
  dueAtFrom,
  firstSchedule,
  nextSchedule,
  onUnscheduledFailure,
  type RevisionOutcome,
  type RevisionSchedule,
} from './scheduler'

/** What the submission path tells the scheduler. */
export interface SubmissionForRevision {
  userId: string
  problemId: string
  submissionId: string
  verdict: string
  isRun: boolean
}

/**
 * Decides when a solved problem comes back.
 *
 * Runs **inside** the submission transaction, alongside the mastery counters.
 * Mastery moving while revision does not is a silent corruption of the learning
 * model — the score says you know it and nothing ever checks whether you still
 * do — so the two commit together or neither does.
 */
@Injectable()
export class RevisionService {
  /**
   * Called for every graded submission.
   *
   * Three things can happen, and doing nothing is one of them:
   *
   * - first accepted solve → a schedule is created, due tomorrow;
   * - failed attempt on something already scheduled → treated as a struggle,
   *   because the gap has just been demonstrated and waiting three weeks to act
   *   on information already in hand is the system being pedantic;
   * - anything else → nothing. A wrong answer on a problem never solved is
   *   Phase 5's business, not this one's.
   */
  async onSubmission(
    tx: Prisma.TransactionClient,
    submission: SubmissionForRevision,
    now = new Date(),
  ): Promise<void> {
    // `isRun` is exploration and `INTERNAL_ERROR` is our failure. Neither is
    // evidence about what the user remembers.
    if (submission.isRun || submission.verdict === 'INTERNAL_ERROR') {
      return
    }

    const existing = await tx.revisionItem.findUnique({
      where: {
        userId_problemId: { userId: submission.userId, problemId: submission.problemId },
      },
    })

    if (submission.verdict === 'ACCEPTED') {
      if (existing !== null) {
        // Already scheduled. A solve outside the queue is not a review — the
        // outcome has to be reported for that, and this is not it.
        return
      }

      const schedule = firstSchedule()
      await tx.revisionItem.create({
        data: {
          userId: submission.userId,
          problemId: submission.problemId,
          ...toRow(schedule),
          dueAt: dueAtFrom(now, schedule.intervalDays),
        },
      })
      return
    }

    if (existing === null) {
      return
    }

    const updated = onUnscheduledFailure(fromRow(existing))
    await tx.revisionItem.update({
      where: { id: existing.id },
      data: { ...toRow(updated), dueAt: dueAtFrom(now, updated.intervalDays) },
    })
  }

  /**
   * A review the user reported.
   *
   * The `RevisionReview` row is kept rather than folded into the item, because
   * `retention` in the mastery model is a rate over attempts — and a counter
   * that only moves forward cannot be recomputed from source, which is exactly
   * what the nightly reconciliation job needs to do.
   */
  async complete(
    tx: Prisma.TransactionClient,
    userId: string,
    itemId: string,
    outcome: RevisionOutcome,
    submissionId: string | null,
    now = new Date(),
  ): Promise<{ state: RevisionState; dueAt: Date } | null> {
    // Ownership in the `WHERE`, not a comparison after the read.
    const item = await tx.revisionItem.findFirst({ where: { id: itemId, userId } })
    if (item === null) {
      return null
    }

    const updated = nextSchedule(fromRow(item), outcome)

    await tx.revisionReview.create({
      data: {
        revisionItemId: item.id,
        ...(submissionId === null ? {} : { submissionId }),
        outcome: outcome as DbOutcome,
        // The interval that was in force when it came due, for auditing the
        // schedule after the fact.
        intervalDays: item.intervalDays,
      },
    })

    const dueAt = dueAtFrom(now, updated.intervalDays)
    await tx.revisionItem.update({
      where: { id: item.id },
      data: { ...toRow(updated), dueAt, lastReviewedAt: now },
    })

    await this.applyRetention(tx, userId, item.problemId, outcome)

    return { state: updated.state as RevisionState, dueAt }
  }

  /**
   * Revision outcomes are the `retention` component of mastery.
   *
   * This is the loop that makes the product more than a problem list: failing
   * revisions lowers topic mastery, which raises that topic's priority in
   * recommendations, which brings foundational practice back round.
   *
   * A struggle counts as an attempt but not a success — the answer arrived, the
   * recall did not.
   */
  private async applyRetention(
    tx: Prisma.TransactionClient,
    userId: string,
    problemId: string,
    outcome: RevisionOutcome,
  ): Promise<void> {
    const problem = await tx.problem.findUnique({
      where: { id: problemId },
      select: {
        topics: { select: { topicId: true } },
        patterns: { select: { patternId: true } },
      },
    })
    if (problem === null) {
      return
    }

    const success = outcome === 'SOLVED_EASILY' || outcome === 'SOLVED_WITH_EFFORT' ? 1 : 0
    const delta = {
      revisionAttempts: { increment: 1 },
      revisionSuccesses: { increment: success },
    }

    for (const { topicId } of problem.topics) {
      await tx.userTopicProgress.updateMany({ where: { userId, topicId }, data: delta })
    }
    for (const { patternId } of problem.patterns) {
      await tx.userPatternProgress.updateMany({ where: { userId, patternId }, data: delta })
    }
  }
}

/** The stored row, in the shape the pure scheduler understands. */
function fromRow(row: {
  intervalDays: number
  ease: number
  ladderIndex: number
  repetitions: number
  lapses: number
  streak: number
  state: RevisionState
}): RevisionSchedule {
  return {
    intervalDays: row.intervalDays,
    ease: row.ease,
    ladderIndex: row.ladderIndex,
    repetitions: row.repetitions,
    lapses: row.lapses,
    streak: row.streak,
    state: row.state,
  }
}

function toRow(schedule: RevisionSchedule) {
  return {
    intervalDays: schedule.intervalDays,
    ease: schedule.ease,
    ladderIndex: schedule.ladderIndex,
    repetitions: schedule.repetitions,
    lapses: schedule.lapses,
    streak: schedule.streak,
    state: schedule.state as RevisionState,
  }
}
