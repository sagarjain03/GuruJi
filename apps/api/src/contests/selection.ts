import type { Difficulty } from '@guruji/types'

/**
 * Which three problems a contest is made of. Pure: the service gathers the
 * candidates and the learner's topic mastery, this decides.
 *
 * One slot per difficulty, filled from the weakest topics first. A contest is
 * an assessment, so unsolved problems always win over solved ones; solved ones
 * are only a fallback for a small catalogue, and they are marked so the report
 * does not mistake a repeat for a cold attempt.
 */

export const CONTEST_SIZE = 3

export const POINTS: Record<Difficulty, number> = { EASY: 100, MEDIUM: 200, HARD: 300 }

const SLOTS: Difficulty[] = ['EASY', 'MEDIUM', 'HARD']

/** For an empty slot, the difficulties to try next, nearest first. */
const NEAREST: Record<Difficulty, Difficulty[]> = {
  EASY: ['MEDIUM', 'HARD'],
  MEDIUM: ['EASY', 'HARD'],
  HARD: ['MEDIUM', 'EASY'],
}

export interface SelectionCandidate {
  problemId: string
  difficulty: Difficulty
  topicIds: string[]
  solved: boolean
  lastPracticedAt: Date | null
}

export interface SelectionInput {
  candidates: SelectionCandidate[]
  /** Mastery 0–100 by topic id. A topic missing here was never practised. */
  topicMastery: Map<string, number>
}

export interface SelectedProblem {
  problemId: string
  difficulty: Difficulty
  position: number
  points: number
  wasSolvedBefore: boolean
}

/**
 * How weak a problem's weakest topic is. Unpractised topics rank after every
 * measured one: "weak" is something the data says, not an absence of data.
 */
function weakness(candidate: SelectionCandidate, mastery: Map<string, number>): number {
  const measured = candidate.topicIds.map((id) => mastery.get(id)).filter((score): score is number => score !== undefined)
  return measured.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...measured)
}

/** Returns the three problems in slot order, or null when fewer than three exist. */
export function selectProblems(input: SelectionInput): SelectedProblem[] | null {
  const unsolved = input.candidates
    .filter((candidate) => !candidate.solved)
    .map((candidate) => ({ candidate, key: weakness(candidate, input.topicMastery) }))
    .sort((a, b) => a.key - b.key || a.candidate.problemId.localeCompare(b.candidate.problemId))
    .map(({ candidate }) => candidate)

  const solved = input.candidates
    .filter((candidate) => candidate.solved)
    .sort(
      (a, b) =>
        (a.lastPracticedAt?.getTime() ?? 0) - (b.lastPracticedAt?.getTime() ?? 0) ||
        a.problemId.localeCompare(b.problemId),
    )

  const slots: (SelectionCandidate | null)[] = SLOTS.map(() => null)
  const taken = new Set<string>()

  const fill = (pool: SelectionCandidate[], difficultiesFor: (slot: Difficulty) => Difficulty[]): void => {
    SLOTS.forEach((slot, index) => {
      if (slots[index] !== null) return
      for (const difficulty of difficultiesFor(slot)) {
        const found = pool.find((candidate) => candidate.difficulty === difficulty && !taken.has(candidate.problemId))
        if (found !== undefined) {
          slots[index] = found
          taken.add(found.problemId)
          return
        }
      }
    })
  }

  fill(unsolved, (slot) => [slot])
  fill(unsolved, (slot) => NEAREST[slot])
  fill(solved, (slot) => [slot])
  fill(solved, (slot) => NEAREST[slot])

  if (slots.some((slot) => slot === null)) return null

  return slots.map((candidate, index) => {
    const picked = candidate as SelectionCandidate
    return {
      problemId: picked.problemId,
      difficulty: picked.difficulty,
      position: index + 1,
      points: POINTS[picked.difficulty],
      wasSolvedBefore: picked.solved,
    }
  })
}
