import { describe, expect, it } from 'vitest'
import { problemOutcome, problemState, scoreContest, shouldFinish, type ContestAttempt } from './scoring'

const START = new Date('2026-09-28T13:00:00.000Z')
const DEADLINE = new Date('2026-09-28T14:00:00.000Z')
const at = (minute: number) => new Date(START.getTime() + minute * 60_000)

function attempt(problemId: string, verdict: ContestAttempt['verdict'], minute: number): ContestAttempt {
  return { problemId, verdict, createdAt: at(minute) }
}

describe('problemOutcome', () => {
  it('solves on the first ACCEPTED made before the deadline and counts every real attempt', () => {
    const outcome = problemOutcome(
      [attempt('a', 'WRONG_ANSWER', 5), attempt('a', 'ACCEPTED', 20), attempt('a', 'ACCEPTED', 30)],
      DEADLINE,
    )

    expect(outcome).toEqual({ solved: true, attempts: 3, firstAcceptedAt: at(20) })
  })

  it('counts a submission made before the deadline even if it was judged after', () => {
    // `createdAt` is the moment of submission; judging time is not the learner's.
    expect(problemOutcome([attempt('a', 'ACCEPTED', 59.99)], DEADLINE).solved).toBe(true)
  })

  it('does not count an ACCEPTED made after the deadline', () => {
    expect(problemOutcome([attempt('a', 'ACCEPTED', 61)], DEADLINE)).toEqual({
      solved: false,
      attempts: 1,
      firstAcceptedAt: null,
    })
  })

  it('does not count a judge failure as an attempt — it is not the learner being wrong', () => {
    const outcome = problemOutcome([attempt('a', 'INTERNAL_ERROR', 5), attempt('a', 'WRONG_ANSWER', 6)], DEADLINE)

    expect(outcome.attempts).toBe(1)
  })

  it('counts a submission still being judged as an attempt, but not as a solve', () => {
    expect(problemOutcome([attempt('a', null, 10)], DEADLINE)).toEqual({ solved: false, attempts: 1, firstAcceptedAt: null })
  })
})

describe('problemState', () => {
  it('is UNSOLVED with no attempts, ATTEMPTED with some, SOLVED once accepted', () => {
    expect(problemState({ solved: false, attempts: 0, firstAcceptedAt: null })).toBe('UNSOLVED')
    expect(problemState({ solved: false, attempts: 2, firstAcceptedAt: null })).toBe('ATTEMPTED')
    expect(problemState({ solved: true, attempts: 2, firstAcceptedAt: at(9) })).toBe('SOLVED')
  })
})

describe('scoreContest', () => {
  it('adds the points of every problem solved before the deadline, with no penalty for wrong answers', () => {
    const problems = [
      { problemId: 'easy', points: 100 },
      { problemId: 'medium', points: 200 },
      { problemId: 'hard', points: 300 },
    ]
    const attempts = [
      attempt('easy', 'WRONG_ANSWER', 3),
      attempt('easy', 'WRONG_ANSWER', 4),
      attempt('easy', 'ACCEPTED', 8),
      attempt('hard', 'ACCEPTED', 65),
      attempt('medium', 'TIME_LIMIT_EXCEEDED', 30),
    ]

    expect(scoreContest(problems, attempts, DEADLINE)).toBe(100)
  })
})

describe('shouldFinish', () => {
  it('finishes an ACTIVE contest only once its deadline has passed', () => {
    expect(shouldFinish({ status: 'ACTIVE', deadlineAt: DEADLINE }, at(59))).toBe(false)
    expect(shouldFinish({ status: 'ACTIVE', deadlineAt: DEADLINE }, DEADLINE)).toBe(false)
    expect(shouldFinish({ status: 'ACTIVE', deadlineAt: DEADLINE }, at(61))).toBe(true)
  })

  it('leaves a finished contest alone — finishing is idempotent', () => {
    expect(shouldFinish({ status: 'FINISHED', deadlineAt: DEADLINE }, at(90))).toBe(false)
  })
})
