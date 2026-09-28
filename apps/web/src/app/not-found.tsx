import '@/styles/app.css'
import type { Metadata } from 'next'
import { HardLink } from '@/components/hard-link'
import { Logo } from '@/components/icons'

export const metadata: Metadata = {
  title: 'Not found',
  description: 'There is no page at this address.',
}

/**
 * Any unmatched URL. The root layout loads no stylesheet, so this page brings
 * the app's own. Same dashed box as the in-app empty and error states.
 */
export default function NotFound() {
  return (
    <div className="bg-background text-foreground grid min-h-svh place-items-center px-6">
      <div className="border-border flex w-full max-w-md flex-col items-center gap-3 border border-dashed px-6 py-14 text-center">
        <Logo className="size-12" />
        <p className="text-muted-foreground font-mono text-[11px] sm:text-[10px] tracking-[0.18em] uppercase">
          404
        </p>
        <h1 className="font-display text-xl font-semibold">No page here</h1>
        <p className="text-muted-foreground max-w-xs text-sm">
          The address is wrong, or the page was moved.
        </p>
        <HardLink
          href="/"
          className="border-border hover:bg-accent mt-2 border px-3 py-1.5 text-xs font-medium"
        >
          Back to home
        </HardLink>
      </div>
    </div>
  )
}
