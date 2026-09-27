'use client'

import { MISTAKE_CATEGORY_LABEL } from '@guruji/types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { analyticsApi, mistakeApi } from '@/lib/api'
import { ActivityHeatmap } from './activity-heatmap'
import { ChartPanel } from './chart-panel'
import { ColumnBars, HorizontalBars, TrendLines } from './charts'
import { addDays, formatDay, formatMinutes, formatPercent, formatShortDay, toDay } from './format'

const TREND_WEEKS = [4, 12, 26, 52] as const

/** How many topics or patterns a bar chart shows: the weakest, which is where the work is. */
const TOP_ROWS = 12

const STALE = 60_000

export function AnalyticsView() {
  const [weeks, setWeeks] = useState<(typeof TREND_WEEKS)[number]>(12)
  const today = toDay(new Date())

  const activity = useQuery({ queryKey: ['analytics', 'activity'], queryFn: () => analyticsApi.activity(), staleTime: STALE })
  const topics = useQuery({ queryKey: ['analytics', 'topics'], queryFn: () => analyticsApi.topics(), staleTime: STALE })
  const trends = useQuery({
    queryKey: ['analytics', 'trends', weeks],
    queryFn: () => analyticsApi.trends({ from: addDays(today, -(weeks * 7 - 1)), to: today }),
    staleTime: STALE,
    placeholderData: (previous) => previous,
  })
  const mistakes = useQuery({ queryKey: ['mistakes', 'patterns'], queryFn: () => mistakeApi.patterns(), staleTime: STALE })

  const topicRows = (topics.data?.topics ?? []).slice(0, TOP_ROWS)
  const patternRows = (topics.data?.patterns ?? []).slice(0, TOP_ROWS)
  const difficulty = topics.data?.difficulty
  const difficultyRows = difficulty
    ? (['easy', 'medium', 'hard'] as const).map((level) => ({
        label: level[0]?.toUpperCase() + level.slice(1),
        attempted: difficulty[level].attempted,
        solved: difficulty[level].solved,
      }))
    : []
  const weekRows = (trends.data?.weeks ?? []).map((week) => ({
    ...week,
    accuracyPercent: week.accuracy === null ? null : Math.round(week.accuracy * 100),
    solveMinutes: week.medianSolveTimeMs === null ? null : Math.round((week.medianSolveTimeMs / 60_000) * 10) / 10,
  }))
  const hasTrend = weekRows.some((week) => week.submissions > 0)
  const mistakeRows = (mistakes.data?.patterns ?? []).map((pattern) => ({
    label: MISTAKE_CATEGORY_LABEL[pattern.category],
    count: pattern.count,
  }))

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 p-5 lg:p-8">
      <header className="mb-2">
        <p className="text-muted-foreground font-mono text-[11px] sm:text-[10px] tracking-[0.18em] uppercase">Analytics</p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">Your progress, measured</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          Every number here comes from what you have already submitted, revised and logged. Days and weeks are in UTC,
          the same calendar the streak uses.
        </p>
      </header>

      <ChartPanel
        title="Activity"
        description={activity.data ? `${formatDay(activity.data.from)} – ${formatDay(activity.data.to)}` : 'The last year'}
        isLoading={activity.isPending}
        isError={activity.isError}
        isEmpty={(activity.data?.days.length ?? 0) === 0}
        emptyMessage="No graded submissions yet. Solve something and this fills in."
        columns={['Day', 'Attempted', 'Solved']}
        rows={(activity.data?.days ?? []).map((day) => ({ label: formatDay(day.date), values: [String(day.attempted), String(day.solved)] }))}
      >
        {activity.data && <ActivityHeatmap from={activity.data.from} to={activity.data.to} days={activity.data.days} />}
      </ChartPanel>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartPanel
          title="Mastery by topic"
          description={`Weakest first, ${TOP_ROWS} at most. 0–100, the same score the dashboard uses.`}
          isLoading={topics.isPending}
          isError={topics.isError}
          isEmpty={topicRows.length === 0}
          emptyMessage="No topic has been attempted yet."
          columns={['Topic', 'Mastery', 'First-try accuracy', 'Solved / attempted']}
          rows={topicRows.map((row) => ({
            label: row.name,
            values: [String(row.masteryScore), formatPercent(row.accuracy), `${row.solved} / ${row.attempts}`],
          }))}
        >
          <HorizontalBars data={topicRows} labelKey="name" max={100} series={[{ key: 'masteryScore', name: 'Mastery', color: 'var(--primary)' }]} />
        </ChartPanel>

        <ChartPanel
          title="Difficulty"
          description="Distinct problems attempted and solved, all time."
          isLoading={topics.isPending}
          isError={topics.isError}
          isEmpty={difficultyRows.every((row) => row.attempted === 0)}
          emptyMessage="Nothing attempted yet."
          columns={['Difficulty', 'Attempted', 'Solved']}
          rows={difficultyRows.map((row) => ({ label: row.label, values: [String(row.attempted), String(row.solved)] }))}
        >
          <ColumnBars
            data={difficultyRows}
            labelKey="label"
            series={[
              { key: 'attempted', name: 'Attempted', color: 'var(--muted-foreground)' },
              { key: 'solved', name: 'Solved', color: 'var(--primary)' },
            ]}
          />
        </ChartPanel>
      </div>

      <section className="border-border bg-card/70 flex flex-col gap-3 border p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">Trends</h2>
            <p className="text-muted-foreground mt-1 text-xs">Per UTC week. Empty weeks are gaps, not zeros.</p>
          </div>
          <div role="group" aria-label="Trend range" className="flex">
            {TREND_WEEKS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={weeks === option}
                onClick={() => setWeeks(option)}
                className="border-border aria-pressed:bg-primary aria-pressed:text-primary-foreground text-muted-foreground hover:text-foreground -ml-px border px-3 py-1 font-mono text-xs first:ml-0 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
              >
                {option}w
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <ChartPanel
            title="Accuracy"
            description="Accepted over graded submissions."
            isLoading={trends.isPending}
            isError={trends.isError}
            isEmpty={!hasTrend}
            emptyMessage="No graded submissions in this range."
            columns={['Week of', 'Accuracy', 'Accepted / graded']}
            rows={weekRows.map((week) => ({
              label: formatShortDay(week.weekStart),
              values: [formatPercent(week.accuracy), `${week.accepted} / ${week.submissions}`],
            }))}
          >
            <TrendLines
              data={weekRows}
              labelKey="weekStart"
              domain={[0, 100]}
              format={(value) => `${value}%`}
              formatLabel={formatShortDay}
              series={[{ key: 'accuracyPercent', name: 'Accuracy', color: 'var(--primary)' }]}
            />
          </ChartPanel>
          <ChartPanel
            title="Solve time"
            description="Median time on accepted submissions — one late night cannot skew it."
            isLoading={trends.isPending}
            isError={trends.isError}
            isEmpty={!weekRows.some((week) => week.medianSolveTimeMs !== null)}
            emptyMessage="No accepted submissions in this range."
            columns={['Week of', 'Median solve time']}
            rows={weekRows.map((week) => ({ label: formatShortDay(week.weekStart), values: [formatMinutes(week.medianSolveTimeMs)] }))}
          >
            <TrendLines
              data={weekRows}
              labelKey="weekStart"
              format={(value) => `${value}m`}
              formatLabel={formatShortDay}
              series={[{ key: 'solveMinutes', name: 'Median minutes', color: 'var(--mastery-proficient)', dashed: true }]}
            />
          </ChartPanel>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartPanel
          title="Mistakes by category"
          description="From your mistake journal, most frequent first."
          isLoading={mistakes.isPending}
          isError={mistakes.isError}
          isEmpty={mistakeRows.length === 0}
          emptyMessage="The mistake journal is empty."
          columns={['Category', 'Entries']}
          rows={mistakeRows.map((row) => ({ label: row.label, values: [String(row.count)] }))}
        >
          <HorizontalBars data={mistakeRows} labelKey="label" series={[{ key: 'count', name: 'Entries', color: 'var(--difficulty-hard)' }]} />
        </ChartPanel>

        <ChartPanel
          title="Pattern performance"
          description={`Weakest first, ${TOP_ROWS} at most. Mastery beside first-try accuracy.`}
          isLoading={topics.isPending}
          isError={topics.isError}
          isEmpty={patternRows.length === 0}
          emptyMessage="No pattern has been attempted yet."
          columns={['Pattern', 'Mastery', 'First-try accuracy', 'Solved / attempted']}
          rows={patternRows.map((row) => ({
            label: row.name,
            values: [String(row.masteryScore), formatPercent(row.accuracy), `${row.solved} / ${row.attempts}`],
          }))}
        >
          <HorizontalBars
            data={patternRows.map((row) => ({ ...row, accuracyPercent: row.accuracy === null ? null : Math.round(row.accuracy * 100) }))}
            labelKey="name"
            max={100}
            series={[
              { key: 'masteryScore', name: 'Mastery', color: 'var(--primary)' },
              { key: 'accuracyPercent', name: 'First-try accuracy %', color: 'var(--mastery-strong)' },
            ]}
          />
        </ChartPanel>
      </div>
    </div>
  )
}
