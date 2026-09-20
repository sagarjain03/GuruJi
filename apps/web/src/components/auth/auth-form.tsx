'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, registerSchema, type AuthSession } from '@guruji/types'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError, authApi, setAccessToken } from '@/lib/api'
import { useSessionStore } from '@/stores/session-store'

type Mode = 'login' | 'register'

interface FormValues {
  email: string
  password: string
  displayName?: string
}

const COPY = {
  login: {
    title: 'Welcome back',
    subtitle: 'Pick up where you left off.',
    submit: 'Sign in',
    switchText: 'New here?',
    switchHref: '/register',
    switchLabel: 'Create an account',
  },
  register: {
    title: 'Create your account',
    subtitle: 'GuruJi learns what you are weak at, then tells you what to practise.',
    submit: 'Create account',
    switchText: 'Already have an account?',
    switchHref: '/login',
    switchLabel: 'Sign in',
  },
} as const

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setSession = useSessionStore((state) => state.setSession)
  const [formError, setFormError] = useState<string | null>(null)
  const copy = COPY[mode]

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    // The same schema the API validates against — one definition, not two that
    // drift until the server rejects something the form called valid.
    resolver: zodResolver(mode === 'register' ? registerSchema : loginSchema),
    defaultValues: { email: '', password: '', ...(mode === 'register' ? { displayName: '' } : {}) },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)

    try {
      const session: AuthSession =
        mode === 'register'
          ? await authApi.register({
              email: values.email,
              password: values.password,
              displayName: values.displayName ?? '',
            })
          : await authApi.login({ email: values.email, password: values.password })

      setAccessToken(session.accessToken)
      setSession(session.user, session.profile)

      const next = searchParams.get('next')
      router.replace(next?.startsWith('/') ? (next as '/dashboard') : '/dashboard')
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Could not reach the server. Try again.',
      )
    }
  })

  return (
    <div className="w-full max-w-md">
      <svg viewBox="0 0 28 28" className="size-7" fill="none" aria-hidden="true">
        <path d="M14 1.6 20.3 8 14 14.4 7.7 8 14 1.6Z" fill="#A78BFA" />
        <path d="M6.4 9.3 12.7 15.7 6.4 22.1 0.1 15.7 6.4 9.3Z" fill="#7C3AED" />
        <path d="M21.6 9.3 27.9 15.7 21.6 22.1 15.3 15.7 21.6 9.3Z" fill="#6366F1" />
      </svg>

      <h1 className="font-display mt-6 text-4xl font-semibold tracking-tight">{copy.title}</h1>
      <p className="text-muted-foreground mt-3 max-w-sm text-sm leading-relaxed">{copy.subtitle}</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5" noValidate>
        {mode === 'register' && (
          <Field id="displayName" label="Name" error={errors.displayName?.message}>
            <Input
              id="displayName"
              {...register('displayName')}
              className="h-11"
              placeholder="Your name"
              autoComplete="name"
              aria-invalid={Boolean(errors.displayName)}
            />
          </Field>
        )}

        <Field id="email" label="Email" error={errors.email?.message}>
          <Input
            id="email"
            {...register('email')}
            className="h-11"
            placeholder="you@yourdomain.com"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
          />
        </Field>

        <Field id="password" label="Password" error={errors.password?.message}>
          <Input
            id="password"
            {...register('password')}
            className="h-11"
            placeholder={mode === 'register' ? 'Create a password' : 'Your password'}
            type="password"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            aria-invalid={Boolean(errors.password)}
          />
        </Field>

        {formError && (
          <p role="alert" className="text-destructive text-sm">
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Working…' : copy.submit}
        </Button>
      </form>

      <p className="text-muted-foreground mt-8 text-center text-sm">
        {copy.switchText}{' '}
        <Link
          href={copy.switchHref}
          className="text-primary font-medium underline-offset-4 hover:underline"
        >
          {copy.switchLabel}
        </Link>
      </p>
    </div>
  )
}

function Field({
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
      {/* Without htmlFor the input has no accessible name, and a screen reader
          announces three unlabelled boxes. */}
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
