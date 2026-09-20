import '@/styles/app.css'
import { headers } from 'next/headers'
import { Providers } from '@/components/providers'

/**
 * Sign-in and sign-up. Tailwind, but no app shell: there is no navigation to
 * offer someone who is not signed in yet.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Set by `src/proxy.ts`, one per request. next-themes needs it for the inline
  // script it writes to set the theme before first paint.
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    <Providers {...(nonce === undefined ? {} : { nonce })}>
      <main className="flex min-h-svh items-center justify-center px-4 py-12">{children}</main>
    </Providers>
  )
}
