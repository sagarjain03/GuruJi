import { Injectable } from '@nestjs/common'
import { prisma } from '@guruji/database'
import type {
  ActivityResponse,
  AnalyticsOverview,
  AnalyticsRangeQuery,
  DifficultyDistribution,
  PatternProgress,
  PerformanceRow,
  TopicAnalytics,
  TopicProgress,
  TrendsResponse,
} from '@guruji/types'
import { bucketDays, bucketWeeks, firstTryAccuracy, hintsUsed, rangeBounds, resolveRange, streakFrom } from './analytics-math'
import { computeMastery } from './mastery'

/** A year of squares, which is what a heatmap is. */
const ACTIVITY_DAYS = 365

/** A year and a day: enough for "this time last year", not enough for "everything". */
const MAX_RANGE_DAYS = 366

/** Twelve weeks: long enough to see a trend, short enough that each point is recent. */
const TREND_DAYS = 12 * 7

/** What counts as a graded attempt everywhere in analytics. */
/** The start of the dashboard's year of activity. */
function activitySince(): Date {
  return new Date(Date.now() - ACTIVITY_DAYS * 24 * 60 * 60 * 1000)
}

const GRADED = { isRun: false, status: 'COMPLETED', verdict: { not: 'INTERNAL_ERROR' } } as const

/**
 * Everything the dashboard reads, in one request.
 *
 * One round trip rather than five, because the dashboard is the first screen
 * after signing in and a waterfall of requests there is the difference between
 * an app that feels ready and one that assembles itself while you watch.
 */
@Injectable()
export class AnalyticsService {
  async overview(userId: string): Promise<AnalyticsOverview> {
    const [topics, patterns, solvedProblems, graded] = await Promise.all([
      this.topics(userId),
      this.patterns(userId),
      this.solvedByDifficulty(userId),
      // All time, like the solved counts beside it. One narrow row per graded
      // submission; the history a person builds by hand stays small.
      prisma.submission.findMany({
        where: { userId, ...GRADED },
        select: { problemId: true, verdict: true, createdAt: true, hintsUsedAtSubmit: true },
      }),
    ])
    // A year of days, bucketed in UTC here rather than in the client: the
    // streak is derived from it, and two devices in two time zones must not
    // disagree about whether yesterday counted. It is a slice of the same rows,
    // not a second read of them — with a heavy history that query was a quarter
    // of this request.
    const since = activitySince()
    const activity = bucketDays(graded.filter((submission) => submission.createdAt >= since))

    return {
      totalAttempted: topics.reduce((total, topic) => total + topic.attempts, 0),
      totalSolved: solvedProblems.easy + solvedProblems.medium + solvedProblems.hard,
      firstTryAccuracy: firstTryAccuracy(graded),
      hintsUsed: hintsUsed(graded),
      solvedByDifficulty: solvedProblems,
      streak: streakFrom(activity),
      topics,
      patterns,
      activity,
    }
  }

  /**
   * Weakest first.
   *
   * The dashboard's job is to answer "what should I work on", so the order is
   * the answer. Sorting alphabetically would make the user do the comparison
   * themselves, every time.
   */
  private async topics(userId: string): Promise<TopicProgress[]> {
    const rows = await prisma.userTopicProgress.findMany({
      where: { userId },
      include: { topic: { select: { slug: true, name: true } } },
    })

    // Available-pattern counts, once per topic, rather than per row inside a loop.
    const available = await this.patternsAvailable(rows.map((row) => row.topicId))

    return rows
      .map((row) => ({
        topicId: row.topicId,
        slug: row.topic.slug,
        name: row.topic.name,
        attempts: row.attempts,
        solved: row.solved,
        lastPracticedAt: row.lastPracticedAt?.toISOString() ?? null,
        mastery: computeMastery({
          ...row,
          patternsAvailable: available.get(row.topicId) ?? 0,
        }),
      }))
      .sort((a, b) => a.mastery.score - b.mastery.score)
  }

  private async patterns(userId: string): Promise<PatternProgress[]> {
    const rows = await prisma.userPatternProgress.findMany({
      where: { userId },
      include: { pattern: { select: { slug: true, name: true } } },
    })

    return rows
      .map((row) => ({
        patternId: row.patternId,
        slug: row.pattern.slug,
        name: row.pattern.name,
        attempts: row.attempts,
        solved: row.solved,
        lastPracticedAt: row.lastPracticedAt?.toISOString() ?? null,
        // A pattern row has no coverage of its own; the formula treats it as
        // unmeasured and hands its weight to what can be measured.
        mastery: computeMastery({ ...row, patternsSolved: 0, patternsAvailable: 0 }),
      }))
      .sort((a, b) => a.mastery.score - b.mastery.score)
  }

  private async patternsAvailable(topicIds: string[]): Promise<Map<string, number>> {
    if (topicIds.length === 0) {
      return new Map()
    }

    const rows = await prisma.problemPattern.findMany({
      where: { problem: { topics: { some: { topicId: { in: topicIds } } } } },
      select: { patternId: true, problem: { select: { topics: { select: { topicId: true } } } } },
    })

    const byTopic = new Map<string, Set<string>>()
    for (const row of rows) {
      for (const { topicId } of row.problem.topics) {
        if (!topicIds.includes(topicId)) {
          continue
        }
        const set = byTopic.get(topicId) ?? new Set<string>()
        set.add(row.patternId)
        byTopic.set(topicId, set)
      }
    }

    return new Map([...byTopic.entries()].map(([topicId, set]) => [topicId, set.size]))
  }

  /** Distinct problems solved, not submissions — the same rule the model uses. */
  private async solvedByDifficulty(
    userId: string,
  ): Promise<{ easy: number; medium: number; hard: number }> {
    const rows = await prisma.submission.findMany({
      where: { userId, verdict: 'ACCEPTED', isRun: false },
      select: { problemId: true, problem: { select: { difficulty: true } } },
      distinct: ['problemId'],
    })

    return {
      easy: rows.filter((row) => row.problem.difficulty === 'EASY').length,
      medium: rows.filter((row) => row.problem.difficulty === 'MEDIUM').length,
      hard: rows.filter((row) => row.problem.difficulty === 'HARD').length,
    }
  }

  async activityRange(userId: string, query: AnalyticsRangeQuery): Promise<ActivityResponse> {
    const range = resolveRange(query, new Date(), { defaultDays: ACTIVITY_DAYS, maxDays: MAX_RANGE_DAYS })
    return { ...range, days: bucketDays(await this.graded(userId, rangeBounds(range))) }
  }

  async trends(userId: string, query: AnalyticsRangeQuery): Promise<TrendsResponse> {
    const range = resolveRange(query, new Date(), { defaultDays: TREND_DAYS, maxDays: MAX_RANGE_DAYS })
    return { ...range, weeks: bucketWeeks(await this.graded(userId, rangeBounds(range)), range) }
  }

  /**
   * Topics and patterns in the dashboard's order — weakest first — with the
   * first-attempt accuracy the charts need beside the mastery score.
   */
  async topicAnalytics(userId: string): Promise<TopicAnalytics> {
    const [topics, patterns, topicFirst, patternFirst, difficulty] = await Promise.all([
      this.topics(userId),
      this.patterns(userId),
      prisma.userTopicProgress.findMany({ where: { userId }, select: { topicId: true, firstAttemptSolved: true } }),
      prisma.userPatternProgress.findMany({ where: { userId }, select: { patternId: true, firstAttemptSolved: true } }),
      this.difficultyDistribution(userId),
    ])
    const topicFirstById = new Map(topicFirst.map((row) => [row.topicId, row.firstAttemptSolved]))
    const patternFirstById = new Map(patternFirst.map((row) => [row.patternId, row.firstAttemptSolved]))

    return {
      topics: topics.map((topic) => performance(topic.topicId, topic, topicFirstById.get(topic.topicId) ?? 0)),
      patterns: patterns.map((pattern) =>
        performance(pattern.patternId, pattern, patternFirstById.get(pattern.patternId) ?? 0),
      ),
      difficulty,
    }
  }

  /** Distinct problems attempted and solved per difficulty, over all time. */
  private async difficultyDistribution(userId: string): Promise<DifficultyDistribution> {
    const [attempted, solved] = await Promise.all([
      prisma.submission.findMany({
        where: { userId, ...GRADED },
        select: { problemId: true, problem: { select: { difficulty: true } } },
        distinct: ['problemId'],
      }),
      this.solvedByDifficulty(userId),
    ])
    const count = (difficulty: string) => attempted.filter((row) => row.problem.difficulty === difficulty).length

    return {
      easy: { attempted: count('EASY'), solved: solved.easy },
      medium: { attempted: count('MEDIUM'), solved: solved.medium },
      hard: { attempted: count('HARD'), solved: solved.hard },
    }
  }

  /** Graded submissions in an instant range, oldest first — the input to every bucket. */
  private graded(userId: string, createdAt: { gte: Date; lt?: Date }) {
    return prisma.submission.findMany({
      where: { userId, ...GRADED, createdAt },
      select: { createdAt: true, verdict: true, problemId: true, timeSpentMs: true },
      orderBy: { createdAt: 'asc' },
    })
  }
}

function performance(
  id: string,
  row: { slug: string; name: string; attempts: number; solved: number; mastery: { score: number } },
  firstAttemptSolved: number,
): PerformanceRow {
  return {
    id,
    slug: row.slug,
    name: row.name,
    attempts: row.attempts,
    solved: row.solved,
    accuracy: row.attempts === 0 ? null : firstAttemptSolved / row.attempts,
    masteryScore: row.mastery.score,
  }
}
