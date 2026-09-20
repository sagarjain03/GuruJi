import { Injectable } from '@nestjs/common'
import { prisma, type RevisionState } from '@guruji/database'
import { localDayBounds, safeTimeZone } from './local-day'

/**
 * The single most important number in this module.
 *
 * Miss a week and an uncapped queue shows forty due problems, which is about
 * thirteen hours of work. The predictable outcome is that the user does none of
 * them and stops opening the app. A bounded queue that carries the overflow
 * forward stays usable after a lapse — and lapses are normal, not exceptional.
 */
export const DEFAULT_DAILY_CAP = 10

/** Past this, a backlog gets re-spaced rather than served as a wall. */
export const BACKLOG_ABSENCE_DAYS = 14

export interface QueueItem {
  id: string
  problemId: string
  slug: string
  title: string
  difficulty: string
  state: RevisionState
  dueAt: string
  /** Negative while it is still in the future. */
  overdueDays: number
  /** Lowest mastery of the problem's topics, or null when untracked. */
  topicMastery: number | null
}

export interface DueQueue {
  items: QueueItem[]
  /** Everything due, including what did not fit. Never hidden from the user. */
  totalDue: number
  /** `totalDue - items.length`. Carried to tomorrow, not dropped. */
  carriedForward: number
  cap: number
  /** True when the backlog is large enough to be re-spaced rather than dumped. */
  catchingUp: boolean
}

/**
 * What to revise today, in the order worth doing it.
 *
 * The ordering is the product. When more is due than anyone can reasonably do,
 * which items get shown decides whether the time spent was the best available.
 */
@Injectable()
export class QueueService {
  async due(userId: string, now = new Date()): Promise<DueQueue> {
    const { timezone, cap } = await this.settings(userId)
    const { end } = localDayBounds(now, timezone)

    /*
     * Everything due before the user's local day ends.
     *
     * Not `<= now`: something due at 22:00 local is due *today*, and hiding it
     * until the evening would make the queue change shape during the day for no
     * reason anyone can see.
     *
     * And `lt`, not `lte`. `end` is the instant the *next* day begins, so an
     * item sitting exactly on it belongs to tomorrow. Re-spacing puts items on
     * precisely that boundary, so an inclusive comparison hands them straight
     * back to today and the cap quietly stops holding.
     */
    const rows = await prisma.revisionItem.findMany({
      where: { userId, dueAt: { lt: end } },
      select: {
        id: true,
        problemId: true,
        state: true,
        dueAt: true,
        problem: {
          select: {
            slug: true,
            title: true,
            difficulty: true,
            topics: { select: { topicId: true } },
          },
        },
      },
    })

    const mastery = await this.topicMastery(userId)
    const ranked = rows
      .map((row) => ({
        id: row.id,
        problemId: row.problemId,
        slug: row.problem.slug,
        title: row.problem.title,
        difficulty: row.problem.difficulty,
        state: row.state,
        dueAt: row.dueAt.toISOString(),
        overdueDays: Math.floor((now.getTime() - row.dueAt.getTime()) / 86_400_000),
        topicMastery: weakestTopic(row.problem.topics, mastery),
      }))
      .sort(byPriority)

    const items = ranked.slice(0, cap)

    return {
      items,
      totalDue: ranked.length,
      // Shown, not hidden. "24 to catch up on, 10 today" is a plan; a queue
      // that silently forgets fourteen of them is a lie.
      carriedForward: Math.max(0, ranked.length - items.length),
      cap,
      catchingUp: ranked.some((item) => item.overdueDays >= BACKLOG_ABSENCE_DAYS),
    }
  }

  /**
   * The week ahead, by local day.
   *
   * Capped per day the same way, so the calendar shows what the user will
   * actually be asked to do rather than a raw count that the queue will then
   * quietly truncate.
   */
  async upcoming(
    userId: string,
    days = 7,
    now = new Date(),
  ): Promise<{ date: string; due: number; capped: number }[]> {
    const { timezone, cap } = await this.settings(userId)
    const { start } = localDayBounds(now, timezone)

    const horizon = new Date(start.getTime() + days * 86_400_000)
    const rows = await prisma.revisionItem.findMany({
      where: { userId, dueAt: { lt: horizon } },
      select: { dueAt: true },
    })

    const buckets = new Map<string, number>()
    for (const row of rows) {
      // Anything already overdue lands on today — that is when it will be
      // offered, so that is where the calendar should show it.
      const at = row.dueAt.getTime() < start.getTime() ? start : row.dueAt
      const index = Math.floor((at.getTime() - start.getTime()) / 86_400_000)
      const date = new Date(start.getTime() + index * 86_400_000).toISOString().slice(0, 10)
      buckets.set(date, (buckets.get(date) ?? 0) + 1)
    }

    return Array.from({ length: days }, (_, index) => {
      const date = new Date(start.getTime() + index * 86_400_000).toISOString().slice(0, 10)
      const due = buckets.get(date) ?? 0
      return { date, due, capped: Math.min(due, cap) }
    })
  }

  /**
   * Spreads a backlog across the coming days instead of dumping it.
   *
   * Called after a long absence. The items are not dropped and their order is
   * preserved — the highest-priority ones keep today's slots, and the rest are
   * moved to the next days that have room. A user who comes back to "24 to
   * catch up on, 10 today" continues; one who comes back to a wall of forty
   * does not.
   */
  async respaceBacklog(userId: string, now = new Date()): Promise<number> {
    const { timezone, cap } = await this.settings(userId)
    const { start } = localDayBounds(now, timezone)

    const rows = await prisma.revisionItem.findMany({
      where: { userId, dueAt: { lt: start } },
      select: {
        id: true,
        state: true,
        dueAt: true,
        problem: { select: { difficulty: true, topics: { select: { topicId: true } } } },
      },
    })

    if (rows.length <= cap) {
      return 0
    }

    const mastery = await this.topicMastery(userId)
    const ranked = rows
      .map((row) => ({
        id: row.id,
        state: row.state,
        dueAt: row.dueAt.toISOString(),
        overdueDays: Math.floor((now.getTime() - row.dueAt.getTime()) / 86_400_000),
        difficulty: row.problem.difficulty,
        topicMastery: weakestTopic(row.problem.topics, mastery),
      }))
      .sort(byPriority)

    let moved = 0
    for (const [index, item] of ranked.entries()) {
      const day = Math.floor(index / cap)
      if (day === 0) {
        // Keeps today's slot. Nothing to write.
        continue
      }
      await prisma.revisionItem.update({
        where: { id: item.id },
        data: { dueAt: new Date(start.getTime() + day * 86_400_000) },
      })
      moved += 1
    }

    return moved
  }

  private async settings(userId: string): Promise<{ timezone: string; cap: number }> {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { timezone: true },
    })

    return {
      // A bad profile value is bad data, not a reason to fail the request.
      timezone: safeTimeZone(profile?.timezone),
      cap: DEFAULT_DAILY_CAP,
    }
  }

  private async topicMastery(userId: string): Promise<Map<string, number>> {
    const rows = await prisma.userTopicProgress.findMany({
      where: { userId },
      select: { topicId: true, masteryScore: true },
    })
    return new Map(rows.map((row) => [row.topicId, row.masteryScore]))
  }
}

const DIFFICULTY_RANK: Record<string, number> = { HARD: 0, MEDIUM: 1, EASY: 2 }

/**
 * The ordering from docs/revision-engine.md, in that exact order.
 *
 * 1. `LAPSED` — knowledge you had and lost is the cheapest to recover, so it is
 *    the highest-return practice available.
 * 2. Most overdue — the longest-neglected is the closest to being gone.
 * 3. Weakest topic — where a recovered item helps the most.
 * 4. Hardest difficulty — when everything else ties, spend the time on the one
 *    that teaches more.
 */
function byPriority(
  a: { state: RevisionState; overdueDays: number; topicMastery: number | null; difficulty: string },
  b: { state: RevisionState; overdueDays: number; topicMastery: number | null; difficulty: string },
): number {
  const lapsed = Number(b.state === 'LAPSED') - Number(a.state === 'LAPSED')
  if (lapsed !== 0) {
    return lapsed
  }

  if (a.overdueDays !== b.overdueDays) {
    return b.overdueDays - a.overdueDays
  }

  // An untracked topic sorts as fully mastered rather than as zero: absence of
  // a score is not evidence of weakness, and treating it as such would push
  // brand-new topics to the top of every queue.
  const masteryA = a.topicMastery ?? 100
  const masteryB = b.topicMastery ?? 100
  if (masteryA !== masteryB) {
    return masteryA - masteryB
  }

  return (DIFFICULTY_RANK[a.difficulty] ?? 3) - (DIFFICULTY_RANK[b.difficulty] ?? 3)
}

function weakestTopic(
  topics: { topicId: string }[],
  mastery: Map<string, number>,
): number | null {
  const scores = topics
    .map((topic) => mastery.get(topic.topicId))
    .filter((score): score is number => score !== undefined)

  return scores.length === 0 ? null : Math.min(...scores)
}
