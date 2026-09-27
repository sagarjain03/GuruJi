import { HardLink } from '@/components/hard-link'
import { Logo } from '@/components/icons'

/**
 * Split screen: form on the left, showcase on the right. Below `md` the
 * showcase drops out and the form takes the full width.
 */
export function AuthLayout({ form, panel }: { form: React.ReactNode; panel: React.ReactNode }) {
  return (
    <div className="auth-screen bg-background text-foreground grid min-h-svh md:grid-cols-2">
      <main className="relative flex items-center justify-center px-6 py-20">
        {/* A full page load: the landing must not inherit this page's Tailwind reset. */}
        <HardLink
          href="/"
          className="font-display absolute top-6 left-6 flex items-center gap-2 text-sm font-semibold"
        >
          <Logo className="size-5" />
          GuruJi
        </HardLink>
        <div className="w-full max-w-95">{form}</div>
      </main>
      {panel}
    </div>
  )
}
