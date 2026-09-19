'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { refreshSession, setAccessToken } from '@/lib/api'
import { useSessionStore } from '@/stores/session-store'

/**
 * Turns the refresh cookie into a live session, once, on first mount.
 *
 * The middleware already redirects anyone without a refresh cookie, but a cookie
 * proves nothing about whether the token behind it is still valid — it could be
 * expired, or revoked because someone replayed it. This is the check that counts.
 */
export function SessionGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const status = useSessionStore((state) => state.status)
  const setSession = useSessionStore((state) => state.setSession)
  const clearSession = useSessionStore((state) => state.clearSession)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) {
      return
    }
    started.current = true

    void (async () => {
      const session = await refreshSession()

      if (session) {
        setSession(session.user, session.profile)
        return
      }

      setAccessToken(null)
      clearSession()
      router.replace('/login')
    })()
  }, [clearSession, router, setSession])

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground text-sm" role="status">
          Checking your session…
        </p>
      </div>
    )
  }

  return <>{children}</>
}
