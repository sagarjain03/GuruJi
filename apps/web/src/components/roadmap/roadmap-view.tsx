'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import type { RoadmapNode, RoadmapSection } from '@guruji/types'
import { EmptyState, ErrorState, LoadingState } from '@/components/content/states'
import { contentApi } from '@/lib/api'

const SECTION_LABEL: Record<RoadmapSection, string> = {
  FOUNDATION: 'Foundation',
  DATA_STRUCTURES: 'Data Structures',
  TREES: 'Trees',
  GRAPHS: 'Graphs',
  ADVANCED: 'Advanced',
}

export function RoadmapView() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['roadmap'],
    queryFn: () => contentApi.roadmap(),
  })

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Roadmap</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          The order the curriculum is meant to be taken in. A topic sits under the one it builds on,
          and its prerequisites are listed on the card — the recommendation engine will not offer
          you a topic whose prerequisites are unmet.
        </p>
      </header>

      {isPending && <LoadingState label="Loading the curriculum…" />}

      {isError && (
        <ErrorState
          message="The roadmap could not be loaded."
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {data?.sections.length === 0 && (
        <EmptyState
          title="No curriculum yet"
          detail="The roadmap is stored in the database. Run the seed to populate it."
        />
      )}

      {data?.sections.map((group) => (
        <section key={group.section} className="flex flex-col gap-2">
          <h2 className="text-muted-foreground font-mono text-[10px] tracking-[0.18em] uppercase">
            {SECTION_LABEL[group.section]}
          </h2>
          <div className="flex flex-col gap-2">
            {group.nodes.map((node) => (
              <TopicBranch key={node.id} node={node} depth={0} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

/**
 * One node and everything under it.
 *
 * Indentation is capped: nesting the padding without a limit makes a deep branch
 * unreadable on a phone, and the tree is only three deep anyway.
 */
function TopicBranch({ node, depth }: { node: RoadmapNode; depth: number }) {
  const indent = Math.min(depth, 3) * 16

  return (
    <div className="flex flex-col gap-2" style={{ paddingLeft: indent }}>
      <TopicCard node={node} />
      {node.children.map((child) => (
        <TopicBranch key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}

function TopicCard({ node }: { node: RoadmapNode }) {
  const { topic } = node

  return (
    <Link
      href={{ pathname: '/problems', query: { topic: topic.slug } }}
      className="border-border bg-card/70 hover:border-foreground/25 block border p-4 transition-colors"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-base font-semibold tracking-tight">{topic.name}</h3>
        <span className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
          {topic.problemCount} {topic.problemCount === 1 ? 'problem' : 'problems'} ·{' '}
          {node.estimatedHours}h
        </span>
      </div>

      <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{topic.description}</p>

      {topic.prerequisiteSlugs.length > 0 && (
        <p className="text-muted-foreground mt-2 font-mono text-[10px] tracking-[0.1em]">
          NEEDS FIRST: {topic.prerequisiteSlugs.join(' · ')}
        </p>
      )}
    </Link>
  )
}
