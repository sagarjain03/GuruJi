import '@/styles/app.css'
import { headers } from 'next/headers'
import { AuthPanel } from '@/components/auth/auth-panel'
import { Providers } from '@/components/providers'

/**
 * Sign-in and sign-up. Tailwind, but no app shell: there is no navigation to
 * offer someone who is not signed in yet.
 *
 * Split screen — form on the left, showcase on the right. Below `lg` the
 * showcase drops out entirely and the form takes the full width.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Set by `src/proxy.ts`, one per request. next-themes needs it for the inline
  // script it writes to set the theme before first paint.
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    <Providers {...(nonce === undefined ? {} : { nonce })}>
      <div className="grid min-h-svh lg:grid-cols-2">
        <main className="flex items-center justify-center px-6 py-12 sm:px-10 lg:px-16">
          {children}
        </main>
        <AuthPanel />
      </div>
    </Providers>
  )
}
