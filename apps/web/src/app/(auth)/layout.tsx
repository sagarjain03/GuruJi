import '@/styles/app.css'
import { headers } from 'next/headers'
import { Providers } from '@/components/providers'

/**
 * Sign-in and sign-up. Tailwind, but no app shell: there is no navigation to
 * offer someone who is not signed in yet. The split-screen layout itself is
 * `AuthScreen`, which both pages render.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Set by `src/proxy.ts`, one per request. next-themes needs it for the inline
  // script it writes to set the theme before first paint.
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return <Providers {...(nonce === undefined ? {} : { nonce })}>{children}</Providers>
}
