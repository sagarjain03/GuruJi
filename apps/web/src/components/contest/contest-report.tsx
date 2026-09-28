'use client'

import { MISTAKE_CATEGORY_LABEL } from '@guruji/types'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { DifficultyBadge } from '@/components/content/states'
import { Skeleton } from '@/components/ui/skeleton'
import { contestApi } from '@/lib/api'

function minutes(ms: number | null): string {
  if (ms === null) return '—'
  const value = ms / 60_000
  return value < 10 ? `${value.toFixed(1)} min` : `${Math.round(value)} min`
}

/**
 * What the contest showed. Every line is evidence GuruJi already had — which
 * problems went unsolved, attempts, time, logged mistakes — and the weak area
 * says which of it it used. No rank, no comparison with anyone else.
 */
export function ContestReport({ contestId }: { contestId: string }) {
  const report = useQuery({
    queryKey: ['contest', contestId, 'report'],
    queryFn: () => contestApi.report(contestId),
  })

  if (report.isPending) return <Skeleton className="h-64 w-full" />
  if (report.isError) {
    return (
      <p role="alert" className="text-destructive text-sm">
        Could not load the report. Refresh to try again.
      </p>
    )
  }

  const data = report.data
  return (
    <div className="flex flex-col gap-3">
      <section className="border-border bg-card/70 flex flex-wrap items-end justify-between gap-4 border p-5" aria-labelledby="report-score">
        <div>
          <h2 id="report-score" className="text-muted-foreground font-mono text-[11px] tracking-[0.14em] uppercase sm:text-[10px]">
            Score
          </h2>
          <p className="font-display mt-1 text-4xl font-semibold tabular-nums">
            {data.score} <span className="text-muted-foreground text-xl">/ {data.maxScore}</span>
          </p>
        </div>
        <p className="text-muted-foreground text-sm">
          {data.finishReason === 'TIME_UP' ? 'Time ran out.' : 'You finished early.'}
        </p>
      </section>

      {data.weakArea !== null ? (
        <section className="border-destructive/40 bg-card/70 border p-5" aria-labelledby="report-weak-area">
          <h2 id="report-weak-area" className="text-muted-foreground font-mono text-[11px] tracking-[0.14em] uppercase sm:text-[10px]">
            Weak area · {data.weakArea.kind === 'TOPIC' ? 'topic' : 'pattern'}
          </h2>
          <p className="font-display mt-1 text-2xl font-semibold">{data.weakArea.name}</p>
          <p className="text-muted-foreground mt-2 text-sm">{data.weakArea.reason}</p>
        </section>
      ) : (
        <section className="border-border bg-card/70 border p-5" aria-labelledby="report-weak-area">
          <h2 id="report-weak-area" className="text-muted-foreground font-mono text-[11px] tracking-[0.14em] uppercase sm:text-[10px]">
            Weak area
          </h2>
          <p className="font-display mt-1 text-2xl font-semibold">None this time</p>
          {data.slowest !== null && <p className="text-muted-foreground mt-2 text-sm">{data.slowest.reason}</p>}
        </section>
      )}

      <section className="border-border bg-card/70 overflow-x-auto border p-5" aria-labelledby="report-problems">
        <h2 id="report-problems" className="text-muted-foreground mb-3 font-mono text-[11px] tracking-[0.14em] uppercase sm:text-[10px]">
          Problems
        </h2>
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="text-muted-foreground text-left text-xs">
              <th scope="col" className="py-2 pr-3 font-normal">Problem</th>
              <th scope="col" className="py-2 pr-3 font-normal">Result</th>
              <th scope="col" className="py-2 pr-3 font-normal">Attempts</th>
              <th scope="col" className="py-2 pr-3 font-normal">Time to solve</th>
              <th scope="col" className="py-2 pr-3 font-normal">Topics</th>
              <th scope="col" className="py-2 font-normal">Mistakes</th>
            </tr>
          </thead>
          <tbody>
            {data.problems.map((problem) => (
              <tr key={problem.slug} className="border-border/60 border-t align-top">
                <th scope="row" className="py-2 pr-3 text-left font-normal">
                  <Link href={`/problems/${problem.slug}`} className="font-medium hover:underline">
                    {problem.title}
                  </Link>
                  <span className="mt-1 flex items-center gap-2">
                    <DifficultyBadge difficulty={problem.difficulty} />
                    {problem.wasSolvedBefore && <span className="text-muted-foreground text-xs">seen before</span>}
                  </span>
                </th>
                <td className="py-2 pr-3">{problem.solved ? '✓ Solved' : '✕ Unsolved'}</td>
                <td className="py-2 pr-3 tabular-nums">{problem.attempts}</td>
                <td className="py-2 pr-3 tabular-nums">{minutes(problem.timeToSolveMs)}</td>
                <td className="text-muted-foreground py-2 pr-3">{[...problem.topics, ...problem.patterns].join(', ') || '—'}</td>
                <td className="text-muted-foreground py-2">
                  {problem.mistakeCategories.map((category) => MISTAKE_CATEGORY_LABEL[category]).join(', ') || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
