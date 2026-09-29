'use client'

import type { Badge } from '@guruji/types'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { achievementApi } from '@/lib/api'
import { Medallion, TIER_LABEL } from './medallion'

/** One key for every reader of badges: profile, dashboard and the unlock moment. */
export const TROPHY_CASE_KEY = ['achievements'] as const

export function useTrophyCase() {
  return useQuery({ queryKey: TROPHY_CASE_KEY, queryFn: () => achievementApi.trophyCase() })
}

/**
 * How far along to the next tier, 0..1: the same `value / threshold` the text
 * beside it shows, so "3 / 4" is never drawn as half a bar.
 */
export function progressToNext(badge: Badge): number | null {
  if (badge.next === null) return null
  return Math.max(0, Math.min(1, badge.value / badge.next.threshold))
}

export function standing(badge: Badge): string {
  if (badge.next === null) return `${TIER_LABEL[badge.tier ?? 'BRONZE']} · top tier`
  const toward = `${badge.value} / ${badge.next.threshold} to ${TIER_LABEL[badge.next.tier]}`
  return badge.tier === null ? toward : `${TIER_LABEL[badge.tier]} · ${toward}`
}

/**
 * All twelve badges, in catalogue order so each keeps its place as it is
 * earned. Locked ones are shown too: seeing what exists is half the reason
 * to go and get it.
 */
export function TrophyCase() {
  const trophyCase = useTrophyCase()
  const badges = trophyCase.data?.badges ?? []
  const earned = badges.filter((badge) => badge.tier !== null).length

  return (
    <section className="border-border bg-card/70 border p-5" aria-labelledby="profile-badges">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="profile-badges" className="text-muted-foreground font-mono text-[11px] sm:text-[10px] tracking-[0.14em] uppercase">
          Badges
        </h2>
        {trophyCase.data && (
          <p className="text-muted-foreground text-xs tabular-nums">
            {earned} of {badges.length} earned
          </p>
        )}
      </div>

      {trophyCase.isPending ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-44 w-full" />
          ))}
        </div>
      ) : trophyCase.isError ? (
        <p role="alert" className="text-destructive mt-3 text-sm">
          Could not load your badges. Refresh to try again.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {badges.map((badge) => (
            <li
              key={badge.slug}
              data-testid={`badge-${badge.slug}`}
              data-tier={badge.tier ?? 'LOCKED'}
              className="border-border/60 flex flex-col items-center gap-2 border px-3 pt-4 pb-3 text-center"
            >
              <Medallion icon={badge.icon} tier={badge.tier} progress={progressToNext(badge)} size={84} />
              <p className={badge.tier === null ? 'text-muted-foreground font-display text-sm font-semibold' : 'font-display text-sm font-semibold'}>
                {badge.name}
              </p>
              <p className="text-muted-foreground text-xs tabular-nums">{standing(badge)}</p>
              <p className="text-muted-foreground/80 text-xs leading-snug">{badge.description}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
