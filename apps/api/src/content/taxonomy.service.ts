import { Injectable } from '@nestjs/common'
import { prisma } from '@guruji/database'
import type {
  PatternSummary,
  Roadmap,
  RoadmapNode,
  RoadmapSection,
  TopicDetail,
  TopicSummary,
} from '@guruji/types'
import { NotFoundError } from '../common/app-error'
import { CACHE_TTL, ContentCache } from './content-cache.service'
import { ProblemRepository } from './problem.repository'

/** Section order is the curriculum order, and it is fixed. */
const SECTION_ORDER: RoadmapSection[] = [
  'FOUNDATION',
  'DATA_STRUCTURES',
  'TREES',
  'GRAPHS',
  'ADVANCED',
]

const TOPIC_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  displayOrder: true,
  prerequisites: { select: { prerequisite: { select: { slug: true, name: true } } } },
  _count: { select: { problems: true } },
} as const

@Injectable()
export class TaxonomyService {
  constructor(
    private readonly cache: ContentCache,
    private readonly problems: ProblemRepository,
  ) {}

  async topics(): Promise<TopicSummary[]> {
    return this.cache.wrap('content:topics:v1', CACHE_TTL.taxonomy, async () => {
      const rows = await prisma.topic.findMany({
        select: TOPIC_SELECT,
        orderBy: { displayOrder: 'asc' },
      })
      return rows.map((row) => this.toSummary(row))
    })
  }

  async patterns(): Promise<PatternSummary[]> {
    return this.cache.wrap('content:patterns:v1', CACHE_TTL.taxonomy, async () => {
      const rows = await prisma.pattern.findMany({
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          displayOrder: true,
          _count: { select: { problems: true } },
        },
        orderBy: { displayOrder: 'asc' },
      })

      return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        displayOrder: row.displayOrder,
        problemCount: row._count.problems,
      }))
    })
  }

  /**
   * A topic plus its problems.
   *
   * Not cached: the problem list it embeds gains a per-user solved overlay in
   * Phase 5, and a shared cache key that later has to become user-specific is
   * the caching bug that shows one user another user's progress. Cheaper to
   * leave uncached now than to remember to fix it then.
   */
  async topic(slug: string): Promise<TopicDetail> {
    const row = await prisma.topic.findUnique({ where: { slug }, select: TOPIC_SELECT })
    if (row === null) {
      throw new NotFoundError('TOPIC_NOT_FOUND', 'That topic does not exist.')
    }

    const problems = await this.problems.list({ topic: slug, limit: 50 })

    return {
      ...this.toSummary(row),
      prerequisites: row.prerequisites.map((p) => p.prerequisite),
      problems: problems.items,
    }
  }

  async roadmap(): Promise<Roadmap> {
    return this.cache.wrap('content:roadmap:v1', CACHE_TTL.taxonomy, async () => {
      const rows = await prisma.roadmapNode.findMany({
        select: {
          id: true,
          parentId: true,
          section: true,
          displayOrder: true,
          estimatedHours: true,
          topic: { select: TOPIC_SELECT },
        },
        orderBy: { displayOrder: 'asc' },
      })

      const nodes = new Map<string, RoadmapNode>()
      for (const row of rows) {
        nodes.set(row.id, {
          id: row.id,
          section: row.section,
          displayOrder: row.displayOrder,
          estimatedHours: row.estimatedHours,
          topic: this.toSummary(row.topic),
          children: [],
        })
      }

      // Second pass, because a child can be read before its parent.
      const roots: { parentId: string | null; node: RoadmapNode }[] = []
      for (const row of rows) {
        const node = nodes.get(row.id)
        if (node === undefined) {
          continue
        }
        const parent = row.parentId === null ? undefined : nodes.get(row.parentId)
        if (parent === undefined) {
          roots.push({ parentId: row.parentId, node })
        } else {
          parent.children.push(node)
        }
      }

      return {
        sections: SECTION_ORDER.map((section) => ({
          section,
          nodes: roots.filter((r) => r.node.section === section).map((r) => r.node),
        })).filter((group) => group.nodes.length > 0),
      }
    })
  }

  private toSummary(row: {
    id: string
    slug: string
    name: string
    description: string
    displayOrder: number
    prerequisites: { prerequisite: { slug: string; name: string } }[]
    _count: { problems: number }
  }): TopicSummary {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      displayOrder: row.displayOrder,
      problemCount: row._count.problems,
      prerequisiteSlugs: row.prerequisites.map((p) => p.prerequisite.slug),
    }
  }
}
