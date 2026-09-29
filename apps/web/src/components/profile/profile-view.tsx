'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { TrophyCase } from '@/components/achievements/trophy-case'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { analyticsApi } from '@/lib/api'
import { useSessionStore } from '@/stores/session-store'

const LANGUAGE_LABEL: Record<string, string> = { CPP: 'C++', C: 'C', PYTHON: 'Python', JAVASCRIPT: 'JavaScript' }
const LEVEL_LABEL: Record<string, string> = { BEGINNER: 'Beginner', INTERMEDIATE: 'Intermediate', ADVANCED: 'Advanced' }

/** An instant, so it is shown in the viewer's own time zone. */
const JOINED = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' })

/**
 * Who you are here, and the few numbers that summarise it. Read-only: the
 * preferences are set in onboarding, and the detail lives on /analytics.
 */
export function ProfileView() {
  const user = useSessionStore((state) => state.user)
  const profile = useSessionStore((state) => state.profile)

  // Same key as the dashboard, so arriving from there costs no request.
  const overview = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => analyticsApi.overview(),
    staleTime: 30_000,
  })

  if (!user || !profile) return null
  const data = overview.data

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 p-5 lg:p-8">
      <header className="surface border-border bg-card/70 flex flex-wrap items-center gap-5 border p-5">
        <span
          aria-hidden="true"
          className="bg-primary text-primary-foreground flex size-16 items-center justify-center font-mono text-xl font-semibold"
        >
          {profile.displayName
            .split(/\s+/)
            .map((part) => part[0] ?? '')
            .join('')
            .slice(0, 2)
            .toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="text-muted-foreground font-mono text-[11px] sm:text-[10px] tracking-[0.18em] uppercase">Profile</p>
          <h1 className="font-display mt-1 truncate text-3xl font-semibold tracking-tight">{profile.displayName}</h1>
          <p className="text-muted-foreground mt-1 truncate text-sm">
            {user.email} · joined {JOINED.format(new Date(user.createdAt))}
          </p>
        </div>
      </header>

      <section className="surface border-border bg-card/70 border p-5" aria-labelledby="profile-stats">
        <h2 id="profile-stats" className="text-muted-foreground font-mono text-[11px] sm:text-[10px] tracking-[0.14em] uppercase">
          Progress
        </h2>
        {overview.isPending ? (
          <Skeleton className="mt-3 h-20 w-full" />
        ) : overview.isError || !data ? (
          <p role="alert" className="text-destructive mt-3 text-sm">
            Could not load your progress. Refresh to try again.
          </p>
        ) : (
          <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Solved" value={data.totalSolved} />
            <Stat label="Easy" value={data.solvedByDifficulty.easy} />
            <Stat label="Medium" value={data.solvedByDifficulty.medium} />
            <Stat label="Hard" value={data.solvedByDifficulty.hard} />
            <Stat label="Current streak" value={data.streak.current} suffix="d" />
            <Stat label="Longest streak" value={data.streak.longest} suffix="d" />
          </dl>
        )}
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href="/analytics">See full analytics</Link>
        </Button>
      </section>

      <TrophyCase />

      <section className="surface border-border bg-card/70 border p-5" aria-labelledby="profile-preferences">
        <h2 id="profile-preferences" className="text-muted-foreground font-mono text-[11px] sm:text-[10px] tracking-[0.14em] uppercase">
          Preferences
        </h2>
        <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
          <Field label="Preferred language" value={LANGUAGE_LABEL[profile.preferredLanguage] ?? profile.preferredLanguage} />
          <Field label="Experience level" value={LEVEL_LABEL[profile.experienceLevel] ?? profile.experienceLevel} />
          <Field label="Daily goal" value={`${profile.dailyGoalMinutes} minutes`} />
          <Field label="Time zone" value={profile.timezone} />
        </dl>
      </section>
    </div>
  )
}

function Stat({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-display text-2xl font-semibold tabular-nums">
        {value}
        {suffix}
      </dd>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  )
}
