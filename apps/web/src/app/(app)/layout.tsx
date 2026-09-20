import '@/styles/app.css'
import { headers } from 'next/headers'
import { AppShell } from '@/components/app-shell'
import { Providers } from '@/components/providers'
import { SessionGate } from '@/components/session-gate'

/**
 * The product half. Tailwind 4 + shadcn/ui, tokens in src/styles/app.css.
 *
 * Both the stylesheet and the providers live here rather than at the root so the
 * landing page never loads Tailwind's preflight on top of its own reset.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Set by `src/proxy.ts`, one per request. next-themes needs it for the inline
  // script it writes to set the theme before first paint.
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    <Providers {...(nonce === undefined ? {} : { nonce })}>
      <SessionGate>
        <AppShell>{children}</AppShell>
      </SessionGate>
    </Providers>
  )
}
