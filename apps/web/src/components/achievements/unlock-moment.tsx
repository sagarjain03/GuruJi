'use client'

import type { Unlock } from '@guruji/types'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { achievementApi } from '@/lib/api'
import { Medallion, TIER_LABEL } from './medallion'
import { TROPHY_CASE_KEY, useTrophyCase } from './trophy-case'

/**
 * The moment a tier is earned: the medallion is struck, and says what for.
 *
 * Mounted once in the shell, so it shows wherever the learner is — on the
 * dashboard after a quiet unlock, or in the workspace right after the verdict
 * that earned it. Several unlocks queue and show one at a time. Each is
 * acknowledged as it is dismissed, so a closed tab never replays one already
 * seen and never loses one that was not.
 */
export function UnlockMoment() {
  const queryClient = useQueryClient()
  const trophyCase = useTrophyCase()
  const dialog = useRef<HTMLDialogElement>(null)
  // Dismissed in this page's life, so the refetch that races the
  // acknowledgement cannot bring a moment straight back.
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())

  const queue = (trophyCase.data?.new ?? []).filter((unlock) => !dismissed.has(keyOf(unlock)))
  const current = queue[0] ?? null
  const badge = current ? trophyCase.data?.badges.find((entry) => entry.slug === current.badge) : undefined

  useEffect(() => {
    const element = dialog.current
    if (element === null) return
    if (current !== null && badge !== undefined && !element.open) element.showModal()
    if (current === null && element.open) element.close()
  }, [current, badge])

  function dismiss() {
    if (current === null) return
    setDismissed((previous) => new Set(previous).add(keyOf(current)))
    void achievementApi
      .seen({ unlocks: [current] })
      .then(() => queryClient.invalidateQueries({ queryKey: TROPHY_CASE_KEY }))
      .catch(() => {
        // Not acknowledged: it shows once more next visit, which is the safe way round.
      })
  }

  const threshold = badge?.tiers.find((tier) => tier.tier === current?.tier)?.threshold

  return (
    <dialog
      ref={dialog}
      aria-labelledby="unlock-title"
      aria-describedby="unlock-detail"
      data-testid="unlock-moment"
      // Escape closes a native dialog without asking; treat it as a dismissal.
      onCancel={(event) => {
        event.preventDefault()
        dismiss()
      }}
      className="bg-card text-foreground border-border m-auto w-[min(22rem,calc(100vw-2rem))] border p-0 backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      {current !== null && badge !== undefined && (
        <div key={keyOf(current)} className="flex flex-col items-center gap-3 px-6 pt-8 pb-6 text-center">
          <Medallion icon={badge.icon} tier={current.tier} size={148} celebrate />
          <p className="text-muted-foreground mt-2 text-sm">{TIER_LABEL[current.tier]} earned</p>
          <h2 id="unlock-title" className="font-display text-2xl font-semibold tracking-tight">
            {badge.name}
          </h2>
          <p id="unlock-detail" className="text-muted-foreground text-sm leading-relaxed">
            {badge.description}
            {threshold !== undefined && <span className="text-foreground/80 block mt-1 tabular-nums">Reached {threshold}.</span>}
          </p>
          <Button autoFocus className="mt-3 w-full" onClick={dismiss}>
            {queue.length > 1 ? `Next badge (${queue.length - 1} more)` : 'Keep going'}
          </Button>
        </div>
      )}
    </dialog>
  )
}

function keyOf(unlock: Unlock): string {
  return `${unlock.badge}:${unlock.tier}`
}
