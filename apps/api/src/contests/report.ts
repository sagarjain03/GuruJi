import type { ContestArea, ContestFinishReason, ContestReport, Difficulty, MistakeCategory } from '@guruji/types'
import type { ProblemOutcome } from './scoring'

/**
 * The post-contest report. Pure: the service gathers the evidence, this reads
 * it. Every claim here is built from signals GuruJi already records — which
 * problems went unsolved, their topics and patterns, attempts, time, and the
 * mistakes the learner logged — and the report says which evidence it used.
 */

export interface ReportArea {
  slug: string
  name: string
  /** Current mastery 0–100; null when never measured. */
  mastery: number | null
}

export interface ReportProblemInput {
  slug: string
  title: string
  difficulty: Difficulty
  wasSolvedBefore: boolean
  topics: ReportArea[]
  patterns: ReportArea[]
  outcome: ProblemOutcome
  hintsUsed: number
  mistakeCategories: MistakeCategory[]
}

export interface ReportInput {
  contestId: string
  score: number
  maxScore: number
  finishReason: ContestFinishReason
  startedAt: Date
  problems: ReportProblemInput[]
}

const DIFFICULTY_RANK: Record<Difficulty, number> = { EASY: 1, MEDIUM: 2, HARD: 3 }

interface Tally {
  kind: ContestArea['kind']
  area: ReportArea
  problems: ReportProblemInput[]
}

function describeUnsolved(problem: ReportProblemInput): string {
  const { attempts } = problem.outcome
  if (attempts === 0) return `${problem.title} (not attempted)`
  return `${problem.title} (${attempts} attempt${attempts === 1 ? '' : 's'}, none accepted)`
}

/**
 * The weak area: the topic or pattern behind the most unsolved problems.
 * Ties go to lower mastery (never measured is not weaker than a measured
 * score), then to the harder problem, then topics before patterns, then slug —
 * so the same contest always names the same area.
 */
function weakArea(problems: ReportProblemInput[]): ContestArea | null {
  const unsolved = problems.filter((problem) => !problem.outcome.solved)
  const tallies = new Map<string, Tally>()
  for (const problem of unsolved) {
    for (const [kind, areas] of [
      ['TOPIC', problem.topics],
      ['PATTERN', problem.patterns],
    ] as const) {
      for (const area of areas) {
        const key = `${kind}:${area.slug}`
        const tally = tallies.get(key) ?? { kind, area, problems: [] }
        tally.problems.push(problem)
        tallies.set(key, tally)
      }
    }
  }

  const hardest = (tally: Tally) => Math.max(...tally.problems.map((problem) => DIFFICULTY_RANK[problem.difficulty]))
  const ranked = [...tallies.values()].sort(
    (a, b) =>
      b.problems.length - a.problems.length ||
      (a.area.mastery ?? Number.POSITIVE_INFINITY) - (b.area.mastery ?? Number.POSITIVE_INFINITY) ||
      hardest(b) - hardest(a) ||
      (a.kind === b.kind ? 0 : a.kind === 'TOPIC' ? -1 : 1) ||
      a.area.slug.localeCompare(b.area.slug),
  )
  const winner = ranked[0]
  if (winner === undefined) return null

  const mistakes = [...new Set(winner.problems.flatMap((problem) => problem.mistakeCategories))]
  const evidence = `Unsolved: ${winner.problems.map(describeUnsolved).join(', ')}.`
  return {
    kind: winner.kind,
    slug: winner.area.slug,
    name: winner.area.name,
    reason: mistakes.length === 0 ? evidence : `${evidence} Mistakes logged: ${mistakes.join(', ')}.`,
  }
}

/** Only when everything was solved: the slowest solve's topic, labelled as pace, not weakness. */
function slowest(problems: ReportProblemInput[], startedAt: Date): ContestArea | null {
  if (problems.length === 0 || problems.some((problem) => !problem.outcome.solved)) return null
  const byTime = [...problems].sort(
    (a, b) => (b.outcome.firstAcceptedAt?.getTime() ?? 0) - (a.outcome.firstAcceptedAt?.getTime() ?? 0),
  )
  const problem = byTime[0]
  const topic = problem?.topics[0]
  if (problem === undefined || topic === undefined) return null
  const minutes = Math.round(((problem.outcome.firstAcceptedAt?.getTime() ?? startedAt.getTime()) - startedAt.getTime()) / 60_000)
  return {
    kind: 'TOPIC',
    slug: topic.slug,
    name: topic.name,
    reason: `All solved. Slowest: ${problem.title}, ${minutes} min from the start — a pace to work on, not a weakness.`,
  }
}

export function buildReport(input: ReportInput): ContestReport {
  return {
    contestId: input.contestId,
    score: input.score,
    maxScore: input.maxScore,
    finishReason: input.finishReason,
    problems: input.problems.map((problem) => ({
      slug: problem.slug,
      title: problem.title,
      difficulty: problem.difficulty,
      solved: problem.outcome.solved,
      attempts: problem.outcome.attempts,
      timeToSolveMs:
        problem.outcome.firstAcceptedAt === null ? null : problem.outcome.firstAcceptedAt.getTime() - input.startedAt.getTime(),
      hintsUsed: problem.hintsUsed,
      topics: problem.topics.map((topic) => topic.name),
      patterns: problem.patterns.map((pattern) => pattern.name),
      mistakeCategories: problem.mistakeCategories,
      wasSolvedBefore: problem.wasSolvedBefore,
    })),
    weakArea: weakArea(input.problems),
    slowest: slowest(input.problems, input.startedAt),
  }
}
