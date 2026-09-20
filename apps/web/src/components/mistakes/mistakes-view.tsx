'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import {
  MISTAKE_CATEGORY_LABEL,
  type Mistake,
  type MistakeCategory,
  type MistakePattern,
} from '@guruji/types'
import { mistakeApi } from '@/lib/api'
import { cn } from '@/lib/utils'

export function MistakesView() {
  const [category, setCategory] = useState<MistakeCategory | null>(null)

  const patterns = useQuery({
    queryKey: ['mistakes', 'patterns'],
    queryFn: () => mistakeApi.patterns(),
    staleTime: 30_000,
  })

  const list = useQuery({
    queryKey: ['mistakes', 'list', category],
    queryFn: () => mistakeApi.list({ ...(category === null ? {} : { category }), limit: 50 }),
    staleTime: 30_000,
  })

  const entries = list.data?.items ?? []
  const found = patterns.data?.patterns ?? []

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Mistake journal</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {/* The point of the feature, said out loud. One entry is a note; six
              of the same kind is something to go and practise. */}
          Written down at the moment it happened. The value is in what repeats.
        </p>
      </header>

      {found.length > 0 && (
        <section className="border-border border p-4">
          <h2 className="font-display text-base font-semibold">What keeps happening</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Most frequent first. Tap one to see only those.
          </p>

          <ul className="mt-3 flex flex-col gap-2">
            {found.map((pattern) => (
              <PatternRow
                key={pattern.category}
                pattern={pattern}
                selected={category === pattern.category}
                onSelect={() => {
                  setCategory(category === pattern.category ? null : pattern.category)
                }}
              />
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-semibold">
            {category === null ? 'Everything' : MISTAKE_CATEGORY_LABEL[category]}
          </h2>
          {category !== null && (
            <button
              type="button"
              onClick={() => {
                setCategory(null)
              }}
              className="text-muted-foreground hover:text-foreground font-mono text-[10px] tracking-[0.14em] uppercase"
            >
              Clear filter
            </button>
          )}
        </div>

        {list.isPending ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nothing logged yet. After a wrong answer the result panel offers to write down what
            went wrong — that is where these come from.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((entry) => (
              <MistakeRow key={entry.id} mistake={entry} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function PatternRow({
  pattern,
  selected,
  onSelect,
}: {
  pattern: MistakePattern
  selected: boolean
  onSelect: () => void
}) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={cn(
          'border-border hover:bg-accent/40 flex w-full items-baseline gap-3 border p-2.5 text-left',
          selected && 'border-primary',
        )}
      >
        <span className="font-mono text-sm">{pattern.count}×</span>
        <span className="flex-1 text-sm font-medium">
          {MISTAKE_CATEGORY_LABEL[pattern.category]}
        </span>
        {/* The topics are what turn a count into a diagnosis: "off by one" is a
            label, "off by one, and four of them in binary search" is a plan. */}
        <span className="text-muted-foreground truncate text-xs">
          {pattern.topics
            .slice(0, 3)
            .map((topic) => `${topic.name} ×${String(topic.count)}`)
            .join(' · ')}
        </span>
      </button>
    </li>
  )
}

function MistakeRow({ mistake }: { mistake: Mistake }) {
  return (
    <li className="border-border border p-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <Link
          href={`/problems/${mistake.problemSlug}`}
          className="text-sm font-medium hover:underline"
        >
          {mistake.problemTitle}
        </Link>
        <span className="border-border text-muted-foreground border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.12em] uppercase">
          {MISTAKE_CATEGORY_LABEL[mistake.category]}
        </span>
        <time
          dateTime={mistake.createdAt}
          className="text-muted-foreground ml-auto font-mono text-[10px]"
        >
          {new Date(mistake.createdAt).toLocaleDateString()}
        </time>
      </div>

      <p className="mt-2 text-sm whitespace-pre-wrap">{mistake.whatWentWrong}</p>

      {mistake.correctIdea !== null && (
        <p className="text-muted-foreground mt-1.5 text-sm whitespace-pre-wrap">
          <span className="font-mono text-[10px] tracking-[0.14em] uppercase">Right idea — </span>
          {mistake.correctIdea}
        </p>
      )}
    </li>
  )
}
