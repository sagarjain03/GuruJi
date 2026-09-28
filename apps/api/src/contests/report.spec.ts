import { describe, expect, it } from 'vitest'
import { buildReport, type ReportProblemInput } from './report'

const START = new Date('2026-09-28T13:00:00.000Z')
const at = (minute: number) => new Date(START.getTime() + minute * 60_000)

const heaps = { slug: 'heaps', name: 'Heaps & Priority Queues', mastery: 30 }
const graphs = { slug: 'graphs', name: 'Graphs', mastery: 20 }
const arrays = { slug: 'arrays', name: 'Arrays', mastery: 70 }
const topK = { slug: 'top-k', name: 'Top-K', mastery: 40 }

function problem(overrides: Partial<ReportProblemInput> & Pick<ReportProblemInput, 'slug'>): ReportProblemInput {
  return {
    title: overrides.slug,
    difficulty: 'MEDIUM',
    wasSolvedBefore: false,
    topics: [arrays],
    patterns: [],
    outcome: { solved: true, attempts: 1, firstAcceptedAt: at(10) },
    hintsUsed: 0,
    mistakeCategories: [],
    ...overrides,
  }
}

const unsolved = (attempts: number) => ({ solved: false, attempts, firstAcceptedAt: null })

function report(problems: ReportProblemInput[]) {
  return buildReport({ contestId: '01a0e2c1-4d5b-7291-82e5-e3ea10244e71', score: 100, maxScore: 600, finishReason: 'TIME_UP', startedAt: START, problems })
}

describe('buildReport — per problem', () => {
  it('reports time to solve from the contest start, and null when unsolved', () => {
    const built = report([
      problem({ slug: 'a', outcome: { solved: true, attempts: 2, firstAcceptedAt: at(34) } }),
      problem({ slug: 'b', outcome: unsolved(1) }),
    ])

    expect(built.problems.map((entry) => [entry.slug, entry.solved, entry.attempts, entry.timeToSolveMs])).toEqual([
      ['a', true, 2, 34 * 60_000],
      ['b', false, 1, null],
    ])
    expect(built.problems[0]?.topics).toEqual(['Arrays'])
  })
})

describe('buildReport — weak area', () => {
  it('names the topic behind the most unsolved problems', () => {
    const built = report([
      problem({ slug: 'kth', title: 'Kth Slowest Response', topics: [heaps], outcome: unsolved(2), mistakeCategories: ['LOGIC'] }),
      problem({ slug: 'merge', title: 'Merge K Streams', topics: [heaps, arrays], outcome: unsolved(0) }),
      problem({ slug: 'route', title: 'Route', topics: [graphs], outcome: unsolved(1) }),
    ])

    expect(built.weakArea).toMatchObject({ kind: 'TOPIC', slug: 'heaps', name: 'Heaps & Priority Queues' })
  })

  it('breaks a tie on count by lower mastery', () => {
    const built = report([
      problem({ slug: 'a', topics: [heaps], outcome: unsolved(1) }),
      problem({ slug: 'b', topics: [graphs], outcome: unsolved(1) }),
    ])

    expect(built.weakArea?.slug).toBe('graphs')
  })

  it('breaks a tie on mastery by the harder unsolved problem', () => {
    const built = report([
      problem({ slug: 'a', difficulty: 'EASY', topics: [{ slug: 'x', name: 'X', mastery: 50 }], outcome: unsolved(1) }),
      problem({ slug: 'b', difficulty: 'HARD', topics: [{ slug: 'y', name: 'Y', mastery: 50 }], outcome: unsolved(1) }),
    ])

    expect(built.weakArea?.slug).toBe('y')
  })

  it('treats never-measured mastery as not weaker than a measured score', () => {
    const built = report([
      problem({ slug: 'a', topics: [{ slug: 'new', name: 'New', mastery: null }], outcome: unsolved(1) }),
      problem({ slug: 'b', topics: [{ slug: 'known', name: 'Known', mastery: 90 }], outcome: unsolved(1) }),
    ])

    expect(built.weakArea?.slug).toBe('known')
  })

  it('can name a pattern when it covers more unsolved problems than any topic', () => {
    const built = report([
      problem({ slug: 'a', topics: [heaps], patterns: [topK], outcome: unsolved(1) }),
      problem({ slug: 'b', topics: [graphs], patterns: [topK], outcome: unsolved(1) }),
    ])

    expect(built.weakArea).toMatchObject({ kind: 'PATTERN', slug: 'top-k' })
  })

  it('states its evidence in plain words', () => {
    const built = report([
      problem({ slug: 'kth', title: 'Kth Slowest Response', topics: [heaps], outcome: unsolved(2), mistakeCategories: ['LOGIC', 'OFF_BY_ONE'] }),
      problem({ slug: 'merge', title: 'Merge K Streams', topics: [heaps], outcome: unsolved(0) }),
    ])

    expect(built.weakArea?.reason).toBe(
      'Unsolved: Kth Slowest Response (2 attempts, none accepted), Merge K Streams (not attempted). Mistakes logged: LOGIC, OFF_BY_ONE.',
    )
  })

  it('names no weakness when everything was solved, and labels the slowest instead', () => {
    const built = report([
      problem({ slug: 'a', title: 'Quick One', topics: [arrays], outcome: { solved: true, attempts: 1, firstAcceptedAt: at(8) } }),
      problem({ slug: 'b', title: 'Slow One', topics: [graphs], outcome: { solved: true, attempts: 3, firstAcceptedAt: at(47) } }),
    ])

    expect(built.weakArea).toBeNull()
    expect(built.slowest).toEqual({
      kind: 'TOPIC',
      slug: 'graphs',
      name: 'Graphs',
      reason: 'All solved. Slowest: Slow One, 47 min from the start — a pace to work on, not a weakness.',
    })
  })

  it('has no slowest while something is unsolved', () => {
    expect(report([problem({ slug: 'a', outcome: unsolved(1) })]).slowest).toBeNull()
  })
})
