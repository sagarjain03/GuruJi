'use client'

import '@/styles/app.css'
import { AlertTriangle } from 'lucide-react'
import { HardLink } from '@/components/hard-link'

/**
 * A render error anywhere below the root layout. `reset` re-renders the
 * segment; the home link is a full load in case the error is in the app shell
 * itself.
 */
export default function RootError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="bg-background text-foreground grid min-h-svh place-items-center px-6">
      <div
        role="alert"
        className="border-border flex w-full max-w-md flex-col items-center gap-3 border border-dashed px-6 py-14 text-center"
      >
        <AlertTriangle className="text-destructive size-5" />
        <p className="text-muted-foreground font-mono text-[11px] sm:text-[10px] tracking-[0.18em] uppercase">
          Error
        </p>
        <h1 className="font-display text-xl font-semibold">This page failed to load</h1>
        <p className="text-muted-foreground max-w-xs text-sm">
          Something broke while rendering it. Try again, or start from the home page.
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="border-border hover:bg-accent border px-3 py-1.5 text-xs font-medium"
          >
            Try again
          </button>
          <HardLink
            href="/"
            className="border-border hover:bg-accent border px-3 py-1.5 text-xs font-medium"
          >
            Back to home
          </HardLink>
        </div>
      </div>
    </div>
  )
}
