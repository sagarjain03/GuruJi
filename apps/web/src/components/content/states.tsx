'use client'

import { AlertTriangle, Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
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

/**
 * A placeholder in the shape of what is coming. A spinner says "wait"; a
 * skeleton says what to wait for, and the page does not jump when it arrives.
 * The label is for screen readers, which cannot see the shape.
 */
export function ListSkeleton({
  rows = 5,
  label = 'Loading…',
  rowClassName = 'h-14',
}: {
  rows?: number
  label?: string
  rowClassName?: string
}) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-2">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className={cn('w-full', rowClassName)} />
      ))}
    </div>
  )
}

/** The problem page's shape: statement on the left, editor and tests on the right. */
export function WorkspaceSkeleton({ label = 'Loading the problem…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className="flex h-[calc(100svh-6.5rem)] min-h-[560px] flex-col gap-3 lg:flex-row"
    >
      <span className="sr-only">{label}</span>
      <div className="border-border flex flex-col gap-3 border p-5 lg:basis-[42%]">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="mt-4 h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <div className="border-border flex min-w-0 flex-1 flex-col gap-3 border p-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="w-full flex-1" />
        <Skeleton className="h-40 w-full" />
      </div>
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
        'inline-flex shrink-0 border px-2 py-0.5 font-mono text-[11px] sm:text-[10px] tracking-[0.14em] uppercase',
        DIFFICULTY_STYLE[difficulty] ?? 'text-muted-foreground border-border',
      )}
    >
      {DIFFICULTY_LABEL[difficulty] ?? difficulty}
    </span>
  )
}
