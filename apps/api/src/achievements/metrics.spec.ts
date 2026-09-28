import { computeMetrics, type MetricInputs } from './metrics'

const at = (day: number, minute = 0) => new Date(Date.UTC(2026, 8, day, 13, minute))

function inputs(overrides: Partial<MetricInputs> = {}): MetricInputs {
  return {
    submissions: [],
    problems: new Map(),
    revisionOutcomes: [],
    mistakes: [],
    contests: [],
    ...overrides,
  }
}

const problem = (difficulty: 'EASY' | 'MEDIUM' | 'HARD', topics: string[], patterns: string[]) => ({
  difficulty,
  topicIds: topics,
  patternIds: patterns,
})

describe('computeMetrics', () => {
  it('is all zeros for someone who has done nothing', () => {
    expect(Object.values(computeMetrics(inputs())).every((value) => value === 0)).toBe(true)
  })

  it('counts a first-try solve only when the first graded submission was accepted', () => {
    const metrics = computeMetrics(
      inputs({
        problems: new Map([
          ['a', problem('EASY', ['t1'], [])],
          ['b', problem('EASY', ['t1'], [])],
        ]),
        submissions: [
          // a: right first time.
          { problemId: 'a', verdict: 'ACCEPTED', createdAt: at(1), hintsUsedAtSubmit: 0, language: 'PYTHON' },
          // b: wrong, then right — a solve, but not a first-try one.
          { problemId: 'b', verdict: 'WRONG_ANSWER', createdAt: at(2), hintsUsedAtSubmit: 0, language: 'PYTHON' },
          { problemId: 'b', verdict: 'ACCEPTED', createdAt: at(2, 5), hintsUsedAtSubmit: 0, language: 'PYTHON' },
        ],
      }),
    )

    expect(metrics.firstTrySolves).toBe(1)
  })

  it('counts a comeback after two or more wrong attempts, not after one', () => {
    const metrics = computeMetrics(
      inputs({
        problems: new Map([
          ['once', problem('EASY', [], [])],
          ['twice', problem('EASY', [], [])],
        ]),
        submissions: [
          { problemId: 'once', verdict: 'WRONG_ANSWER', createdAt: at(1), hintsUsedAtSubmit: 0, language: 'C' },
          { problemId: 'once', verdict: 'ACCEPTED', createdAt: at(1, 1), hintsUsedAtSubmit: 0, language: 'C' },
          { problemId: 'twice', verdict: 'WRONG_ANSWER', createdAt: at(1), hintsUsedAtSubmit: 0, language: 'C' },
          { problemId: 'twice', verdict: 'TIME_LIMIT_EXCEEDED', createdAt: at(1, 2), hintsUsedAtSubmit: 0, language: 'C' },
          { problemId: 'twice', verdict: 'ACCEPTED', createdAt: at(1, 3), hintsUsedAtSubmit: 0, language: 'C' },
        ],
      }),
    )

    expect(metrics.comebacks).toBe(1)
  })

  it('counts unaided only when the accepted submission took no hint', () => {
    const metrics = computeMetrics(
      inputs({
        problems: new Map([
          ['clean', problem('EASY', [], [])],
          ['helped', problem('EASY', [], [])],
        ]),
        submissions: [
          { problemId: 'clean', verdict: 'ACCEPTED', createdAt: at(1), hintsUsedAtSubmit: 0, language: 'CPP' },
          { problemId: 'helped', verdict: 'ACCEPTED', createdAt: at(1), hintsUsedAtSubmit: 2, language: 'CPP' },
        ],
      }),
    )

    expect(metrics.unaidedSolves).toBe(1)
  })

  it('counts distinct topics, patterns, hard problems and languages among solves', () => {
    const metrics = computeMetrics(
      inputs({
        problems: new Map([
          ['p1', problem('HARD', ['arrays', 'dp'], ['two-pointers'])],
          ['p2', problem('EASY', ['arrays'], ['two-pointers', 'hashing'])],
          ['p3', problem('HARD', ['graphs'], ['bfs'])],
        ]),
        submissions: [
          { problemId: 'p1', verdict: 'ACCEPTED', createdAt: at(1), hintsUsedAtSubmit: 0, language: 'CPP' },
          { problemId: 'p2', verdict: 'ACCEPTED', createdAt: at(2), hintsUsedAtSubmit: 0, language: 'PYTHON' },
          // p3 attempted, never solved: counts toward nothing here.
          { problemId: 'p3', verdict: 'WRONG_ANSWER', createdAt: at(3), hintsUsedAtSubmit: 0, language: 'JAVASCRIPT' },
        ],
      }),
    )

    expect(metrics.topicsSolved).toBe(2)
    expect(metrics.patternsSolved).toBe(2)
    expect(metrics.hardSolved).toBe(1)
    expect(metrics.languagesAccepted).toBe(2)
  })

  it('takes the longest run of consecutive days with a solve', () => {
    const accepted = (problemId: string, day: number) => ({
      problemId,
      verdict: 'ACCEPTED' as const,
      createdAt: at(day),
      hintsUsedAtSubmit: 0,
      language: 'C' as const,
    })
    const metrics = computeMetrics(
      inputs({
        problems: new Map(['a', 'b', 'c', 'd', 'e'].map((id) => [id, problem('EASY', [], [])])),
        submissions: [accepted('a', 1), accepted('b', 2), accepted('c', 3), accepted('d', 10), accepted('e', 11)],
      }),
    )

    expect(metrics.longestStreak).toBe(3)
  })

  it('counts recalled revisions, journal entries with a fix, finished contests and clean sweeps', () => {
    const metrics = computeMetrics(
      inputs({
        revisionOutcomes: ['SOLVED_EASILY', 'SOLVED_WITH_EFFORT', 'STRUGGLED', 'FAILED'],
        mistakes: [{ correctIdea: 'Use a heap.' }, { correctIdea: null }, { correctIdea: '   ' }],
        contests: [
          { status: 'FINISHED', solved: 3, problems: 3 },
          { status: 'FINISHED', solved: 1, problems: 3 },
          { status: 'ACTIVE', solved: 3, problems: 3 },
        ],
      }),
    )

    expect(metrics.revisionsRecalled).toBe(2)
    // A blank "correct idea" is not a reflection.
    expect(metrics.journalEntries).toBe(1)
    // A running contest is not finished yet, even with everything solved.
    expect(metrics.contestsFinished).toBe(2)
    expect(metrics.cleanSweeps).toBe(1)
  })
})
