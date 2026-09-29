'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import type { MentorHistoryEntry, MentorHistoryMode } from '@guruji/types'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/content/states'
import { aiApi } from '@/lib/api'
import { cn } from '@/lib/utils'

const MODE_LABEL: Record<MentorHistoryMode, string> = {
  HINT: 'Hint',
  EXPLAIN: 'Explanation',
  ANALYZE_CODE: 'Code analysis',
  EXPLAIN_WRONG_ANSWER: 'Wrong answer',
  SHOW_SOLUTION: 'Solution',
}

/**
 * The record the solution dialog promises ("recorded in your mentor history"):
 * every answer the mentor has given, newest first, linked back to its problem.
 * Asking happens on the problem page; this page only remembers.
 */
export function MentorHistoryView() {
  const history = useQuery({
    queryKey: ['mentor', 'history'],
    queryFn: () => aiApi.history(),
    // Always fresh: someone arriving from a problem page expects the answer they just got.
    staleTime: 0,
  })

  const entries = history.data?.entries ?? []

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">AI Mentor</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Everything the mentor has told you, so an explanation is never lost when the tab closes. Ask
          for a new one from any problem.
        </p>
      </header>

      {history.isPending ? (
        <ListSkeleton rows={4} rowClassName="h-28" label="Loading your mentor history…" />
      ) : history.isError ? (
        <ErrorState message="Could not load your mentor history." onRetry={() => void history.refetch()} />
      ) : entries.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          detail="Open a problem and ask the mentor for a hint or an explanation. It will be kept here."
        />
      ) : (
        <ol className="flex flex-col gap-3">
          {entries.map((entry) => (
            <HistoryCard key={entry.id} entry={entry} />
          ))}
        </ol>
      )}
    </div>
  )
}

function HistoryCard({ entry }: { entry: MentorHistoryEntry }) {
  const when = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(entry.createdAt),
  )

  return (
    <li className="surface border-border flex flex-col gap-3 border p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <span
          className={cn(
            'border-border text-muted-foreground border px-1.5 py-0.5 font-mono text-[11px] tracking-[0.12em] uppercase sm:text-[10px]',
            // A revealed solution is the one worth noticing in a list of nudges.
            entry.mode === 'SHOW_SOLUTION' && 'border-destructive/40 text-destructive',
          )}
        >
          {MODE_LABEL[entry.mode]}
          {entry.hintLevel !== null && ` · level ${String(entry.hintLevel)}`}
        </span>
        {entry.problem ? (
          <Link href={`/problems/${entry.problem.slug}`} className="text-sm font-medium hover:underline">
            {entry.problem.title}
          </Link>
        ) : (
          <span className="text-muted-foreground text-sm">A problem that has been removed</span>
        )}
        <time dateTime={entry.createdAt} className="text-muted-foreground ml-auto font-mono text-[11px] sm:text-[10px]">
          {when}
        </time>
      </div>

      <div className="flex flex-col gap-2 text-sm">
        {entry.sections.map((section) => (
          <div key={section.title}>
            {entry.sections.length > 1 && (
              <h3 className="text-muted-foreground font-mono text-[11px] tracking-[0.14em] uppercase sm:text-[10px]">
                {section.title}
              </h3>
            )}
            <p className="mt-1 leading-relaxed">{section.text}</p>
          </div>
        ))}
        {entry.code !== null && (
          <pre className="bg-muted overflow-x-auto p-3 font-mono text-xs whitespace-pre-wrap">{entry.code}</pre>
        )}
      </div>
    </li>
  )
}
