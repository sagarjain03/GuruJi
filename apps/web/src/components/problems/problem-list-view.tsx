'use client'

import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Route } from 'next'
import type { Difficulty, ProblemListItem } from '@guruji/types'
import { DifficultyBadge, EmptyState, ErrorState, LoadingState } from '@/components/content/states'
import { contentApi } from '@/lib/api'
import { cn } from '@/lib/utils'

const DIFFICULTIES: Difficulty[] = ['EASY', 'MEDIUM', 'HARD']

interface Filters {
  topic?: string
  pattern?: string
  difficulty?: Difficulty
  q?: string
}

/**
 * Filters live in the URL, not in component state.
 *
 * A filtered list that cannot be linked to or reloaded is a list you cannot send
 * to anyone, and the back button silently loses your place. The URL is the
 * state; the inputs below are a view of it.
 */
export function ProblemListView() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const filters = useMemo<Filters>(() => {
    const difficulty = searchParams.get('difficulty')
    return {
      ...(searchParams.get('topic') ? { topic: searchParams.get('topic') as string } : {}),
      ...(searchParams.get('pattern') ? { pattern: searchParams.get('pattern') as string } : {}),
      ...(difficulty && DIFFICULTIES.includes(difficulty as Difficulty)
        ? { difficulty: difficulty as Difficulty }
        : {}),
      ...(searchParams.get('q') ? { q: searchParams.get('q') as string } : {}),
    }
  }, [searchParams])

  const setFilter = useCallback(
    (key: keyof Filters, value: string | undefined) => {
      const next = new URLSearchParams(searchParams.toString())
      if (value === undefined || value.length === 0) {
        next.delete(key)
      } else {
        next.set(key, value)
      }
      const query = next.toString()
      // `replace`, not `push`: typing in the search box should not fill the
      // history with one entry per keystroke.
      // `typedRoutes` checks route literals at compile time; a query string
      // assembled at runtime cannot be checked, so the cast is the honest
      // place to say so. The pathname itself is still the real route.
      router.replace((query.length > 0 ? `${pathname}?${query}` : pathname) as Route)
    },
    [pathname, router, searchParams],
  )

  const { data: topics } = useQuery({ queryKey: ['topics'], queryFn: () => contentApi.topics() })
  const { data: patterns } = useQuery({
    queryKey: ['patterns'],
    queryFn: () => contentApi.patterns(),
  })

  const list = useInfiniteQuery({
    queryKey: ['problems', filters],
    queryFn: ({ pageParam }) =>
      contentApi.problems({
        ...filters,
        ...(typeof pageParam === 'string' ? { cursor: pageParam } : {}),
        limit: 20,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    // Without this the whole list unmounts on every filter change and the page
    // flashes empty before the new results land.
    placeholderData: (previous) => previous,
  })

  const items = list.data?.pages.flatMap((page) => page.items) ?? []
  const sentinel = useInfiniteScroll({
    enabled: list.hasNextPage && !list.isFetchingNextPage,
    onReach: () => {
      void list.fetchNextPage()
    },
  })

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Problems</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Every problem here is written for GuruJi, with its own test cases and hints.
        </p>
      </header>

      <FilterBar
        filters={filters}
        topics={topics?.map((t) => ({ slug: t.slug, name: t.name })) ?? []}
        patterns={patterns?.map((p) => ({ slug: p.slug, name: p.name })) ?? []}
        onChange={setFilter}
      />

      {list.isPending && <LoadingState label="Loading problems…" />}

      {list.isError && (
        <ErrorState
          message="The problem list could not be loaded."
          onRetry={() => {
            void list.refetch()
          }}
        />
      )}

      {!list.isPending && !list.isError && items.length === 0 && (
        <EmptyState
          title="No problems match those filters"
          detail="Clear a filter, or search for something else."
        />
      )}

      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((problem) => (
            <li key={problem.id}>
              <ProblemRow problem={problem} />
            </li>
          ))}
        </ul>
      )}

      <div ref={sentinel} aria-hidden="true" className="h-px" />

      {list.isFetchingNextPage && <LoadingState label="Loading more…" />}

      {!list.hasNextPage && items.length > 0 && (
        <p className="text-muted-foreground py-4 text-center font-mono text-[10px] tracking-[0.14em] uppercase">
          End of list · {items.length} shown
        </p>
      )}
    </div>
  )
}

function ProblemRow({ problem }: { problem: ProblemListItem }) {
  return (
    <Link
      href={`/problems/${problem.slug}`}
      className="border-border bg-card/70 hover:border-foreground/25 flex flex-col gap-2 border p-4 transition-colors"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-base font-semibold tracking-tight">{problem.title}</span>
        <div className="flex items-center gap-2">
          <DifficultyBadge difficulty={problem.difficulty} />
          <span className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
            ~{problem.estimatedMinutes}m
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[...problem.topics, ...problem.patterns].map((tag) => (
          <span
            key={tag.slug}
            className={cn(
              'border-border/60 text-muted-foreground border px-2 py-0.5 font-mono text-[10px]',
              tag.relevance === 'PRIMARY' && 'text-foreground/80 border-foreground/25',
            )}
          >
            {tag.name}
          </span>
        ))}
      </div>
    </Link>
  )
}

function FilterBar({
  filters,
  topics,
  patterns,
  onChange,
}: {
  filters: Filters
  topics: { slug: string; name: string }[]
  patterns: { slug: string; name: string }[]
  onChange: (key: keyof Filters, value: string | undefined) => void
}) {
  const [search, setSearch] = useState(filters.q ?? '')

  // The URL can change without the box being typed in — a cleared filter, or
  // the back button. Follow it during render rather than in an effect, which
  // would cost a second render pass to show the corrected value.
  const [lastQ, setLastQ] = useState(filters.q ?? '')
  if (lastQ !== (filters.q ?? '')) {
    setLastQ(filters.q ?? '')
    setSearch(filters.q ?? '')
  }

  useEffect(() => {
    const current = filters.q ?? ''
    if (search === current) {
      return
    }
    const timer = setTimeout(() => {
      onChange('q', search.length > 0 ? search : undefined)
    }, 300)
    return () => {
      clearTimeout(timer)
    }
  }, [search, filters.q, onChange])

  const hasFilters = Object.values(filters).some((value) => value !== undefined)

  return (
    <div className="border-border bg-card/70 flex flex-col gap-3 border p-3">
      <input
        type="search"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value)
        }}
        placeholder="Search problem titles"
        aria-label="Search problem titles"
        className="border-border bg-background/40 placeholder:text-muted-foreground w-full border px-3 py-2 text-sm outline-none focus-visible:border-[var(--ring)]"
      />

      <div className="flex flex-wrap gap-1.5">
        {DIFFICULTIES.map((level) => (
          <button
            key={level}
            type="button"
            aria-pressed={filters.difficulty === level}
            onClick={() => {
              onChange('difficulty', filters.difficulty === level ? undefined : level)
            }}
            className={cn(
              'border-border text-muted-foreground border px-3 py-1 font-mono text-[10px] tracking-[0.14em] uppercase',
              filters.difficulty === level && 'bg-primary text-primary-foreground border-primary',
            )}
          >
            {level}
          </button>
        ))}

        <Select
          label="Topic"
          value={filters.topic}
          options={topics}
          onChange={(value) => {
            onChange('topic', value)
          }}
        />
        <Select
          label="Pattern"
          value={filters.pattern}
          options={patterns}
          onChange={(value) => {
            onChange('pattern', value)
          }}
        />

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              for (const key of ['topic', 'pattern', 'difficulty', 'q'] as const) {
                onChange(key, undefined)
              }
            }}
            className="text-muted-foreground hover:text-foreground px-2 py-1 font-mono text-[10px] tracking-[0.14em] uppercase underline underline-offset-4"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string | undefined
  options: { slug: string; name: string }[]
  onChange: (value: string | undefined) => void
}) {
  return (
    <select
      aria-label={label}
      value={value ?? ''}
      onChange={(event) => {
        onChange(event.target.value.length > 0 ? event.target.value : undefined)
      }}
      className="border-border bg-background/40 text-muted-foreground border px-2 py-1 font-mono text-[10px] tracking-[0.14em] uppercase outline-none"
    >
      <option value="">{label}: any</option>
      {options.map((option) => (
        <option key={option.slug} value={option.slug}>
          {option.name}
        </option>
      ))}
    </select>
  )
}

/**
 * Fires `onReach` when the sentinel scrolls into view.
 *
 * An IntersectionObserver rather than a scroll listener: a scroll handler runs on
 * every frame of every scroll and has to measure the document to decide whether
 * it is near the bottom.
 */
function useInfiniteScroll({ enabled, onReach }: { enabled: boolean; onReach: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null)

  // The latest callback, held in a ref so the observer below is not torn down
  // and rebuilt on every render. Written in an effect, never during render.
  const callback = useRef(onReach)
  useEffect(() => {
    callback.current = onReach
  }, [onReach])

  useEffect(() => {
    const node = ref.current
    if (!node || !enabled) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          callback.current()
        }
      },
      // Start the next page slightly before the user reaches the bottom.
      { rootMargin: '240px' },
    )

    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [enabled])

  return ref
}
