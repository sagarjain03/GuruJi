'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/** Minutes left at which the time is announced to screen readers, once each. */
const ANNOUNCE_AT_MINUTES = [10, 1]

function format(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}

/**
 * Time left in a contest, counted from the server's clock.
 *
 * `serverNow` and the local clock are compared once, when a view arrives, and
 * the difference is applied to every tick: a laptop whose clock is five
 * minutes fast still shows the real time left. The server decides when time
 * is up; this only displays it, and asks the parent to look again at zero.
 */
export function Countdown({
  deadlineAt,
  serverNow,
  onExpire,
  className,
}: {
  deadlineAt: string
  serverNow: string
  onExpire: () => void
  className?: string
}) {
  const deadline = new Date(deadlineAt).getTime()
  // Server minus local, fixed when this view arrived.
  const [skew] = useState(() => new Date(serverNow).getTime() - Date.now())
  const [remaining, setRemaining] = useState(() => deadline - (Date.now() + skew))
  const [announcement, setAnnouncement] = useState('')
  const announced = useRef(new Set<number>())
  const expired = useRef(false)
  const expire = useRef(onExpire)

  useEffect(() => {
    expire.current = onExpire
  }, [onExpire])

  // One timer for the whole countdown, not one per render.
  useEffect(() => {
    const tick = (): void => {
      const left = deadline - (Date.now() + skew)
      setRemaining(left)
      for (const minutes of ANNOUNCE_AT_MINUTES) {
        if (left <= minutes * 60_000 && left > 0 && !announced.current.has(minutes)) {
          announced.current.add(minutes)
          setAnnouncement(`${minutes} minute${minutes === 1 ? '' : 's'} left in the contest.`)
        }
      }
      if (left <= 0 && !expired.current) {
        expired.current = true
        expire.current()
      }
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [deadline, skew])

  const urgent = remaining <= 5 * 60_000

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-muted-foreground font-mono text-[11px] tracking-[0.14em] uppercase sm:text-[10px]">Time left</span>
      <time
        dateTime={deadlineAt}
        className={cn('font-mono text-lg font-semibold tabular-nums', urgent && 'text-destructive')}
        // The visible clock changes every second; it is deliberately not live.
        aria-label={`Time left: ${format(remaining)}`}
      >
        {format(remaining)}
      </time>
      <span className="sr-only" aria-live="polite" data-testid="countdown-announcement">
        {announcement}
      </span>
    </div>
  )
}
