import type { ContestProblemState, ContestStatus, Verdict } from '@guruji/types'

/**
 * What counts in a contest. Pure: the service reads the rows, this decides.
 *
 * The moment that matters is `createdAt` — when the learner pressed Submit —
 * not when the judge finished. Judging time is ours, not theirs.
 */

export interface ContestAttempt {
  problemId: string
  /** Null while the submission is still being judged. */
  verdict: Verdict | null
  createdAt: Date
}

export interface ProblemOutcome {
  solved: boolean
  /** Graded attempts. A judge failure is our fault, not an attempt. */
  attempts: number
  firstAcceptedAt: Date | null
}

export function problemOutcome(attempts: ContestAttempt[], deadlineAt: Date): ProblemOutcome {
  const real = attempts.filter((attempt) => attempt.verdict !== 'INTERNAL_ERROR')
  const accepted = real
    .filter((attempt) => attempt.verdict === 'ACCEPTED' && attempt.createdAt.getTime() <= deadlineAt.getTime())
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  const first = accepted[0]

  return { solved: first !== undefined, attempts: real.length, firstAcceptedAt: first?.createdAt ?? null }
}

export function problemState(outcome: ProblemOutcome): ContestProblemState {
  if (outcome.solved) return 'SOLVED'
  return outcome.attempts > 0 ? 'ATTEMPTED' : 'UNSOLVED'
}

/** Points of every problem solved in time. Wrong answers cost nothing. */
export function scoreContest(
  problems: { problemId: string; points: number }[],
  attempts: ContestAttempt[],
  deadlineAt: Date,
): number {
  return problems.reduce((total, problem) => {
    const outcome = problemOutcome(
      attempts.filter((attempt) => attempt.problemId === problem.problemId),
      deadlineAt,
    )
    return outcome.solved ? total + problem.points : total
  }, 0)
}

/**
 * Whether a contest has run out of time and should be finished now. There is
 * no background job: the next read or write finishes it, so the answer only
 * has to be right when someone asks.
 */
export function shouldFinish(contest: { status: ContestStatus; deadlineAt: Date }, now: Date): boolean {
  return contest.status === 'ACTIVE' && now.getTime() > contest.deadlineAt.getTime()
}
