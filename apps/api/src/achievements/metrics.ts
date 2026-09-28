import type { ContestStatus, Difficulty, Language, RevisionOutcome, Verdict } from '@guruji/types'
import { bucketDays, streakFrom } from '../mastery/analytics-math'
import type { Metric } from './catalog'

/**
 * Every badge's value, from plain rows. Pure: the service gathers the rows,
 * this counts. Each rule is the one a person would state out loud — "solved
 * on the first try", "came back after two misses" — written once, here.
 */

export interface GradedSubmission {
  problemId: string
  verdict: Verdict | null
  createdAt: Date
  hintsUsedAtSubmit: number
  language: Language
}

export interface ProblemFacts {
  difficulty: Difficulty
  topicIds: string[]
  patternIds: string[]
}

export interface MetricInputs {
  /** Graded submissions only: no sample runs, no judge failures. */
  submissions: GradedSubmission[]
  problems: Map<string, ProblemFacts>
  revisionOutcomes: RevisionOutcome[]
  mistakes: { correctIdea: string | null }[]
  contests: { status: ContestStatus; solved: number; problems: number }[]
}

export type Metrics = Record<Metric, number>

export function computeMetrics(input: MetricInputs): Metrics {
  const byProblem = new Map<string, GradedSubmission[]>()
  for (const submission of input.submissions) {
    const list = byProblem.get(submission.problemId) ?? []
    list.push(submission)
    byProblem.set(submission.problemId, list)
  }

  let firstTrySolves = 0
  let comebacks = 0
  let unaidedSolves = 0
  const solved = new Set<string>()
  const languages = new Set<Language>()

  for (const [problemId, list] of byProblem) {
    const ordered = [...list].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    const firstAccepted = ordered.findIndex((submission) => submission.verdict === 'ACCEPTED')
    for (const submission of ordered) {
      if (submission.verdict === 'ACCEPTED') languages.add(submission.language)
    }
    if (firstAccepted === -1) continue

    solved.add(problemId)
    if (firstAccepted === 0) firstTrySolves += 1
    // Everything before the first accept was a miss.
    if (firstAccepted >= 2) comebacks += 1
    if (ordered[firstAccepted]?.hintsUsedAtSubmit === 0) unaidedSolves += 1
  }

  const topics = new Set<string>()
  const patterns = new Set<string>()
  let hardSolved = 0
  for (const problemId of solved) {
    const facts = input.problems.get(problemId)
    if (facts === undefined) continue
    facts.topicIds.forEach((id) => topics.add(id))
    facts.patternIds.forEach((id) => patterns.add(id))
    if (facts.difficulty === 'HARD') hardSolved += 1
  }

  const finished = input.contests.filter((contest) => contest.status === 'FINISHED')

  return {
    firstTrySolves,
    revisionsRecalled: input.revisionOutcomes.filter(
      (outcome) => outcome === 'SOLVED_EASILY' || outcome === 'SOLVED_WITH_EFFORT',
    ).length,
    patternsSolved: patterns.size,
    topicsSolved: topics.size,
    // The same rule the dashboard's streak uses: a day counts once something is solved on it.
    longestStreak: streakFrom(
      bucketDays(
        input.submissions.map((submission) => ({
          createdAt: submission.createdAt,
          verdict: submission.verdict,
          problemId: submission.problemId,
        })),
      ),
    ).longest,
    hardSolved,
    unaidedSolves,
    comebacks,
    journalEntries: input.mistakes.filter((mistake) => (mistake.correctIdea ?? '').trim().length > 0).length,
    contestsFinished: finished.length,
    cleanSweeps: finished.filter((contest) => contest.problems > 0 && contest.solved === contest.problems).length,
    languagesAccepted: languages.size,
  }
}
