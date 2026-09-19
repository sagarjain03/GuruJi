'use client'

import { ChevronRight, Clock3, Flame, Globe2, Layers, Sparkles, Target } from 'lucide-react'
import { useSessionStore } from '@/stores/session-store'
import { cn } from '@/lib/utils'

const LANGUAGE_LABEL: Record<string, string> = {
  CPP: 'C++',
  C: 'C',
  PYTHON: 'Python',
  JAVASCRIPT: 'JavaScript',
}

const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
}

export function DashboardView() {
  const profile = useSessionStore((state) => state.profile)

  if (!profile) {
    return null
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
        <HeroPanel name={profile.displayName} />
        <SetupPanel
          language={LANGUAGE_LABEL[profile.preferredLanguage] ?? profile.preferredLanguage}
          level={LEVEL_LABEL[profile.experienceLevel] ?? profile.experienceLevel}
          dailyGoalMinutes={profile.dailyGoalMinutes}
          timezone={profile.timezone}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <MasteryPanel />
        <RevisionPanel />
        <StreakPanel current={profile.currentStreak} longest={profile.longestStreak} />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section
      className={cn(
        'border-border bg-card/70 relative overflow-hidden border p-5 backdrop-blur-xl',
        className,
      )}
    >
      {children}
    </section>
  )
}

function HeroPanel({ name }: { name: string }) {
  return (
    <Panel className="flex flex-col gap-4">
      <div className="relative">
        <span className="border-border/70 text-muted-foreground inline-flex items-center gap-1.5 border px-3 py-1 font-mono text-[10px] tracking-[0.18em] uppercase">
          <Sparkles className="size-3" />
          Today&apos;s training
        </span>

        <h1 className="font-display mt-4 text-3xl font-semibold tracking-tight">
          Welcome, {name.split(' ')[0]}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
          GuruJi picks one thing for you to do next — a revision that is due, a topic you are weak
          at, or a pattern you have never seen. It cannot pick yet, because you have not solved
          anything for it to learn from.
        </p>
      </div>

      <div className="relative flex flex-wrap gap-2">
        <Chip label="Solved" value="0" />
        <Chip label="Accuracy" value="—" />
        <Chip label="Due today" value="0" />
        <Chip label="Hints used" value="0" />
      </div>

      <div className="relative flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled
          className="bg-primary text-primary-foreground px-6 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-35"
        >
          Train now
        </button>
        <p className="text-muted-foreground text-xs">
          Unlocks once there are problems to train on.
        </p>
      </div>
    </Panel>
  )
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="border-border/60 bg-background/40 inline-flex items-center gap-2 border px-3 py-1.5">
      <span className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
        {label}
      </span>
      <span className="font-mono text-xs font-semibold">{value}</span>
    </span>
  )
}

function SetupPanel({
  language,
  level,
  dailyGoalMinutes,
  timezone,
}: {
  language: string
  level: string
  dailyGoalMinutes: number
  timezone: string
}) {
  const rows = [
    { Icon: Layers, label: 'Language', value: language, highlight: true },
    { Icon: Target, label: 'Level', value: level, highlight: false },
    { Icon: Clock3, label: 'Daily goal', value: `${dailyGoalMinutes} min`, highlight: false },
    { Icon: Globe2, label: 'Timezone', value: timezone, highlight: false },
  ]

  return (
    <Panel className="flex flex-col">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-base font-semibold">Your setup</h2>
        <span className="text-muted-foreground text-xs">From your profile</span>
      </header>

      <ul className="flex flex-col gap-2">
        {rows.map(({ Icon, label, value, highlight }) => (
          <li key={label}>
            <div
              className={cn(
                'flex items-center gap-3 rounded-none px-3 py-2.5 transition-colors',
                highlight
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary/60 hover:bg-secondary',
              )}
            >
              <span
                className={cn(
                  'grid size-8 place-items-center rounded-none',
                  highlight ? 'bg-white/20' : 'bg-background/60 text-muted-foreground',
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm leading-tight font-medium">{label}</span>
                <span
                  className={cn(
                    'block truncate text-xs',
                    highlight ? 'text-white/80' : 'text-muted-foreground',
                  )}
                >
                  {value}
                </span>
              </span>
              <ChevronRight
                className={cn(
                  'ml-auto size-4 shrink-0',
                  highlight ? 'text-white/70' : 'text-muted-foreground/50',
                )}
              />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/** A donut gauge. At zero it still draws the track, so the shape reads as empty rather than broken. */
function Gauge({ value, label }: { value: number | null; label: string }) {
  const radius = 44
  const circumference = 2 * Math.PI * radius
  const filled = value === null ? 0 : (Math.min(Math.max(value, 0), 100) / 100) * circumference

  return (
    <div className="relative grid size-[112px] place-items-center">
      <svg viewBox="0 0 112 112" className="-rotate-90">
        <circle cx="56" cy="56" r={radius} fill="none" stroke="var(--muted)" strokeWidth="10" />
        {filled > 0 && (
          <circle
            cx="56"
            cy="56"
            r={radius}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="10"
            strokeDasharray={`${filled} ${circumference}`}
          />
        )}
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-3xl font-semibold tracking-tight">
          {value === null ? '—' : value}
        </span>
        <span className="text-muted-foreground font-mono text-[10px] tracking-[0.18em] uppercase">
          {label}
        </span>
      </div>
    </div>
  )
}

function MasteryPanel() {
  return (
    <Panel className="flex flex-col items-center text-center">
      <header className="mb-4 w-full text-left">
        <h2 className="font-display text-base font-semibold">Mastery</h2>
        <p className="text-muted-foreground text-xs">Across every topic, 0&ndash;100.</p>
      </header>
      <Gauge value={null} label="overall" />
      <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
        Computed from real submissions — accuracy, time, hints and how much you remember later.
        Nothing to measure yet.
      </p>
    </Panel>
  )
}

function RevisionPanel() {
  return (
    <Panel className="flex flex-col">
      <header className="mb-4">
        <h2 className="font-display text-base font-semibold">Revision due</h2>
        <p className="text-muted-foreground text-xs">Problems ready to be recalled.</p>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4">
        <div className="border-border/70 grid size-16 place-items-center rounded-none border border-dashed">
          <span className="font-display text-xl font-semibold">0</span>
        </div>
        <p className="text-muted-foreground text-center text-xs leading-relaxed">
          Solve a problem and it joins the queue, then comes back exactly when you are about to
          forget it.
        </p>
      </div>
    </Panel>
  )
}

function StreakPanel({ current, longest }: { current: number; longest: number }) {
  return (
    <Panel className="flex flex-col">
      <header className="mb-4">
        <h2 className="font-display text-base font-semibold">Streak</h2>
        <p className="text-muted-foreground text-xs">Days in a row with practice.</p>
      </header>

      <div className="flex flex-1 items-center gap-4">
        <span className="border-border/70 grid size-16 shrink-0 place-items-center border">
          <Flame className="text-primary size-7" />
        </span>
        <div className="grid grid-cols-2 gap-3">
          <Stat value={current} label="Current" />
          <Stat value={longest} label="Longest" />
        </div>
      </div>

      <p className="text-muted-foreground mt-4 text-xs">
        Counted in your own timezone, not UTC midnight.
      </p>
    </Panel>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="font-display text-2xl leading-none font-semibold">{value}</p>
      <p className="text-muted-foreground mt-1 font-mono text-[10px] tracking-[0.18em] uppercase">
        {label}
      </p>
    </div>
  )
}
