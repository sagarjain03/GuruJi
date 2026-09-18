'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
] as const

const subscribeToNothing = () => () => {}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  // The server cannot know the stored theme, so rendering the active state before
  // mount would be a hydration mismatch. Render the frame, fill it in after.
  // `useSyncExternalStore` gives the server/client split without a setState effect.
  const mounted = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  )

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="border-border bg-card/50 inline-flex items-center gap-0.5 rounded-lg border p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = mounted && theme === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            onClick={() => setTheme(value)}
            className={cn(
              'grid size-7 place-items-center rounded-md transition-colors',
              active
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-3.5" />
          </button>
        )
      })}
    </div>
  )
}
