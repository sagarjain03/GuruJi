'use client'

import Link from 'next/link'
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
      {/* The only route to the profile on a phone, where the icon rail is hidden. */}
      <Link
        href="/profile"
        className="text-muted-foreground hover:text-foreground max-w-32 truncate text-sm underline-offset-4 hover:underline sm:max-w-48"
      >
        {profile.displayName}
      </Link>
      <Button variant="ghost" size="sm" onClick={signOut} disabled={signingOut}>
        {signingOut ? 'Signing out…' : 'Sign out'}
      </Button>
    </div>
  )
}
