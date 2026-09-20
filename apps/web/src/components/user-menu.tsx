'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { authApi, setAccessToken } from '@/lib/api'
import { closeSocket } from '@/lib/socket'
import { useSessionStore } from '@/stores/session-store'

export function UserMenu() {
  const router = useRouter()
  const profile = useSessionStore((state) => state.profile)
  const clearSession = useSessionStore((state) => state.clearSession)
  const [signingOut, setSigningOut] = useState(false)

  if (!profile) {
    return null
  }

  const signOut = async () => {
    setSigningOut(true)
    try {
      // Revokes the refresh token server-side; clearing local state alone would
      // leave a usable token sitting in the cookie jar.
      await authApi.logout()
    } finally {
      setAccessToken(null)
      // The room this socket is in was decided by the token it handshook with.
      // Left open, it would keep pushing the previous user's verdicts into the page.
      closeSocket()
      clearSession()
      router.replace('/login')
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground hidden text-sm sm:inline">{profile.displayName}</span>
      <Button variant="ghost" size="sm" onClick={signOut} disabled={signingOut}>
        {signingOut ? 'Signing out…' : 'Sign out'}
      </Button>
    </div>
  )
}
