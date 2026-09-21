import { Injectable } from '@nestjs/common'
import { prisma } from '@guruji/database'
import type { Candidate, UserContext } from './scoring'

/** Per pool, so one pool cannot crowd out the others. */
const POOL_LIMIT = 20

/** Batches whose contents still count as "recently shown". */
const RECENT_BATCHES = 3

const DAY_MS = 86_400_000

/**
 * Builds the pool the scorer chooses from, and the picture of the user it
 * chooses against.
 *
 * Deliberately over-generated — roughly fifty — and cut later. Scoring a small
 * pool well beats scoring a huge pool badly, but scoring a pool that is *too*
 * small produces the same three problems every day, which is the failure mode
 * users actually notice.
 */
@Injectable()
export class CandidatesService {
  async contextFor(userId: string): Promise<UserContext> {
    const [topics, patterns, profile, recent] = await Promise.all([
      prisma.userTopicProgress.findMany({
        where: { userId },
        select: { topicId: true, masteryScore: true, attempts: true },
      }),
      prisma.userPatternProgress.findMany({
        where: { userId },
        select: { patternId: true, attempts: true },
      }),
      prisma.profile.findUnique({
        where: { userId },
        select: { difficultyTolerance: true, experienceLevel: true },
      }),
      this.recentlyRecommended(userId),
    ])

    const practised = topics.filter((topic) => topic.attempts > 0)
    const averageMastery =
      practised.length === 0
        ? 0
        : practised.reduce((total, topic) => total + topic.masteryScore, 0) / practised.length

    // Nothing practised means every signal is undefined, and the engine says so
    // rather than inventing a weakness to justify its first pick.
    const coldStart = practised.length === 0

    return {
      averageMastery,
      topicMastery: new Map(practised.map((topic) => [topic.topicId, topic.masteryScore])),
      patternAttempts: new Map(patterns.map((pattern) => [pattern.patternId, pattern.attempts])),
      difficultyTolerance: profile?.difficultyTolerance ?? 0.5,
      blockedTopicIds: await this.blockedTopics(userId),
      recentlyRecommended: recent,
      coldStart,
    }
  }

  /**
   * Topics whose prerequisites this user has not met.
   *
   * "Met" is a solve in the prerequisite topic, not merely an attempt. Having
   * tried graphs twice and failed is not grounds for unlocking what comes after.
   */
  private async blockedTopics(userId: string): Promise<Set<string>> {
    const [edges, progress, empty] = await Promise.all([
      prisma.topicPrerequisite.findMany({ select: { topicId: true, prerequisiteId: true } }),
      prisma.userTopicProgress.findMany({
        where: { userId, solved: { gt: 0 } },
        select: { topicId: true },
      }),
      this.topicsWithNoProblems(),
    ])

    const satisfied = new Set(progress.map((row) => row.topicId))
    const blocked = new Set<string>()

    for (const edge of edges) {
      /*
       * A topic with nothing in it is satisfied by default.
       *
       * Without this the gate is a dead end rather than a gate. This curriculum
       * is a chain, and the topic at the head of it has no published problems —
       * so "solve something here first" is an instruction nobody can follow,
       * and every topic downstream stays blocked forever. A brand-new account
       * gets an empty dashboard and no way to earn its way out.
       *
       * You cannot require someone to solve a topic that has nothing to solve.
       */
      if (!satisfied.has(edge.prerequisiteId) && !empty.has(edge.prerequisiteId)) {
        blocked.add(edge.topicId)
      }
    }

    return blocked
  }

  private async topicsWithNoProblems(): Promise<Set<string>> {
    const rows = await prisma.topic.findMany({
      where: { problems: { none: { problem: { reviewStatus: 'PUBLISHED' } } } },
      select: { id: true },
    })
    return new Set(rows.map((row) => row.id))
  }

  private async recentlyRecommended(userId: string): Promise<Set<string>> {
    const rows = await prisma.recommendation.findMany({
      where: { userId, problemId: { not: null } },
      select: { problemId: true },
      orderBy: { generatedAt: 'desc' },
      // Five per batch is the shape the dashboard asks for.
      take: RECENT_BATCHES * 5,
    })

    return new Set(rows.map((row) => row.problemId).filter((id): id is string => id !== null))
  }

  /**
   * Four pools, bounded, merged.
   *
   * Merged by problem id rather than concatenated: a problem can be both due
   * for revision and in a weak topic, and showing it twice would waste one of
   * the five slots the user actually looks at.
   */
  async generate(userId: string, context: UserContext, now = new Date()): Promise<Candidate[]> {
    const [revision, weak, unexplored, roadmap] = await Promise.all([
      this.dueRevision(userId, now),
      this.weakTopics(userId, context),
      this.unexploredPatterns(userId, context),
      this.roadmapNext(userId),
    ])

    const merged = new Map<string, Candidate>()
    // Revision first, so its richer entry wins the merge.
    for (const candidate of [...revision, ...weak, ...unexplored, ...roadmap]) {
      if (!merged.has(candidate.problemId)) {
        merged.set(candidate.problemId, candidate)
      }
    }

    return [...merged.values()]
  }

  private async dueRevision(userId: string, now: Date): Promise<Candidate[]> {
    const rows = await prisma.revisionItem.findMany({
      where: { userId, dueAt: { lte: new Date(now.getTime() + DAY_MS) } },
      select: {
        problemId: true,
        state: true,
        dueAt: true,
        problem: {
          select: {
            slug: true,
            title: true,
            difficulty: true,
            topics: { select: { topicId: true } },
            patterns: { select: { patternId: true } },
          },
        },
      },
      orderBy: { dueAt: 'asc' },
      take: POOL_LIMIT,
    })

    return rows.map((row) => ({
      problemId: row.problemId,
      slug: row.problem.slug,
      title: row.problem.title,
      difficulty: row.problem.difficulty,
      topicIds: row.problem.topics.map((topic) => topic.topicId),
      patternIds: row.problem.patterns.map((pattern) => pattern.patternId),
      kind: 'REVISION' as const,
      revision: {
        overdueDays: Math.floor((now.getTime() - row.dueAt.getTime()) / DAY_MS),
        state: row.state,
      },
      solved: true,
      dismissals: 0,
    }))
  }

  private async weakTopics(userId: string, context: UserContext): Promise<Candidate[]> {
    const below = [...context.topicMastery.entries()]
      .filter(([, score]) => score < context.averageMastery)
      .map(([topicId]) => topicId)

    if (below.length === 0) {
      return []
    }

    return this.unsolvedIn(userId, { topics: { some: { topicId: { in: below } } } }, 'WEAK_TOPIC')
  }

  private async unexploredPatterns(userId: string, context: UserContext): Promise<Candidate[]> {
    const barelyTouched = [...context.patternAttempts.entries()]
      .filter(([, attempts]) => attempts < 3)
      .map(([patternId]) => patternId)

    const where =
      barelyTouched.length > 0
        ? { patterns: { some: { patternId: { in: barelyTouched } } } }
        : // Nothing tracked yet means every pattern is unexplored.
          { patterns: { some: {} } }

    return this.unsolvedIn(userId, where, 'NEW_PATTERN')
  }

  /** The next thing along the roadmap, for when nothing else applies. */
  private async roadmapNext(userId: string): Promise<Candidate[]> {
    return this.unsolvedIn(userId, {}, 'NEW_PROBLEM')
  }

  private async unsolvedIn(
    userId: string,
    where: Record<string, unknown>,
    kind: Candidate['kind'],
  ): Promise<Candidate[]> {
    const rows = await prisma.problem.findMany({
      where: {
        ...where,
        reviewStatus: 'PUBLISHED',
        // Never solved by this user. `none` rather than filtering afterwards,
        // so the database does the work and the pool stays the size asked for.
        submissions: { none: { userId, verdict: 'ACCEPTED', isRun: false } },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        difficulty: true,
        topics: { select: { topicId: true } },
        patterns: { select: { patternId: true } },
        submissions: {
          where: { userId, isRun: false },
          select: { createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      /*
       * Easiest first, then oldest.
       *
       * This ordering is what makes the cold-start path honest: with no history
       * to rank against, the pool itself has to arrive in curriculum order, and
       * `difficulty` is the closest proxy the problem table carries. A random
       * twenty would make "starting at the beginning of the roadmap" a false
       * claim in the reason text.
       */
      orderBy: [{ difficulty: 'asc' }, { createdAt: 'asc' }],
      take: POOL_LIMIT,
    })

    const now = Date.now()

    return rows.map((row) => {
      const lastAttempt = row.submissions[0]?.createdAt
      return {
        problemId: row.id,
        slug: row.slug,
        title: row.title,
        difficulty: row.difficulty,
        topicIds: row.topics.map((topic) => topic.topicId),
        patternIds: row.patterns.map((pattern) => pattern.patternId),
        kind,
        solved: false,
        ...(lastAttempt === undefined
          ? {}
          : { lastAttemptedDaysAgo: Math.floor((now - lastAttempt.getTime()) / DAY_MS) }),
        dismissals: 0,
      }
    })
  }

  /** How often each candidate has been waved away. Feeds `recencyPenalty`. */
  async dismissalsFor(userId: string, problemIds: string[]): Promise<Map<string, number>> {
    if (problemIds.length === 0) {
      return new Map()
    }

    const rows = await prisma.recommendation.groupBy({
      by: ['problemId'],
      where: { userId, problemId: { in: problemIds }, dismissedAt: { not: null } },
      _count: { _all: true },
    })

    return new Map(
      rows
        .filter((row): row is typeof row & { problemId: string } => row.problemId !== null)
        .map((row) => [row.problemId, row._count._all]),
    )
  }
}
