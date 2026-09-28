import { HttpStatus, Injectable } from '@nestjs/common'
import { prisma } from '@guruji/database'
import type {
  ContestFinishReason,
  ContestReport,
  ContestSubmitRequest,
  ContestView,
  MistakeCategory,
  StartContestRequest,
  SubmissionAccepted,
} from '@guruji/types'
import { AppError, NotFoundError } from '../common/app-error'
import { SubmissionsService } from '../execution/submissions.service'
import { CandidatesService } from '../recommendations/candidates.service'
import { buildReport, type ReportArea } from './report'
import { problemOutcome, problemState, scoreContest, shouldFinish, type ContestAttempt } from './scoring'
import { selectProblems, type SelectionCandidate } from './selection'

const MINUTE = 60_000

/** Everything a contest view, a submit or a report needs, in one read. */
const CONTEST_INCLUDE = {
  problems: {
    orderBy: { position: 'asc' },
    include: { problem: { select: { slug: true, title: true, difficulty: true } } },
  },
  submissions: {
    include: {
      submission: { select: { id: true, verdict: true, createdAt: true, hintsUsedAtSubmit: true } },
    },
  },
} as const

type LoadedContest = NonNullable<Awaited<ReturnType<typeof loadContest>>>

function loadContest(userId: string, contestId: string) {
  // Scoped by user: someone else's contest id is simply not found.
  return prisma.contest.findFirst({ where: { id: contestId, userId }, include: CONTEST_INCLUDE })
}

function attemptsOf(contest: LoadedContest): ContestAttempt[] {
  return contest.submissions.map((row) => ({
    problemId: row.problemId,
    verdict: row.submission.verdict,
    createdAt: row.submission.createdAt,
  }))
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

/**
 * Mock contests: a timed, single-user assessment of three problems.
 *
 * The clock is the row's `deadlineAt`, set once at start. There is no timer
 * job: a contest past its deadline is finished by whichever read or write
 * touches it next, so every answer is right at the moment it is given.
 */
@Injectable()
export class ContestsService {
  constructor(
    private readonly submissions: SubmissionsService,
    private readonly candidates: CandidatesService,
  ) {}

  async start(userId: string, request: StartContestRequest, now = new Date()): Promise<ContestView> {
    const active = await prisma.contest.findFirst({ where: { userId, status: 'ACTIVE' }, include: CONTEST_INCLUDE })
    if (active !== null) {
      if (!shouldFinish(active, now)) throw this.alreadyActive(active.id)
      await this.finalize(active, 'TIME_UP', now)
    }

    const picked = selectProblems({
      candidates: await this.selectionCandidates(userId),
      topicMastery: (await this.candidates.contextFor(userId)).topicMastery,
    })
    if (picked === null) {
      throw new AppError('CONTEST_UNAVAILABLE', 'There are not enough problems for a contest yet.', HttpStatus.CONFLICT)
    }

    let created: { id: string }
    try {
      created = await prisma.contest.create({
        data: {
          userId,
          durationMinutes: request.durationMinutes,
          hintsAllowed: request.hintsAllowed,
          startedAt: now,
          deadlineAt: new Date(now.getTime() + request.durationMinutes * MINUTE),
          maxScore: picked.reduce((total, problem) => total + problem.points, 0),
          problems: {
            create: picked.map((problem) => ({
              problemId: problem.problemId,
              position: problem.position,
              points: problem.points,
              wasSolvedBefore: problem.wasSolvedBefore,
            })),
          },
        },
        select: { id: true },
      })
    } catch (error) {
      // Two tabs pressed Start at the same moment: the partial unique index let
      // exactly one through. Point the loser at the winner.
      if (!isUniqueViolation(error)) throw error
      const winner = await prisma.contest.findFirst({ where: { userId, status: 'ACTIVE' }, select: { id: true } })
      throw this.alreadyActive(winner?.id ?? null)
    }

    return this.view(userId, created.id, now)
  }

  /** The most recent contest, whatever its state — so a report is never lost to a closed tab. */
  async latest(userId: string, now = new Date()): Promise<ContestView | null> {
    const newest = await prisma.contest.findFirst({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      select: { id: true },
    })
    return newest === null ? null : this.view(userId, newest.id, now)
  }

  async view(userId: string, contestId: string, now = new Date()): Promise<ContestView> {
    const contest = await this.current(userId, contestId, now)
    return this.toView(contest, now)
  }

  async submit(
    userId: string,
    contestId: string,
    request: ContestSubmitRequest,
    now = new Date(),
  ): Promise<SubmissionAccepted> {
    const contest = await this.current(userId, contestId, now)
    if (contest.status !== 'ACTIVE') {
      throw new AppError('CONTEST_ENDED', 'This contest has ended. Submissions are closed.', HttpStatus.CONFLICT)
    }
    if (!contest.problems.some((entry) => entry.problemId === request.problemId)) {
      throw new AppError('PROBLEM_NOT_IN_CONTEST', 'That problem is not part of this contest.', HttpStatus.UNPROCESSABLE_ENTITY)
    }

    // The real submit path: judged, and counted toward mastery and revision,
    // like any graded submission.
    const accepted = await this.submissions.submit(userId, {
      problemId: request.problemId,
      language: request.language,
      code: request.code,
      timeSpentMs: request.timeSpentMs,
      isRun: false,
      hintsUsedAtSubmit: 0,
    })
    await prisma.contestSubmission.create({
      data: { contestId: contest.id, problemId: request.problemId, submissionId: accepted.id },
    })
    return accepted
  }

  /** Ends a contest early. Idempotent: finishing a finished contest returns it unchanged. */
  async finish(userId: string, contestId: string, now = new Date()): Promise<ContestView> {
    const contest = await this.current(userId, contestId, now)
    if (contest.status === 'ACTIVE') await this.finalize(contest, 'EARLY', now)
    return this.view(userId, contestId, now)
  }

  async report(userId: string, contestId: string, now = new Date()): Promise<ContestReport> {
    const contest = await this.current(userId, contestId, now)
    if (contest.status !== 'FINISHED' || contest.finishReason === null) {
      throw new AppError('CONTEST_NOT_FINISHED', 'The report is ready once the contest ends.', HttpStatus.CONFLICT)
    }

    const problemIds = contest.problems.map((entry) => entry.problemId)
    const [details, topicProgress, patternProgress, mistakes] = await Promise.all([
      prisma.problem.findMany({
        where: { id: { in: problemIds } },
        select: {
          id: true,
          topics: { select: { topic: { select: { id: true, slug: true, name: true } } } },
          patterns: { select: { pattern: { select: { id: true, slug: true, name: true } } } },
        },
      }),
      prisma.userTopicProgress.findMany({ where: { userId }, select: { topicId: true, masteryScore: true, attempts: true } }),
      prisma.userPatternProgress.findMany({ where: { userId }, select: { patternId: true, masteryScore: true, attempts: true } }),
      prisma.mistake.findMany({
        where: { userId, submissionId: { in: contest.submissions.map((row) => row.submissionId) } },
        select: { problemId: true, category: true },
      }),
    ])

    // Mastery is "measured" only once practised; never-practised is null, not 0.
    const topicMastery = new Map(topicProgress.filter((row) => row.attempts > 0).map((row) => [row.topicId, row.masteryScore]))
    const patternMastery = new Map(patternProgress.filter((row) => row.attempts > 0).map((row) => [row.patternId, row.masteryScore]))
    const attempts = attemptsOf(contest)

    return buildReport({
      contestId: contest.id,
      score: contest.score,
      maxScore: contest.maxScore,
      finishReason: contest.finishReason,
      startedAt: contest.startedAt,
      problems: contest.problems.map((entry) => {
        const detail = details.find((problem) => problem.id === entry.problemId)
        const area = (row: { id: string; slug: string; name: string }, mastery: Map<string, number>): ReportArea => ({
          slug: row.slug,
          name: row.name,
          mastery: mastery.get(row.id) ?? null,
        })
        const own = contest.submissions.filter((row) => row.problemId === entry.problemId)
        return {
          slug: entry.problem.slug,
          title: entry.problem.title,
          difficulty: entry.problem.difficulty,
          wasSolvedBefore: entry.wasSolvedBefore,
          topics: (detail?.topics ?? []).map(({ topic }) => area(topic, topicMastery)),
          patterns: (detail?.patterns ?? []).map(({ pattern }) => area(pattern, patternMastery)),
          outcome: problemOutcome(
            attempts.filter((attempt) => attempt.problemId === entry.problemId),
            contest.deadlineAt,
          ),
          hintsUsed: Math.max(0, ...own.map((row) => row.submission.hintsUsedAtSubmit)),
          mistakeCategories: [
            ...new Set(
              mistakes.filter((mistake) => mistake.problemId === entry.problemId).map((mistake) => mistake.category),
            ),
          ] as MistakeCategory[],
        }
      }),
    })
  }

  /**
   * The gate the AI mentor calls before doing anything — before its quota is
   * touched, so a refused request costs the learner nothing.
   *
   * Blocks only the problems of a running contest that was started without
   * hints. Any other problem, or a contest past its deadline, is untouched.
   */
  async assertMentorAllowed(userId: string, problemSlug: string, now = new Date()): Promise<void> {
    const running = await prisma.contest.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        hintsAllowed: false,
        deadlineAt: { gt: now },
        problems: { some: { problem: { slug: problemSlug } } },
      },
      select: { id: true },
    })
    if (running !== null) {
      throw new AppError(
        'CONTEST_HINTS_DISABLED',
        'The mentor is off for this problem until your contest ends.',
        HttpStatus.FORBIDDEN,
      )
    }
  }

  /** Loads a contest, finishing it first if its time ran out. */
  private async current(userId: string, contestId: string, now: Date): Promise<LoadedContest> {
    const contest = await loadContest(userId, contestId)
    if (contest === null) throw new NotFoundError('NOT_FOUND', 'That contest does not exist.')
    if (shouldFinish(contest, now)) {
      await this.finalize(contest, 'TIME_UP', now)
      return (await loadContest(userId, contestId)) as LoadedContest
    }
    // A submission made before the deadline may be judged after the finish.
    // The stored score follows it rather than freezing a pending verdict out.
    if (contest.status === 'FINISHED') {
      const score = scoreContest(contest.problems, attemptsOf(contest), contest.deadlineAt)
      if (score !== contest.score) {
        await prisma.contest.update({ where: { id: contest.id }, data: { score } })
        return { ...contest, score }
      }
    }
    return contest
  }

  private async finalize(contest: LoadedContest, reason: ContestFinishReason, now: Date): Promise<void> {
    // `updateMany` on ACTIVE: two requests finishing at once both succeed, once.
    await prisma.contest.updateMany({
      where: { id: contest.id, status: 'ACTIVE' },
      data: {
        status: 'FINISHED',
        finishReason: reason,
        // Time ran out at the deadline, not whenever someone next looked.
        finishedAt: reason === 'TIME_UP' ? contest.deadlineAt : now,
        score: scoreContest(contest.problems, attemptsOf(contest), contest.deadlineAt),
      },
    })
  }

  private toView(contest: LoadedContest, now: Date): ContestView {
    const attempts = attemptsOf(contest)
    return {
      id: contest.id,
      status: contest.status,
      durationMinutes: contest.durationMinutes,
      hintsAllowed: contest.hintsAllowed,
      startedAt: contest.startedAt.toISOString(),
      deadlineAt: contest.deadlineAt.toISOString(),
      finishedAt: contest.finishedAt?.toISOString() ?? null,
      finishReason: contest.finishReason,
      serverNow: now.toISOString(),
      score: contest.score,
      maxScore: contest.maxScore,
      problems: contest.problems.map((entry) => {
        const outcome = problemOutcome(
          attempts.filter((attempt) => attempt.problemId === entry.problemId),
          contest.deadlineAt,
        )
        return {
          position: entry.position,
          problemId: entry.problemId,
          slug: entry.problem.slug,
          title: entry.problem.title,
          difficulty: entry.problem.difficulty,
          points: entry.points,
          wasSolvedBefore: entry.wasSolvedBefore,
          state: problemState(outcome),
          attempts: outcome.attempts,
        }
      }),
    }
  }

  /** Published problems, with whether this user solved each and when they last worked on it. */
  private async selectionCandidates(userId: string): Promise<SelectionCandidate[]> {
    const [problems, graded] = await Promise.all([
      prisma.problem.findMany({
        where: { reviewStatus: 'PUBLISHED' },
        select: { id: true, difficulty: true, topics: { select: { topicId: true } } },
      }),
      prisma.submission.findMany({
        where: { userId, isRun: false, status: 'COMPLETED', verdict: { not: 'INTERNAL_ERROR' } },
        select: { problemId: true, verdict: true, createdAt: true },
      }),
    ])

    const solved = new Set(graded.filter((row) => row.verdict === 'ACCEPTED').map((row) => row.problemId))
    const lastPracticed = new Map<string, Date>()
    for (const row of graded) {
      const seen = lastPracticed.get(row.problemId)
      if (seen === undefined || seen < row.createdAt) lastPracticed.set(row.problemId, row.createdAt)
    }

    return problems.map((problem) => ({
      problemId: problem.id,
      difficulty: problem.difficulty,
      topicIds: problem.topics.map((topic) => topic.topicId),
      solved: solved.has(problem.id),
      lastPracticedAt: lastPracticed.get(problem.id) ?? null,
    }))
  }

  private alreadyActive(contestId: string | null): AppError {
    return new AppError(
      'CONTEST_ALREADY_ACTIVE',
      'You already have a contest running. Finish it before starting another.',
      HttpStatus.CONFLICT,
      { contestId },
    )
  }
}
