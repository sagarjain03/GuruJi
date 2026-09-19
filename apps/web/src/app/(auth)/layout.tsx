import '@/styles/app.css'
import { Providers } from '@/components/providers'

/**
 * Sign-in and sign-up. Tailwind, but no app shell: there is no navigation to
 * offer someone who is not signed in yet.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <main className="flex min-h-svh items-center justify-center px-4 py-12">{children}</main>
    </Providers>
  )
}
