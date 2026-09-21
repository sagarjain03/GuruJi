import { describe, expect, it } from 'vitest'
import { decideActivity, diversify, explain, MAX_PER_TOPIC } from './ranking'
import { scoreCandidate, type Candidate, type UserContext } from './scoring'

/**
 * Every behaviour the product spec names, asserted directly.
 *
 * The engine is the difference between "this app knows what I am weak at" and
 * "another website with DSA questions", and the difference is entirely in these
 * orderings. They are pure functions precisely so that the claim can be checked
 * rather than hoped for.
 */

const CONTEXT: UserContext = {
  averageMastery: 50,
  topicMastery: new Map([
    ['arrays', 80],
    ['graphs', 20],
    ['trees', 50],
  ]),
  patternAttempts: new Map([
    ['two-pointer', 10],
    ['bfs', 0],
  ]),
  difficultyTolerance: 0.35,
  blockedTopicIds: new Set(),
  recentlyRecommended: new Set(),
  coldStart: false,
}

function context(overrides: Partial<UserContext> = {}): UserContext {
  return { ...CONTEXT, ...overrides }
}

let counter = 0
function candidate(overrides: Partial<Candidate> = {}): Candidate {
  counter += 1
  return {
    problemId: `p${String(counter)}`,
    slug: `problem-${String(counter)}`,
    title: `Problem ${String(counter)}`,
    difficulty: 'MEDIUM',
    topicIds: ['trees'],
    patternIds: [],
    kind: 'NEW_PROBLEM',
    solved: false,
    dismissals: 0,
    ...overrides,
  }
}

const scoreOf = (c: Candidate, ctx = CONTEXT): number => scoreCandidate(c, ctx).score

describe('scoring', () => {
  it('ranks a weak topic above a strong one, all else equal', () => {
    const weak = scoreOf(candidate({ topicIds: ['graphs'] }))
    const strong = scoreOf(candidate({ topicIds: ['arrays'] }))

    expect(weak).toBeGreaterThan(strong)
  })

  it('measures weakness against the user, not an absolute bar', () => {
    /*
     * A strong user still has a weakest topic, and still deserves targeted
     * practice. An absolute threshold would tell them everything is fine and
     * quietly stop training them.
     */
    const strongUser = context({
      averageMastery: 85,
      topicMastery: new Map([['graphs', 70]]),
    })

    const signal = scoreCandidate(candidate({ topicIds: ['graphs'] }), strongUser).breakdown
      .weaknessSignal

    expect(signal).toBeGreaterThan(0)
  })

  it('does not treat an untouched topic as a weakness', () => {
    // No score yet is not evidence of trouble. Reading it as zero would make
    // every topic nobody has opened look like the most urgent thing here.
    const signal = scoreCandidate(candidate({ topicIds: ['unseen'] }), CONTEXT).breakdown
      .weaknessSignal

    expect(signal).toBe(0)
  })

  it('ranks a recently solved problem below an equivalent unsolved one', () => {
    const shape = { topicIds: ['trees'], difficulty: 'MEDIUM' as const }

    const unsolved = scoreOf(candidate(shape))
    const solved = scoreOf(candidate({ ...shape, solved: true, lastAttemptedDaysAgo: 1 }))

    expect(solved).toBeLessThan(unsolved)
  })

  it('puts a failed revision above new material', () => {
    const lapsed = scoreOf(
      candidate({
        kind: 'REVISION',
        revision: { overdueDays: 2, state: 'LAPSED' },
        solved: true,
      }),
    )
    const fresh = scoreOf(candidate({ topicIds: ['graphs'] }))

    // Retention is the scarcer resource: solving something new while four
    // solved problems fade is a net loss.
    expect(lapsed).toBeGreaterThan(fresh)
  })

  it('puts a lapsed revision above an equally overdue healthy one', () => {
    const lapsed = scoreOf(
      candidate({ revision: { overdueDays: 3, state: 'LAPSED' }, solved: true }),
    )
    const due = scoreOf(
      candidate({ revision: { overdueDays: 3, state: 'REVIEWING' }, solved: true }),
    )

    expect(lapsed).toBeGreaterThan(due)
  })

  it('adapts difficulty upward as tolerance rises', () => {
    const beginner = context({ difficultyTolerance: 0.1 })
    const advanced = context({ difficultyTolerance: 0.85 })

    const hard = candidate({ difficulty: 'HARD' })
    const easy = candidate({ difficulty: 'EASY' })

    // The target sits just above current ability — where growth happens, and
    // where the mastery signal is most informative.
    expect(scoreOf(easy, beginner)).toBeGreaterThan(scoreOf(hard, beginner))
    expect(scoreOf(hard, advanced)).toBeGreaterThan(scoreOf(easy, advanced))
  })

  it('scores an unmet prerequisite at exactly zero, not merely low', () => {
    const blocked = context({ blockedTopicIds: new Set(['graphs']) })
    const result = scoreCandidate(
      // Everything else about this is maximally attractive.
      candidate({
        topicIds: ['graphs'],
        patternIds: ['bfs'],
        revision: { overdueDays: 30, state: 'LAPSED' },
      }),
      blocked,
    )

    /*
     * A gate, applied as a gate. Recommending graph traversal to someone who
     * has not met trees is not a slightly worse suggestion, it is a wrong one —
     * and a soft weight lets a strong signal elsewhere outvote it.
     */
    expect(result.score).toBe(0)
  })

  it('penalises a problem shown in the last few batches', () => {
    const shown = context({ recentlyRecommended: new Set(['repeat']) })

    const repeated = scoreOf(candidate({ problemId: 'repeat' }), shown)
    const fresh = scoreOf(candidate({ problemId: 'other' }), shown)

    expect(repeated).toBeLessThan(fresh)
  })

  it('does not penalise a due revision for having been seen lately', () => {
    const shown = context({ recentlyRecommended: new Set(['due-item']) })

    const penalty = scoreCandidate(
      candidate({
        problemId: 'due-item',
        revision: { overdueDays: 1, state: 'REVIEWING' },
        solved: true,
        lastAttemptedDaysAgo: 1,
      }),
      shown,
    ).breakdown.recencyPenalty

    // Being shown a problem *because it is due* is the entire point. Penalising
    // it would make the engine argue with the revision schedule.
    expect(penalty).toBe(0)
  })

  it('weighs repeated dismissals', () => {
    const ignored = scoreOf(candidate({ dismissals: 3 }))
    const fresh = scoreOf(candidate({ dismissals: 0 }))

    expect(ignored).toBeLessThan(fresh)
  })
})

describe('diversity', () => {
  it('allows no more than two from one topic', () => {
    const many = Array.from({ length: 6 }, () => candidate({ topicIds: ['graphs'] }))
    const other = candidate({ topicIds: ['arrays'] })

    const chosen = diversify(
      [...many, other].map((c) => scoreCandidate(c, CONTEXT)),
      5,
    )

    const graphs = chosen.filter((entry) => entry.candidate.topicIds.includes('graphs'))
    expect(graphs.length).toBeLessThanOrEqual(MAX_PER_TOPIC)
  })

  it('always includes something outside the weakest topic', () => {
    // Everything attractive is in one topic, and one thing is not.
    const all = [
      ...Array.from({ length: 4 }, () => candidate({ topicIds: ['graphs'] })),
      candidate({ topicIds: ['arrays'] }),
    ]

    const chosen = diversify(
      all.map((c) => scoreCandidate(c, CONTEXT)),
      3,
    )

    // The morale rule. A system that only ever shows you what you are worst at
    // is one you stop opening.
    expect(chosen.some((entry) => !entry.candidate.topicIds.includes('graphs'))).toBe(true)
  })

  it('never surfaces something a gate refused', () => {
    const blocked = context({ blockedTopicIds: new Set(['graphs']) })
    const chosen = diversify(
      [candidate({ topicIds: ['graphs'] }), candidate({ topicIds: ['trees'] })].map((c) =>
        scoreCandidate(c, blocked),
      ),
      5,
    )

    expect(chosen.every((entry) => !entry.candidate.topicIds.includes('graphs'))).toBe(true)
  })

  it('returns the highest scores first', () => {
    const chosen = diversify(
      [
        candidate({ topicIds: ['arrays'] }),
        candidate({ topicIds: ['graphs'] }),
        candidate({ topicIds: ['trees'] }),
      ].map((c) => scoreCandidate(c, CONTEXT)),
      3,
    )

    const scores = chosen.map((entry) => entry.score)
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
  })
})

describe('the TRAIN NOW ladder', () => {
  const base = {
    lapsedDue: 0,
    totalDue: 0,
    weakestTopicGap: 0,
    averageMastery: 30,
    daysSinceLastContest: null,
    hasReachableNewPattern: false,
  }

  it('sends a lapsed item above everything else', () => {
    expect(
      decideActivity({ ...base, lapsedDue: 1, weakestTopicGap: 40, averageMastery: 90 }),
    ).toBe('REVISION')
  })

  it('clears a backed-up queue before new material', () => {
    expect(decideActivity({ ...base, totalDue: 5, weakestTopicGap: 40 })).toBe('REVISION')
  })

  it('does not interrupt for one or two due items', () => {
    expect(decideActivity({ ...base, totalDue: 2, weakestTopicGap: 40 })).toBe('WEAK_TOPIC')
  })

  it('offers a challenge once competence is broad and untested', () => {
    expect(decideActivity({ ...base, averageMastery: 75 })).toBe('MOCK_CHALLENGE')
  })

  it('does not offer a challenge twice in a week', () => {
    expect(
      decideActivity({ ...base, averageMastery: 75, daysSinceLastContest: 2 }),
    ).toBe('NEW_PROBLEM')
  })

  it('falls through to the roadmap when nothing else applies', () => {
    expect(decideActivity(base)).toBe('NEW_PROBLEM')
    expect(decideActivity({ ...base, hasReachableNewPattern: true })).toBe('NEW_PATTERN')
  })
})

describe('reasons', () => {
  it('gives every recommendation a non-empty one', () => {
    const cases = [
      candidate({ revision: { overdueDays: 7, state: 'REVIEWING' } }),
      candidate({ revision: { overdueDays: 0, state: 'LAPSED' } }),
      candidate({ topicIds: ['graphs'] }),
      candidate({ patternIds: ['bfs'] }),
      candidate({ difficulty: 'HARD' }),
      candidate(),
    ]

    for (const c of cases) {
      const reason = explain(scoreCandidate(c, CONTEXT), CONTEXT)
      expect(reason.length).toBeGreaterThan(0)
    }
  })

  it('names the actual number behind a weakness claim', () => {
    const reason = explain(
      scoreCandidate(candidate({ topicIds: ['graphs'] }), CONTEXT),
      CONTEXT,
    )

    // The reason is derived from the scoring breakdown, never written by a
    // model. It is the user's only window into the engine, and a plausible
    // invented explanation would teach them to trust something that is guessing.
    expect(reason).toContain('20')
    expect(reason).toContain('50')
  })

  it('is honest when there is nothing to go on', () => {
    const cold = context({ coldStart: true, topicMastery: new Map(), averageMastery: 0 })
    const reason = explain(scoreCandidate(candidate(), cold), cold)

    expect(reason).toContain('roadmap')
    expect(reason).toContain('nothing solved yet')
  })
})
