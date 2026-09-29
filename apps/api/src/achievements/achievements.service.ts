import { Injectable } from '@nestjs/common'
import { prisma } from '@guruji/database'
import type { AchievementTier, TrophyCase, Unlock } from '@guruji/types'
import { problemOutcome, shouldFinish } from '../contests/scoring'
import { BADGES } from './catalog'
import { computeMetrics, type ProblemFacts } from './metrics'
import { momentsToShow, resolveTier } from './tiers'

const RANK: Record<AchievementTier, number> = { BRONZE: 1, SILVER: 2, GOLD: 3, PLATINUM: 4, DIAMOND: 5 }

/**
 * Badges, evaluated on read.
 *
 * Every metric is computed from data the rest of the app already records; this
 * module only reads it. The dependency runs one way — achievements read the
 * engines, the engines never read achievements — so nothing here can move a
 * mastery score, a recommendation or a revision date.
 */
@Injectable()
export class AchievementsService {
  async trophyCase(userId: string, now = new Date()): Promise<TrophyCase> {
    const metrics = computeMetrics(await this.inputs(userId, now))
    const resolved = BADGES.map((badge) => ({ badge, ...resolveTier(metrics[badge.metric], badge.tiers) }))

    // Record every tier crossed for the first time. `skipDuplicates` makes two
    // tabs evaluating at once safe: the unique index keeps one row per tier.
    const existing = await prisma.userAchievement.findMany({ where: { userId }, select: { badge: true, tier: true } })
    const have = new Set(existing.map((row) => `${row.badge}:${row.tier}`))
    const crossed = resolved.flatMap(({ badge, earned }) =>
      earned.filter((tier) => !have.has(`${badge.slug}:${tier}`)).map((tier) => ({ badge: badge.slug, tier })),
    )
    if (crossed.length > 0) {
      await prisma.userAchievement.createMany({
        data: crossed.map((unlock) => ({ userId, badge: unlock.badge, tier: unlock.tier, unlockedAt: now })),
        skipDuplicates: true,
      })
    }

    const unlocks = await prisma.userAchievement.findMany({
      where: { userId },
      select: { badge: true, tier: true, unlockedAt: true, seenAt: true },
    })
    const unlockedAt = new Map(unlocks.map((row) => [`${row.badge}:${row.tier}`, row.unlockedAt.toISOString()]))
    const unseen: Unlock[] = BADGES.flatMap((badge) =>
      unlocks
        .filter((row) => row.badge === badge.slug && row.seenAt === null)
        .map((row) => ({ badge: row.badge, tier: row.tier })),
    )

    return {
      badges: resolved.map(({ badge, tier, next }) => ({
        slug: badge.slug,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        value: metrics[badge.metric],
        tier,
        next,
        tiers: badge.tiers.map((definition) => ({
          tier: definition.tier,
          threshold: definition.threshold,
          unlockedAt: unlockedAt.get(`${badge.slug}:${definition.tier}`) ?? null,
        })),
      })),
      new: momentsToShow(unseen),
    }
  }

  /**
   * Acknowledges unlock moments. Seeing a badge's highest new tier also marks
   * the lower tiers crossed with it as seen — they were shown as one moment.
   */
  async markSeen(userId: string, unlocks: Unlock[], now = new Date()): Promise<void> {
    for (const unlock of unlocks) {
      const tiers = (Object.keys(RANK) as AchievementTier[]).filter((tier) => RANK[tier] <= RANK[unlock.tier])
      await prisma.userAchievement.updateMany({
        where: { userId, badge: unlock.badge, tier: { in: tiers }, seenAt: null },
        data: { seenAt: now },
      })
    }
  }

  private async inputs(userId: string, now: Date) {
    const [submissions, revisionOutcomes, mistakes, contests] = await Promise.all([
      prisma.submission.findMany({
        where: { userId, isRun: false, status: 'COMPLETED', verdict: { not: 'INTERNAL_ERROR' } },
        select: { problemId: true, verdict: true, createdAt: true, hintsUsedAtSubmit: true, language: true },
      }),
      prisma.revisionReview.findMany({ where: { item: { userId } }, select: { outcome: true } }),
      prisma.mistake.findMany({ where: { userId }, select: { correctIdea: true } }),
      prisma.contest.findMany({
        where: { userId },
        select: {
          status: true,
          deadlineAt: true,
          problems: { select: { problemId: true } },
          submissions: {
            select: { problemId: true, submission: { select: { verdict: true, createdAt: true } } },
          },
        },
      }),
    ])

    const problemIds = [...new Set(submissions.map((submission) => submission.problemId))]
    const facts = await prisma.problem.findMany({
      where: { id: { in: problemIds } },
      select: {
        id: true,
        difficulty: true,
        topics: { select: { topicId: true } },
        patterns: { select: { patternId: true } },
      },
    })

    return {
      submissions,
      problems: new Map<string, ProblemFacts>(
        facts.map((problem) => [
          problem.id,
          {
            difficulty: problem.difficulty,
            topicIds: problem.topics.map((topic) => topic.topicId),
            patternIds: problem.patterns.map((pattern) => pattern.patternId),
          },
        ]),
      ),
      revisionOutcomes: revisionOutcomes.map((review) => review.outcome),
      mistakes,
      contests: contests.map((contest) => {
        const attempts = contest.submissions.map((row) => ({
          problemId: row.problemId,
          verdict: row.submission.verdict,
          createdAt: row.submission.createdAt,
        }))
        return {
          // Past its deadline but not yet read since: finished, just not written down yet.
          status: shouldFinish(contest, now) ? ('FINISHED' as const) : contest.status,
          problems: contest.problems.length,
          solved: contest.problems.filter(
            (entry) =>
              problemOutcome(
                attempts.filter((attempt) => attempt.problemId === entry.problemId),
                contest.deadlineAt,
              ).solved,
          ).length,
        }
      }),
    }
  }
}
