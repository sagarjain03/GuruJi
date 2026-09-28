'use client'

import Link from 'next/link'
import { Medallion, TIER_LABEL } from './medallion'
import { progressToNext, useTrophyCase } from './trophy-case'

/**
 * The three badges closest to their next tier. Closest, not newest: the point
 * is what one more session would earn.
 */
export function NextUp() {
  const trophyCase = useTrophyCase()
  const closest = (trophyCase.data?.badges ?? [])
    .map((badge) => ({ badge, progress: progressToNext(badge) }))
    .filter((entry): entry is { badge: typeof entry.badge; progress: number } => entry.progress !== null)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 3)

  // Nothing to show on failure or while loading: this strip is encouragement,
  // not information the dashboard depends on.
  if (closest.length === 0) return null

  return (
    <section className="border-border bg-card/70 border p-5" aria-labelledby="next-up" data-testid="next-up">
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h2 id="next-up" className="font-display text-base font-semibold">
            Next up
          </h2>
          <p className="text-muted-foreground text-xs">Badges closest to their next tier.</p>
        </div>
        <Link href="/profile" className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline">
          All badges
        </Link>
      </header>

      <ul className="grid gap-4 sm:grid-cols-3">
        {closest.map(({ badge, progress }) => (
          <li key={badge.slug} className="flex items-center gap-3">
            <Medallion icon={badge.icon} tier={badge.tier} progress={progress} size={52} />
            <div className="min-w-0 flex-1">
              <p className="font-display truncate text-sm font-semibold">{badge.name}</p>
              <p className="text-muted-foreground text-xs tabular-nums">
                {badge.value} / {badge.next?.threshold} to {badge.next ? TIER_LABEL[badge.next.tier] : ''}
              </p>
              <div
                role="progressbar"
                aria-label={`${badge.name} progress`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
                className="bg-muted mt-1.5 h-1 w-full"
              >
                <div className="bg-primary h-full" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
