'use client'

import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

/**
 * The last line of defence for a page that throws while rendering.
 *
 * Without it one bad component blanks the whole screen, shell and all. Here
 * the shell stays — navigation still works — and the page says what happened
 * and offers the two things a person can actually do: try again, or leave.
 * Nothing about the error itself is shown; it goes to the console for us.
 */
export default function AppError({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string }
  reset: () => void
  retry?: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div
      role="alert"
      className="border-border mx-auto flex w-full max-w-xl flex-col items-center gap-4 border border-dashed px-6 py-16 text-center"
    >
      <AlertTriangle className="text-destructive size-6" aria-hidden="true" />
      <div>
        <h1 className="font-display text-xl font-semibold">This page ran into a problem</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Something on this page failed to load. Try again, or head back to the dashboard.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => (retry ?? reset)()}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
