import { PrismaClient } from '../../generated/client/client'
import { PATTERNS, TOPICS } from './taxonomy'
import { EASY_PROBLEMS } from './problems/easy'
import { MEDIUM_PROBLEMS } from './problems/medium'
import { HARD_PROBLEMS } from './problems/hard'
import type { ProblemSeed } from './problems/problem-seed'

const PROBLEMS: ProblemSeed[] = [...EASY_PROBLEMS, ...MEDIUM_PROBLEMS, ...HARD_PROBLEMS]

/**
 * Seeding is idempotent: every row is reached by `upsert` on a natural key, and
 * children that have been removed from the seed are deleted by position rather
 * than by wiping and recreating. Wiping would hand every test case a new id on
 * every run, and from Phase 4 submissions reference those ids.
 */
async function seedTopics(db: PrismaClient): Promise<Map<string, string>> {
  const ids = new Map<string, string>()

  for (const [index, topic] of TOPICS.entries()) {
    const row = await db.topic.upsert({
      where: { slug: topic.slug },
      create: {
        slug: topic.slug,
        name: topic.name,
        description: topic.description,
        displayOrder: index,
      },
      update: { name: topic.name, description: topic.description, displayOrder: index },
      select: { id: true },
    })
    ids.set(topic.slug, row.id)
  }

  // Prerequisites need every topic to exist first, hence the second pass.
  for (const topic of TOPICS) {
    const topicId = ids.get(topic.slug)
    if (topicId === undefined) {
      continue
    }
    const wanted = topic.prerequisites.map((slug) => {
      const id = ids.get(slug)
      if (id === undefined) {
        throw new Error(`Topic "${topic.slug}" lists unknown prerequisite "${slug}".`)
      }
      return id
    })

    await db.topicPrerequisite.deleteMany({
      where: { topicId, prerequisiteId: { notIn: wanted.length > 0 ? wanted : [topicId] } },
    })
    for (const prerequisiteId of wanted) {
      await db.topicPrerequisite.upsert({
        where: { topicId_prerequisiteId: { topicId, prerequisiteId } },
        create: { topicId, prerequisiteId },
        update: {},
      })
    }
  }

  return ids
}

async function seedPatterns(db: PrismaClient): Promise<Map<string, string>> {
  const ids = new Map<string, string>()

  for (const [index, pattern] of PATTERNS.entries()) {
    const row = await db.pattern.upsert({
      where: { slug: pattern.slug },
      create: {
        slug: pattern.slug,
        name: pattern.name,
        description: pattern.description,
        displayOrder: index,
      },
      update: { name: pattern.name, description: pattern.description, displayOrder: index },
      select: { id: true },
    })
    ids.set(pattern.slug, row.id)
  }

  return ids
}

async function seedRoadmap(db: PrismaClient, topicIds: Map<string, string>): Promise<void> {
  const nodeIds = new Map<string, string>()

  // First pass creates every node parentless: a child can precede its parent in
  // the curriculum array, and the FK would reject it.
  for (const [index, topic] of TOPICS.entries()) {
    const topicId = topicIds.get(topic.slug)
    if (topicId === undefined) {
      continue
    }
    const row = await db.roadmapNode.upsert({
      where: { topicId },
      create: {
        topicId,
        section: topic.section,
        displayOrder: index,
        estimatedHours: topic.estimatedHours,
      },
      update: {
        section: topic.section,
        displayOrder: index,
        estimatedHours: topic.estimatedHours,
      },
      select: { id: true },
    })
    nodeIds.set(topic.slug, row.id)
  }

  for (const topic of TOPICS) {
    const id = nodeIds.get(topic.slug)
    if (id === undefined) {
      continue
    }
    const parentId = topic.parent === null ? null : (nodeIds.get(topic.parent) ?? null)
    if (topic.parent !== null && parentId === null) {
      throw new Error(`Topic "${topic.slug}" lists unknown parent "${topic.parent}".`)
    }
    await db.roadmapNode.update({ where: { id }, data: { parentId } })
  }
}

async function seedProblem(
  db: PrismaClient,
  problem: ProblemSeed,
  topicIds: Map<string, string>,
  patternIds: Map<string, string>,
): Promise<void> {
  const shared = {
    title: problem.title,
    difficulty: problem.difficulty,
    statement: problem.statement,
    constraints: problem.constraints,
    examples: problem.examples,
    starterCode: problem.starterCode,
    timeLimitMs: problem.timeLimitMs,
    memoryLimitMb: problem.memoryLimitMb,
    estimatedMinutes: problem.estimatedMinutes,
    // Everything in the seed is written for this project and reviewed, so it is
    // published. Nothing generated ever arrives here without that review.
    source: 'ORIGINAL' as const,
    aiGenerated: false,
    reviewStatus: 'PUBLISHED' as const,
  }

  const { id: problemId } = await db.problem.upsert({
    where: { slug: problem.slug },
    create: { slug: problem.slug, ...shared },
    update: shared,
    select: { id: true },
  })

  const topicTagIds = problem.topics.map((tag) => {
    const id = topicIds.get(tag.slug)
    if (id === undefined) {
      throw new Error(`Problem "${problem.slug}" is tagged with unknown topic "${tag.slug}".`)
    }
    return { id, relevance: tag.relevance }
  })
  await db.problemTopic.deleteMany({
    where: { problemId, topicId: { notIn: topicTagIds.map((t) => t.id) } },
  })
  for (const tag of topicTagIds) {
    await db.problemTopic.upsert({
      where: { problemId_topicId: { problemId, topicId: tag.id } },
      create: { problemId, topicId: tag.id, relevance: tag.relevance },
      update: { relevance: tag.relevance },
    })
  }

  const patternTagIds = problem.patterns.map((tag) => {
    const id = patternIds.get(tag.slug)
    if (id === undefined) {
      throw new Error(`Problem "${problem.slug}" is tagged with unknown pattern "${tag.slug}".`)
    }
    return { id, relevance: tag.relevance }
  })
  await db.problemPattern.deleteMany({
    where: { problemId, patternId: { notIn: patternTagIds.map((p) => p.id) } },
  })
  for (const tag of patternTagIds) {
    await db.problemPattern.upsert({
      where: { problemId_patternId: { problemId, patternId: tag.id } },
      create: { problemId, patternId: tag.id, relevance: tag.relevance },
      update: { relevance: tag.relevance },
    })
  }

  // Upserted by position so ids survive a re-seed.
  for (const [index, testCase] of problem.testCases.entries()) {
    const body = {
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      isSample: testCase.isSample,
      // Not the inverse of isSample as a rule, but it is for every seeded case:
      // a sample is shown to the user, everything else grades in secret.
      isHidden: !testCase.isSample,
      weight: testCase.weight ?? 1,
    }
    await db.testCase.upsert({
      where: { problemId_displayOrder: { problemId, displayOrder: index } },
      create: { problemId, displayOrder: index, ...body },
      update: body,
    })
  }
  await db.testCase.deleteMany({
    where: { problemId, displayOrder: { gte: problem.testCases.length } },
  })

  for (const [index, content] of problem.hints.entries()) {
    const level = index + 1
    await db.hint.upsert({
      where: { problemId_level: { problemId, level } },
      create: { problemId, level, content },
      update: { content },
    })
  }
  await db.hint.deleteMany({ where: { problemId, level: { gt: problem.hints.length } } })
}

/** Counts after a run, so a caller can assert the seed did what it claims. */
export interface SeedCounts {
  topics: number
  patterns: number
  roadmapNodes: number
  problems: number
  testCases: number
  hints: number
}

export async function seedAll(db: PrismaClient): Promise<SeedCounts> {
  const topicIds = await seedTopics(db)
  const patternIds = await seedPatterns(db)
  await seedRoadmap(db, topicIds)

  for (const problem of PROBLEMS) {
    await seedProblem(db, problem, topicIds, patternIds)
  }

  const [topics, patterns, nodes, problems, testCases, hints] = await Promise.all([
    db.topic.count(),
    db.pattern.count(),
    db.roadmapNode.count(),
    db.problem.count(),
    db.testCase.count(),
    db.hint.count(),
  ])

  return { topics, patterns, roadmapNodes: nodes, problems, testCases, hints }
}
