import '@/styles/app.css'
import { AppShell } from '@/components/app-shell'
import { Providers } from '@/components/providers'
import { SessionGate } from '@/components/session-gate'

/**
 * The product half. Tailwind 4 + shadcn/ui, tokens in src/styles/app.css.
 *
 * Both the stylesheet and the providers live here rather than at the root so the
 * landing page never loads Tailwind's preflight on top of its own reset.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <SessionGate>
        <AppShell>{children}</AppShell>
      </SessionGate>
    </Providers>
  )
}
