import { Inject, Injectable } from '@nestjs/common'
import { prisma, type RecommendationKind as DbKind } from '@guruji/database'
import type Redis from 'ioredis'
import { REDIS } from '../redis/redis.module'
import { CandidatesService } from './candidates.service'
import { decideActivity, diversify, explain } from './ranking'
import { scoreCandidate, type Candidate, type UserContext } from './scoring'

/** How many the dashboard shows. */
const BATCH_SIZE = 5

/**
 * Fifteen minutes, and dropped the moment the user submits anything.
 *
 * Recommendations are moderately expensive and read on every dashboard load, so
 * they are worth caching. But a stale recommendation *after* a submission
 * defeats the entire premise of the product — so the invalidation is not
 * optional, and it is the submission path's job to call it.
 */
const CACHE_TTL_SECONDS = 15 * 60

export interface RecommendationView {
  id: string
  kind: string
  problemId: string | null
  slug: string | null
  title: string | null
  difficulty: string | null
  score: number
  reason: string
}

export interface TrainNowView {
  kind: string
  recommendation: RecommendationView | null
  reason: string
}

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly candidates: CandidatesService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /** The cache key. Per user, always — there is no shared recommendation cache. */
  private key(userId: string): string {
    return `rec:batch:${userId}`
  }

  async invalidate(userId: string): Promise<void> {
    await this.redis.del(this.key(userId))
  }

  async batch(userId: string, now = new Date()): Promise<RecommendationView[]> {
    const cached = await this.redis.get(this.key(userId)).catch(() => null)
    if (cached !== null) {
      return JSON.parse(cached) as RecommendationView[]
    }

    const views = await this.build(userId, now)

    await this.redis
      .set(this.key(userId), JSON.stringify(views), 'EX', CACHE_TTL_SECONDS)
      .catch(() => undefined)

    return views
  }

  /**
   * One activity, decided before any scoring happens.
   *
   * The ladder answers "what should I do", and only then does the engine pick
   * something to do it with. Scoring first and labelling afterwards would let a
   * high-scoring new problem outrank a queue of four fading solves — which is
   * precisely the trade the ladder exists to refuse.
   */
  async trainNow(userId: string, now = new Date()): Promise<TrainNowView> {
    const context = await this.candidates.contextFor(userId)
    const [lapsedDue, totalDue] = await Promise.all([
      prisma.revisionItem.count({ where: { userId, state: 'LAPSED', dueAt: { lte: now } } }),
      prisma.revisionItem.count({ where: { userId, dueAt: { lte: now } } }),
    ])

    const weakest = Math.min(...[...context.topicMastery.values(), context.averageMastery])

    const kind = decideActivity({
      lapsedDue,
      totalDue,
      weakestTopicGap: context.averageMastery - weakest,
      averageMastery: context.averageMastery,
      // Contests arrive in Phase 11. Until then there has never been one, which
      // is the honest value rather than a placeholder that suppresses the rung.
      daysSinceLastContest: null,
      hasReachableNewPattern: [...context.patternAttempts.values()].some(
        (attempts) => attempts < 3,
      ),
    })

    const batch = await this.batch(userId, now)
    // The best candidate of that kind, or the best of anything when the chosen
    // activity has nothing behind it yet.
    const picked = batch.find((entry) => entry.kind === kind) ?? batch[0] ?? null

    return {
      kind,
      recommendation: picked,
      reason: picked?.reason ?? 'Nothing to recommend yet — solve something and this fills in.',
    }
  }

  async dismiss(userId: string, id: string): Promise<boolean> {
    // Ownership in the `WHERE`, not a comparison after the read.
    const updated = await prisma.recommendation.updateMany({
      where: { id, userId, dismissedAt: null },
      data: { dismissedAt: new Date() },
    })

    if (updated.count === 0) {
      return false
    }

    // The next batch has to see the dismissal, so the cached one has to go.
    await this.invalidate(userId)
    return true
  }

  private async build(userId: string, now: Date): Promise<RecommendationView[]> {
    const context = await this.candidates.contextFor(userId)
    const pool = await this.candidates.generate(userId, context, now)

    const dismissals = await this.candidates.dismissalsFor(
      userId,
      pool.map((candidate) => candidate.problemId),
    )

    const scored = pool.map((candidate) =>
      scoreCandidate(
        { ...candidate, dismissals: dismissals.get(candidate.problemId) ?? 0 },
        context,
      ),
    )

    const chosen = diversify(scored, BATCH_SIZE)

    return this.persist(userId, chosen, context, now)
  }

  /**
   * Written down, not just returned.
   *
   * Dismissals feed `recencyPenalty`, so the engine has to remember being
   * ignored. And keeping them makes it *evaluable* afterwards — was it
   * accepted, was it solved, did mastery move — which is how the weights get
   * tuned with evidence rather than intuition.
   */
  private async persist(
    userId: string,
    chosen: ReturnType<typeof diversify>,
    context: UserContext,
    now: Date,
  ): Promise<RecommendationView[]> {
    const expiresAt = new Date(now.getTime() + CACHE_TTL_SECONDS * 1000)

    const rows = await Promise.all(
      chosen.map((entry) =>
        prisma.recommendation.create({
          data: {
            userId,
            problemId: entry.candidate.problemId,
            kind: entry.candidate.kind as DbKind,
            score: entry.score,
            reason: explain(entry, context),
            expiresAt,
          },
          select: { id: true, kind: true, score: true, reason: true },
        }),
      ),
    )

    return rows.map((row, index) => {
      const candidate = chosen[index]?.candidate as Candidate
      return {
        id: row.id,
        kind: row.kind,
        problemId: candidate.problemId,
        slug: candidate.slug,
        title: candidate.title,
        difficulty: candidate.difficulty,
        score: row.score,
        reason: row.reason,
      }
    })
  }
}
