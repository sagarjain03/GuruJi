'use client'

import { AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The three states every list and every detail page has to render.
 *
 * They live in one file because the failure mode they exist to prevent is a
 * page that handles loading but forgets empty, or reports an error as an empty
 * list — which reads to the user as "there is nothing here".
 */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm"
      role="status"
    >
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      className="border-border text-muted-foreground flex flex-col items-center gap-3 border border-dashed py-16 text-sm"
      role="alert"
    >
      <AlertTriangle className="text-destructive size-5" />
      <p>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="border-border hover:bg-accent border px-3 py-1.5 text-xs font-medium"
        >
          Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  detail,
  className,
}: {
  title: string
  detail?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'border-border flex flex-col items-center gap-1 border border-dashed py-16 text-center',
        className,
      )}
    >
      <p className="text-sm font-medium">{title}</p>
      {detail && <p className="text-muted-foreground max-w-sm text-xs">{detail}</p>}
    </div>
  )
}

const DIFFICULTY_STYLE: Record<string, string> = {
  EASY: 'text-[var(--difficulty-easy)] border-[var(--difficulty-easy)]/40',
  MEDIUM: 'text-[var(--difficulty-medium)] border-[var(--difficulty-medium)]/40',
  HARD: 'text-[var(--difficulty-hard)] border-[var(--difficulty-hard)]/40',
}

const DIFFICULTY_LABEL: Record<string, string> = {
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',
}

/**
 * Colour is never the only signal — the word is always there too. Roughly one in
 * twelve men cannot separate the easy/hard pair by hue.
 */
export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 border px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] uppercase',
        DIFFICULTY_STYLE[difficulty] ?? 'text-muted-foreground border-border',
      )}
    >
      {DIFFICULTY_LABEL[difficulty] ?? difficulty}
    </span>
  )
}
