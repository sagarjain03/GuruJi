import { describe, expect, it } from 'vitest'
import { selectProblems, type SelectionCandidate } from './selection'

const DAY = 24 * 60 * 60 * 1000

function candidate(
  problemId: string,
  difficulty: SelectionCandidate['difficulty'],
  topicIds: string[],
  solved: { daysAgo: number } | null = null,
): SelectionCandidate {
  return {
    problemId,
    difficulty,
    topicIds,
    solved: solved !== null,
    lastPracticedAt: solved === null ? null : new Date(Date.UTC(2026, 8, 28) - solved.daysAgo * DAY),
  }
}

const ids = (picked: ReturnType<typeof selectProblems>) => picked?.map((problem) => problem.problemId)

describe('selectProblems', () => {
  it('takes one of each difficulty from the weakest topics first', () => {
    const mastery = new Map([
      ['graphs', 20],
      ['arrays', 70],
    ])
    const picked = selectProblems({
      topicMastery: mastery,
      candidates: [
        candidate('arrays-easy', 'EASY', ['arrays']),
        candidate('graphs-easy', 'EASY', ['graphs']),
        candidate('arrays-medium', 'MEDIUM', ['arrays']),
        candidate('graphs-medium', 'MEDIUM', ['graphs']),
        candidate('arrays-hard', 'HARD', ['arrays']),
        candidate('graphs-hard', 'HARD', ['graphs']),
      ],
    })

    expect(ids(picked)).toEqual(['graphs-easy', 'graphs-medium', 'graphs-hard'])
    expect(picked?.map((problem) => [problem.position, problem.points, problem.wasSolvedBefore])).toEqual([
      [1, 100, false],
      [2, 200, false],
      [3, 300, false],
    ])
  })

  it('ranks by the weakest topic a problem touches', () => {
    const picked = selectProblems({
      topicMastery: new Map([
        ['strings', 10],
        ['arrays', 80],
      ]),
      candidates: [
        candidate('arrays-only', 'EASY', ['arrays']),
        // Also touches a weak topic, so it outranks the arrays-only problem.
        candidate('arrays-and-strings', 'EASY', ['arrays', 'strings']),
        candidate('m', 'MEDIUM', ['arrays']),
        candidate('h', 'HARD', ['arrays']),
      ],
    })

    expect(ids(picked)?.[0]).toBe('arrays-and-strings')
  })

  it('puts measured weak topics before topics never practised', () => {
    const picked = selectProblems({
      topicMastery: new Map([['dp', 45]]),
      candidates: [
        candidate('untouched-easy', 'EASY', ['heaps']),
        candidate('dp-easy', 'EASY', ['dp']),
        candidate('m', 'MEDIUM', ['heaps']),
        candidate('h', 'HARD', ['heaps']),
      ],
    })

    expect(ids(picked)?.[0]).toBe('dp-easy')
  })

  it('fills a missing difficulty from the nearest one', () => {
    // No HARD problem at all: the HARD slot takes the next MEDIUM.
    const picked = selectProblems({
      topicMastery: new Map(),
      candidates: [
        candidate('e1', 'EASY', ['a']),
        candidate('m1', 'MEDIUM', ['a']),
        candidate('m2', 'MEDIUM', ['a']),
      ],
    })

    expect(picked?.map((problem) => problem.difficulty)).toEqual(['EASY', 'MEDIUM', 'MEDIUM'])
    expect(picked?.map((problem) => problem.points)).toEqual([100, 200, 200])
  })

  it('works for a brand-new user with no mastery at all', () => {
    const picked = selectProblems({
      topicMastery: new Map(),
      candidates: [candidate('e', 'EASY', ['a']), candidate('m', 'MEDIUM', ['b']), candidate('h', 'HARD', ['c'])],
    })

    expect(ids(picked)).toEqual(['e', 'm', 'h'])
  })

  it('falls back to solved problems, least recently practised first, and marks them', () => {
    const picked = selectProblems({
      topicMastery: new Map(),
      candidates: [
        candidate('unsolved-medium', 'MEDIUM', ['a']),
        candidate('solved-recently', 'EASY', ['a'], { daysAgo: 1 }),
        candidate('solved-long-ago', 'EASY', ['a'], { daysAgo: 20 }),
        candidate('solved-hard', 'HARD', ['a'], { daysAgo: 5 }),
      ],
    })

    expect(ids(picked)).toEqual(['solved-long-ago', 'unsolved-medium', 'solved-hard'])
    expect(picked?.map((problem) => problem.wasSolvedBefore)).toEqual([true, false, true])
  })

  it('never picks the same problem twice', () => {
    const picked = selectProblems({
      topicMastery: new Map(),
      candidates: [candidate('only-easy-1', 'EASY', ['a']), candidate('only-easy-2', 'EASY', ['a']), candidate('only-easy-3', 'EASY', ['a'])],
    })

    expect(new Set(ids(picked)).size).toBe(3)
  })

  it('refuses when the catalogue has fewer than three problems', () => {
    expect(
      selectProblems({
        topicMastery: new Map(),
        candidates: [candidate('e', 'EASY', ['a']), candidate('m', 'MEDIUM', ['a'], { daysAgo: 2 })],
      }),
    ).toBeNull()
  })
})
