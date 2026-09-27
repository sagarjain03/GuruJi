'use client'

import type { AuthSession } from '@guruji/types'
import { Eye, EyeOff } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, type ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError, setAccessToken } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/stores/session-store'

export const authLinkClass = 'text-foreground font-medium underline underline-offset-4 hover:no-underline'

/**
 * Submit handler shared by both forms: store the session, then go where the
 * user was headed (only same-origin paths) or to the dashboard.
 */
export function useAuthSubmit() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setSession = useSessionStore((state) => state.setSession)
  const [formError, setFormError] = useState<string | null>(null)

  const run = async (request: () => Promise<AuthSession>) => {
    setFormError(null)
    try {
      const session = await request()
      setAccessToken(session.accessToken)
      setSession(session.user, session.profile)
      const next = searchParams.get('next')
      router.replace(next?.startsWith('/') ? (next as '/dashboard') : '/dashboard')
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Could not reach the server. Try again.',
      )
    }
  }

  return { run, formError }
}

export function AuthField({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string | undefined
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      {/* htmlFor gives the input its accessible name. */}
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  )
}

export function PasswordInput({ className, ...props }: ComponentProps<'input'>) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className={cn('h-11 pr-11', className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 grid w-11 place-items-center transition-colors"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3" role="separator" aria-label="Or continue with">
      <span className="bg-border h-px flex-1" />
      <span className="text-muted-foreground font-mono text-[11px] sm:text-[10px] tracking-[0.18em] uppercase">
        Or continue with
      </span>
      <span className="bg-border h-px flex-1" />
    </div>
  )
}

/** Shown but inert: the API has no Google sign-in yet. */
export function GoogleButton() {
  return (
    <Button type="button" variant="outline" size="lg" disabled className="w-full">
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
        <path
          fill="currentColor"
          d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.63 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.68 3.7 14.55 2.75 12 2.75 6.9 2.75 2.75 6.9 2.75 12S6.9 21.25 12 21.25c5.34 0 8.88-3.75 8.88-9.04 0-.6-.07-1.06-.15-1.51Z"
        />
      </svg>
      Continue with Google
      <span className="border-border text-muted-foreground border px-2 py-0.5 text-[11px] sm:text-[10px]">
        soon
      </span>
    </Button>
  )
}
