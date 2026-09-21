'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, X } from 'lucide-react'
import Link from 'next/link'
import {
  RECOMMENDATION_KIND_LABEL,
  type Recommendation,
  type TrainNow as TrainNowPayload,
} from '@guruji/types'
import { Button } from '@/components/ui/button'
import { recommendationApi } from '@/lib/api'

/**
 * The single most visible action in the product.
 *
 * One button, and the answer behind it is an *activity* rather than always a
 * problem — sometimes the right move is to clear a revision queue, and a
 * product that can only answer with a problem cannot say that.
 */
export function TrainNow() {
  const next = useQuery({
    queryKey: ['recommendations', 'next'],
    queryFn: () => recommendationApi.next(),
    staleTime: 60_000,
  })

  const payload: TrainNowPayload | undefined = next.data
  const target = payload?.recommendation ?? null

  return (
    <section className="border-border border p-4">
      <header className="mb-3">
        <p className="text-muted-foreground font-mono text-[10px] tracking-[0.18em] uppercase">
          Train now
        </p>
        <h2 className="font-display mt-1 text-lg font-semibold tracking-tight">
          {payload === undefined
            ? 'Working out what you need…'
            : RECOMMENDATION_KIND_LABEL[payload.kind]}
        </h2>
      </header>

      <p className="text-muted-foreground text-sm">
        {payload?.reason ?? 'One button. It decides what actually moves you forward.'}
      </p>

      {target?.slug != null && (
        <Button className="mt-3" asChild>
          <Link href={`/problems/${target.slug}`}>
            {target.title ?? 'Start'}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      )}

      {payload?.kind === 'REVISION' && target?.slug == null && (
        <Button className="mt-3" variant="outline" asChild>
          <Link href="/revision">Open the revision queue</Link>
        </Button>
      )}
    </section>
  )
}

/**
 * Today's training — the rest of the batch, each with its reason.
 *
 * The reason is shown on every row, never hidden behind a tooltip. It is the
 * only window the user has into why the engine chose this, and a suggestion
 * without one is indistinguishable from a random pick.
 */
export function TodaysTraining() {
  const queryClient = useQueryClient()

  const batch = useQuery({
    queryKey: ['recommendations', 'list'],
    queryFn: () => recommendationApi.list(),
    staleTime: 60_000,
  })

  const dismiss = useMutation({
    mutationFn: (id: string) => recommendationApi.dismiss(id),
    onSuccess: () => {
      // Both the list and the single pick are now stale — the dismissal feeds
      // the next batch's recency penalty.
      void queryClient.invalidateQueries({ queryKey: ['recommendations'] })
    },
  })

  const items = batch.data ?? []

  return (
    <section className="border-border border p-4">
      <header className="mb-3">
        <h2 className="font-display text-base font-semibold">Today&rsquo;s training</h2>
        <p className="text-muted-foreground text-xs">
          Ordered by what moves you most. Every one says why.
        </p>
      </header>

      {batch.isPending ? (
        <p className="text-muted-foreground text-sm">Working it out…</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nothing to suggest yet. Solve a problem and this starts reasoning from real data.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <Row
              key={item.id}
              item={item}
              onDismiss={() => {
                dismiss.mutate(item.id)
              }}
              dismissing={dismiss.isPending}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function Row({
  item,
  onDismiss,
  dismissing,
}: {
  item: Recommendation
  onDismiss: () => void
  dismissing: boolean
}) {
  return (
    <li className="border-border border p-2.5">
      <div className="flex flex-wrap items-baseline gap-2">
        {item.slug === null ? (
          <span className="text-sm font-medium">{item.title ?? 'Challenge'}</span>
        ) : (
          <Link href={`/problems/${item.slug}`} className="text-sm font-medium hover:underline">
            {item.title}
          </Link>
        )}

        <span className="border-border text-muted-foreground border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.12em] uppercase">
          {RECOMMENDATION_KIND_LABEL[item.kind]}
        </span>

        {item.difficulty !== null && (
          <span className="text-muted-foreground font-mono text-[10px]">{item.difficulty}</span>
        )}

        <button
          type="button"
          aria-label="Not this one"
          title="Not this one"
          disabled={dismissing}
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground ml-auto p-1 disabled:opacity-40"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <p className="text-muted-foreground mt-1.5 text-xs leading-snug">{item.reason}</p>
    </li>
  )
}
