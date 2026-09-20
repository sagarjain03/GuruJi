'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import {
  REVISION_OUTCOME_LABEL,
  REVISION_STATE_LABEL,
  type QueueItem,
  type RevisionOutcome,
  type UpcomingDay,
} from '@guruji/types'
import { Button } from '@/components/ui/button'
import { ApiError, revisionApi } from '@/lib/api'
import { cn } from '@/lib/utils'

const OUTCOMES = Object.keys(REVISION_OUTCOME_LABEL) as RevisionOutcome[]

export function RevisionView() {
  const queryClient = useQueryClient()

  const due = useQuery({
    queryKey: ['revision', 'due'],
    queryFn: () => revisionApi.due(),
    staleTime: 30_000,
  })

  const upcoming = useQuery({
    queryKey: ['revision', 'upcoming'],
    queryFn: () => revisionApi.upcoming(7),
    staleTime: 60_000,
  })

  const respace = useMutation({
    mutationFn: () => revisionApi.respace(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['revision'] })
    },
  })

  const queue = due.data

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Revision</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {/* The premise, stated. Solving once is not knowing. */}
          Problems come back just before you would have forgotten them.
        </p>
      </header>

      {due.isPending ? (
        <p className="text-muted-foreground text-sm">Loading your queue…</p>
      ) : queue === undefined ? (
        <p className="text-destructive text-sm">Could not load the queue.</p>
      ) : (
        <>
          <QueueSummary queue={queue} onRespace={respace.mutate} respacing={respace.isPending} />

          {queue.items.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nothing due today. Solve something new and it will be back tomorrow.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {queue.items.map((item) => (
                <QueueRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </>
      )}

      <UpcomingWeek days={upcoming.data ?? []} isLoading={upcoming.isPending} />
    </div>
  )
}

function QueueSummary({
  queue,
  onRespace,
  respacing,
}: {
  queue: { totalDue: number; cap: number; carriedForward: number; catchingUp: boolean }
  onRespace: () => void
  respacing: boolean
}) {
  return (
    <section className="border-border flex flex-wrap items-center gap-x-6 gap-y-2 border p-3">
      <Stat label="Due today" value={Math.min(queue.totalDue, queue.cap)} />
      <Stat label="Daily cap" value={queue.cap} />
      {queue.carriedForward > 0 && <Stat label="Carried forward" value={queue.carriedForward} />}

      {queue.carriedForward > 0 && (
        <p className="text-muted-foreground w-full text-xs">
          {/*
            Said out loud rather than hidden. An uncapped queue after a week away
            is about thirteen hours of work, and the predictable response to that
            is to do none of it. "24 to catch up on, 10 today" is a plan.
          */}
          {queue.totalDue} are due. You are shown {queue.cap} today — the rest carry forward, and
          nothing is dropped.
        </p>
      )}

      {queue.catchingUp && (
        <div className="flex w-full items-center gap-3">
          <p className="text-muted-foreground flex-1 text-xs">
            Some of these have been waiting a while. Spreading them over the coming days makes the
            backlog something you can actually finish.
          </p>
          <Button size="sm" variant="outline" disabled={respacing} onClick={onRespace}>
            {respacing ? 'Spreading…' : 'Spread them out'}
          </Button>
        </div>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-display text-xl font-semibold">{value}</p>
      <p className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
        {label}
      </p>
    </div>
  )
}

function QueueRow({ item }: { item: QueueItem }) {
  const queryClient = useQueryClient()
  const [reporting, setReporting] = useState(false)

  const complete = useMutation({
    mutationFn: (outcome: RevisionOutcome) => revisionApi.complete(item.id, { outcome }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['revision'] })
      // Retention feeds mastery, so the dashboard is now out of date too.
      void queryClient.invalidateQueries({ queryKey: ['analytics'], refetchType: 'none' })
    },
  })

  return (
    <li className="border-border border p-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <Link href={`/problems/${item.slug}`} className="text-sm font-medium hover:underline">
          {item.title}
        </Link>

        <span
          className={cn(
            'border-border text-muted-foreground border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.12em] uppercase',
            // Lapsed is the one worth noticing: it is knowledge that was had and
            // lost, which is the cheapest thing on the list to recover.
            item.state === 'LAPSED' && 'border-hard/40 text-hard',
          )}
        >
          {REVISION_STATE_LABEL[item.state]}
        </span>

        <span className="text-muted-foreground font-mono text-[10px]">{item.difficulty}</span>

        <span className="text-muted-foreground ml-auto font-mono text-[10px]">
          {item.overdueDays > 0
            ? `${String(item.overdueDays)}d overdue`
            : item.overdueDays === 0
              ? 'due today'
              : `in ${String(-item.overdueDays)}d`}
        </span>
      </div>

      {reporting ? (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
            How did it go?
          </p>
          <div className="flex flex-wrap gap-1">
            {OUTCOMES.map((outcome) => (
              <button
                key={outcome}
                type="button"
                disabled={complete.isPending}
                onClick={() => {
                  complete.mutate(outcome)
                }}
                className="border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground border px-2 py-1 text-[11px] disabled:opacity-50"
              >
                {REVISION_OUTCOME_LABEL[outcome]}
              </button>
            ))}
          </div>
          <p className="text-muted-foreground text-[11px]">
            {/*
              Struggle is a signal even when the answer was right. Collapsing
              these four into "done" throws away the only thing that tells the
              schedule to bring it back sooner.
            */}
            Struggling still counts as a review — it just brings the problem back sooner.
          </p>
          {complete.isError && (
            <p role="alert" className="text-destructive text-xs">
              {complete.error instanceof ApiError
                ? complete.error.message
                : 'Could not save that.'}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href={`/problems/${item.slug}`}>Solve it again</Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setReporting(true)
            }}
          >
            Report how it went
          </Button>
        </div>
      )}
    </li>
  )
}

/**
 * The week ahead, already capped.
 *
 * Showing the raw due count would promise a day the queue is then going to
 * truncate — a calendar that disagrees with the queue is worse than no calendar.
 */
function UpcomingWeek({ days, isLoading }: { days: UpcomingDay[]; isLoading: boolean }) {
  if (isLoading || days.length === 0) {
    return null
  }

  const busiest = Math.max(...days.map((day) => day.capped), 1)

  return (
    <section className="border-border border p-3">
      <h2 className="font-display text-base font-semibold">The week ahead</h2>
      <p className="text-muted-foreground mt-1 text-xs">
        What you will actually be asked for, after the daily cap.
      </p>

      <ol className="mt-3 flex items-end gap-2">
        {days.map((day) => (
          <li key={day.date} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-muted-foreground font-mono text-[10px]">{day.capped}</span>
            <div
              className="bg-primary/70 w-full"
              style={{ height: `${String(Math.round((day.capped / busiest) * 48) + 2)}px` }}
            />
            <span className="text-muted-foreground font-mono text-[10px]">
              {new Date(`${day.date}T00:00:00Z`).toLocaleDateString(undefined, {
                weekday: 'short',
                timeZone: 'UTC',
              })}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
