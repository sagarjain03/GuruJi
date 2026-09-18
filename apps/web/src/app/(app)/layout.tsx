import '@/styles/app.css'
import { AppShell } from '@/components/app-shell'
import { ThemeProvider } from '@/components/theme-provider'

/**
 * The product half. Tailwind 4 + shadcn/ui, tokens in src/styles/app.css.
 *
 * Both the stylesheet and the theme provider live here rather than at the root
 * so the landing page never loads Tailwind's preflight on top of its own reset.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AppShell>{children}</AppShell>
    </ThemeProvider>
  )
}
