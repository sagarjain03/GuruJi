import { Injectable } from '@nestjs/common'
import { prisma } from '@guruji/database'
import type {
  ActivityDay,
  AnalyticsOverview,
  PatternProgress,
  Streak,
  TopicProgress,
} from '@guruji/types'
import { computeMastery } from './mastery'

/** A year of squares, which is what a heatmap is. */
const ACTIVITY_DAYS = 365

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
    const [topics, patterns, solvedProblems, activity] = await Promise.all([
      this.topics(userId),
      this.patterns(userId),
      this.solvedByDifficulty(userId),
      this.activity(userId),
    ])

    return {
      totalAttempted: topics.reduce((total, topic) => total + topic.attempts, 0),
      totalSolved: solvedProblems.easy + solvedProblems.medium + solvedProblems.hard,
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

  /**
   * A year of days, bucketed in UTC.
   *
   * Bucketing here rather than in the client because the streak is derived
   * from it and has to agree with itself — two devices in two time zones must
   * not disagree about whether yesterday counted.
   */
  private async activity(userId: string): Promise<ActivityDay[]> {
    const since = new Date(Date.now() - ACTIVITY_DAYS * 24 * 60 * 60 * 1000)

    const rows = await prisma.submission.findMany({
      where: {
        userId,
        isRun: false,
        status: 'COMPLETED',
        verdict: { not: 'INTERNAL_ERROR' },
        createdAt: { gte: since },
      },
      select: { createdAt: true, verdict: true, problemId: true },
      orderBy: { createdAt: 'asc' },
    })

    const byDay = new Map<string, { attempted: Set<string>; solved: Set<string> }>()
    for (const row of rows) {
      const date = row.createdAt.toISOString().slice(0, 10)
      const bucket = byDay.get(date) ?? { attempted: new Set<string>(), solved: new Set<string>() }
      bucket.attempted.add(row.problemId)
      if (row.verdict === 'ACCEPTED') {
        bucket.solved.add(row.problemId)
      }
      byDay.set(date, bucket)
    }

    return [...byDay.entries()]
      .map(([date, bucket]) => ({
        date,
        attempted: bucket.attempted.size,
        solved: bucket.solved.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }
}

/**
 * Consecutive days with a solve, counting back from today.
 *
 * A day with attempts but no solve does not extend a streak: the streak is
 * about finishing things, and a version that counted showing up would reward
 * opening the tab. It is shown to the user and deliberately kept out of the
 * mastery model for the same reason — consistency is a habit, not a skill.
 */
function streakFrom(activity: ActivityDay[]): Streak {
  const solvedDays = activity.filter((day) => day.solved > 0).map((day) => day.date)
  if (solvedDays.length === 0) {
    return { current: 0, longest: 0, lastActiveDate: null }
  }

  const days = new Set(solvedDays)
  const lastActiveDate = solvedDays[solvedDays.length - 1] ?? null

  let longest = 0
  let run = 0
  for (const date of solvedDays) {
    run = days.has(previousDay(date)) ? run + 1 : 1
    longest = Math.max(longest, run)
  }

  // Counting back from today, and from yesterday if today is not done yet —
  // a streak that breaks the moment midnight passes would punish people for
  // not having practised yet at 9am.
  const today = new Date().toISOString().slice(0, 10)
  let cursor = days.has(today) ? today : previousDay(today)
  let current = 0
  while (days.has(cursor)) {
    current += 1
    cursor = previousDay(cursor)
  }

  return { current, longest, lastActiveDate }
}

function previousDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`)
  parsed.setUTCDate(parsed.getUTCDate() - 1)
  return parsed.toISOString().slice(0, 10)
}
