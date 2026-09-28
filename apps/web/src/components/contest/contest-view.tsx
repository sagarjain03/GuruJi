'use client'

import type { ContestView as Contest, StartContestRequest } from '@guruji/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import { DifficultyBadge } from '@/components/content/states'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError, contestApi } from '@/lib/api'
import { ContestReport } from './contest-report'
import { Countdown } from './countdown'

const LATEST = ['contest', 'latest'] as const

const STATE_LABEL: Record<Contest['problems'][number]['state'], string> = {
  UNSOLVED: 'Not attempted',
  ATTEMPTED: 'Attempted',
  SOLVED: '✓ Solved',
}

/**
 * `/contest`: start a contest, work through one, read its report.
 *
 * Driven by the most recent contest rather than local state, so closing the tab
 * mid-contest — or long after it ended — lands on the right screen.
 */
export function ContestView() {
  const client = useQueryClient()
  const latest = useQuery({ queryKey: LATEST, queryFn: () => contestApi.latest() })
  const [startingNew, setStartingNew] = useState(false)

  const refresh = () => client.invalidateQueries({ queryKey: ['contest'] })

  let body: React.ReactNode
  if (latest.isPending) {
    body = <Skeleton className="h-64 w-full" />
  } else if (latest.isError) {
    body = (
      <p role="alert" className="text-destructive text-sm">
        Could not load your contest. Refresh to try again.
      </p>
    )
  } else if (latest.data?.status === 'ACTIVE') {
    body = <ActiveContest contest={latest.data} onChange={refresh} />
  } else if (latest.data !== null && !startingNew) {
    body = (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold tracking-tight">Your last contest</h2>
          <Button onClick={() => setStartingNew(true)}>Start a new contest</Button>
        </div>
        <ContestReport contestId={latest.data.id} />
      </div>
    )
  } else {
    body = (
      <StartContest
        onStarted={(contest) => {
          client.setQueryData(LATEST, contest)
          setStartingNew(false)
        }}
      />
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-5 lg:p-8">
      <header>
        <p className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase sm:text-[10px]">Mock contest</p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">Test yourself under time</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          Three problems, a fixed clock, no help by default. It measures how you do when it counts — against
          nobody but yourself.
        </p>
      </header>
      {body}
    </main>
  )
}

function StartContest({ onStarted }: { onStarted: (contest: Contest) => void }) {
  const client = useQueryClient()
  const [durationMinutes, setDuration] = useState<StartContestRequest['durationMinutes']>(60)
  const [hintsAllowed, setHintsAllowed] = useState(false)

  const start = useMutation({
    mutationFn: () => contestApi.start({ durationMinutes, hintsAllowed }),
    onSuccess: onStarted,
    onError: (error) => {
      // Another tab started one first: show that one instead of an error.
      if (error instanceof ApiError && error.code === 'CONTEST_ALREADY_ACTIVE') {
        void client.invalidateQueries({ queryKey: LATEST })
      }
    },
  })

  return (
    <section className="border-border bg-card/70 flex flex-col gap-5 border p-5" aria-labelledby="start-title">
      <h2 id="start-title" className="font-display text-lg font-semibold">
        Start a contest
      </h2>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-muted-foreground mb-2 font-mono text-[11px] tracking-[0.14em] uppercase sm:text-[10px]">Duration</legend>
        <div className="flex gap-2">
          {([60, 90] as const).map((minutes) => (
            <label
              key={minutes}
              className="border-border has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:focus-visible]:outline-ring flex cursor-pointer items-center gap-2 border px-4 py-2 text-sm has-[:focus-visible]:outline-2"
            >
              <input
                type="radio"
                name="duration"
                value={minutes}
                checked={durationMinutes === minutes}
                onChange={() => setDuration(minutes)}
                className="sr-only"
              />
              {minutes} minutes
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={hintsAllowed}
          onChange={(event) => setHintsAllowed(event.target.checked)}
          className="mt-1"
        />
        <span>
          Allow hints
          <span className="text-muted-foreground block text-xs">
            Off by default. An assessment measures what you can do unaided; hints used are shown in the report.
          </span>
        </span>
      </label>

      <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
        <li>Three problems — one easy, one medium, one hard — picked from your weakest topics.</li>
        <li>The clock starts now and keeps running if you close the tab. Come back any time before it ends.</li>
        <li>Only submissions made before time is up count. Wrong answers cost nothing.</li>
        <li>Your submissions count toward your mastery like any other practice.</li>
      </ul>

      {start.isError && !(start.error instanceof ApiError && start.error.code === 'CONTEST_ALREADY_ACTIVE') && (
        <p role="alert" className="text-destructive text-sm">
          {start.error instanceof ApiError ? start.error.message : 'Could not start the contest.'}
        </p>
      )}

      <div>
        <Button onClick={() => start.mutate()} disabled={start.isPending}>
          {start.isPending ? 'Starting…' : 'Start contest'}
        </Button>
      </div>
    </section>
  )
}

function ActiveContest({ contest, onChange }: { contest: Contest; onChange: () => void }) {
  const finish = useMutation({
    mutationFn: () => contestApi.finish(contest.id),
    onSuccess: onChange,
  })

  return (
    <div className="flex flex-col gap-3">
      <section className="border-border bg-card/70 flex flex-wrap items-center justify-between gap-4 border p-5">
        <Countdown
          key={contest.id}
          deadlineAt={contest.deadlineAt}
          serverNow={contest.serverNow}
          // At zero the server has finished it; reading again moves to the report.
          onExpire={onChange}
        />
        <p className="text-muted-foreground text-sm">
          {contest.hintsAllowed ? 'Hints allowed' : 'Hints off'} · {contest.maxScore} points available
        </p>
        <Button
          variant="outline"
          disabled={finish.isPending}
          onClick={() => {
            if (window.confirm('Finish now? You cannot submit again after this.')) finish.mutate()
          }}
        >
          {finish.isPending ? 'Finishing…' : 'Finish contest'}
        </Button>
      </section>

      <ol className="flex flex-col gap-2" aria-label="Contest problems">
        {contest.problems.map((problem) => (
          <li key={problem.problemId} className="border-border bg-card/70 flex flex-wrap items-center justify-between gap-3 border p-4">
            <div className="min-w-0">
              <p className="text-muted-foreground font-mono text-[11px] sm:text-[10px]">Problem {problem.position}</p>
              <Link
                href={`/problems/${problem.slug}?contest=${contest.id}`}
                className="font-display text-lg font-semibold hover:underline"
              >
                {problem.title}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <DifficultyBadge difficulty={problem.difficulty} />
                <span className="text-muted-foreground">{problem.points} points</span>
                {problem.wasSolvedBefore && <span className="text-muted-foreground">· seen before</span>}
              </div>
            </div>
            <p className="text-sm">
              {STATE_LABEL[problem.state]}
              {problem.attempts > 0 && (
                <span className="text-muted-foreground">
                  {' '}
                  · {problem.attempts} attempt{problem.attempts === 1 ? '' : 's'}
                </span>
              )}
            </p>
          </li>
        ))}
      </ol>
    </div>
  )
}
