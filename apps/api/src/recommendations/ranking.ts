import type { RecommendationKind, ScoredCandidate, UserContext } from './scoring'

/** No more than this many from one topic in the returned set. */
export const MAX_PER_TOPIC = 2

/**
 * Picks the final set, and refuses to let the engine collapse onto one thing.
 *
 * Without this stage a user weak at dynamic programming gets dynamic
 * programming, all day, until they quit. The rules below cost some raw score
 * and buy a system people keep opening.
 */
export function diversify(scored: ScoredCandidate[], limit: number): ScoredCandidate[] {
  // Zero means a gate refused it — an unmet prerequisite. Never surface those.
  const viable = scored.filter((entry) => entry.score > 0)
  const ranked = [...viable].sort((a, b) => b.score - a.score)

  const chosen: ScoredCandidate[] = []
  const perTopic = new Map<string, number>()

  for (const entry of ranked) {
    if (chosen.length >= limit) {
      break
    }
    if (exceedsTopicCap(entry, perTopic)) {
      continue
    }
    chosen.push(entry)
    countTopics(entry, perTopic)
  }

  /*
   * The morale rule, and it is deliberate.
   *
   * A training system that only ever shows you what you are worst at is one you
   * stop opening. If everything chosen sits in the single weakest topic, the
   * lowest-ranked slot is given to the best candidate from anywhere else — even
   * though that costs raw score.
   */
  const weakest = weakestTopicOf(chosen)
  if (weakest !== null && chosen.every((entry) => entry.candidate.topicIds.includes(weakest))) {
    const outsider = ranked.find((entry) => !entry.candidate.topicIds.includes(weakest))
    if (outsider !== undefined && chosen.length > 0) {
      chosen[chosen.length - 1] = outsider
    }
  }

  return chosen
}

function exceedsTopicCap(entry: ScoredCandidate, perTopic: Map<string, number>): boolean {
  return entry.candidate.topicIds.some((topicId) => (perTopic.get(topicId) ?? 0) >= MAX_PER_TOPIC)
}

function countTopics(entry: ScoredCandidate, perTopic: Map<string, number>): void {
  for (const topicId of entry.candidate.topicIds) {
    perTopic.set(topicId, (perTopic.get(topicId) ?? 0) + 1)
  }
}

/** The topic every chosen candidate shares, if there is exactly one. */
function weakestTopicOf(chosen: ScoredCandidate[]): string | null {
  const first = chosen[0]?.candidate.topicIds[0]
  return first ?? null
}

export interface PrecedenceInput {
  lapsedDue: number
  totalDue: number
  /** Points below the user's own average, for the weakest topic. */
  weakestTopicGap: number
  averageMastery: number
  daysSinceLastContest: number | null
  hasReachableNewPattern: boolean
}

/**
 * What **TRAIN NOW** should do, before any scoring happens.
 *
 * Revision outranks new material because retention is the scarcer resource:
 * solving something new while four solved problems fade is a net loss. The
 * ladder is checked in order and the first match wins.
 */
export function decideActivity(input: PrecedenceInput): RecommendationKind {
  if (input.lapsedDue > 0) {
    return 'REVISION'
  }
  // More than a handful due means the queue is the problem, not the syllabus.
  if (input.totalDue > 3) {
    return 'REVISION'
  }
  if (input.weakestTopicGap > 20) {
    return 'WEAK_TOPIC'
  }
  // Broad competence, but untested under a clock.
  if (
    input.averageMastery >= 60 &&
    (input.daysSinceLastContest === null || input.daysSinceLastContest > 7)
  ) {
    return 'MOCK_CHALLENGE'
  }
  if (input.hasReachableNewPattern) {
    return 'NEW_PATTERN'
  }
  return 'NEW_PROBLEM'
}

/**
 * The reason, derived from the numbers that produced the score.
 *
 * **Never written by a model.** This is the user's only window into the engine,
 * and a plausible invented explanation is worse than none — it would teach them
 * to trust a system that is guessing. Everything below is a restatement of a
 * value that actually went into the ranking.
 */
export function explain(entry: ScoredCandidate, context: UserContext): string {
  const { candidate, breakdown } = entry

  if (candidate.revision !== undefined) {
    if (candidate.revision.state === 'LAPSED') {
      return 'You solved this once and lost it. Knowledge you had is the fastest to get back.'
    }
    const overdue = candidate.revision.overdueDays
    if (overdue > 0) {
      return `Due for revision ${String(overdue)} day${overdue === 1 ? '' : 's'} ago. Recall it before it fades.`
    }
    return 'Due for revision today. Recall it before it fades.'
  }

  // Honest about having nothing to go on. "Starting at the beginning" is true;
  // a fabricated weakness claim would not be.
  if (context.coldStart) {
    return 'Starting at the beginning of the roadmap — nothing solved yet to go on.'
  }

  if (breakdown.weaknessSignal > 0.3) {
    const weakest = Math.min(
      ...candidate.topicIds
        .map((topicId) => context.topicMastery.get(topicId))
        .filter((score): score is number => score !== undefined),
    )
    return `Your weakest area right now — mastery ${String(Math.round(weakest))} against your average of ${String(Math.round(context.averageMastery))}.`
  }

  if (breakdown.patternGap > 0.6) {
    return 'Introduces a technique you have barely used, and the prerequisites are already met.'
  }

  if (candidate.difficulty === 'HARD') {
    return 'A step up from what you have been solving. Just above your current level, which is where progress happens.'
  }

  return 'Next along the roadmap, at about the level you are working at.'
}
