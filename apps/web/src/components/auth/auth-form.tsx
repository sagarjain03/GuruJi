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
    <div className="w-full max-w-sm">
      <h1 className="font-display text-2xl font-semibold tracking-tight">{copy.title}</h1>
      <p className="text-muted-foreground mt-1 text-sm">{copy.subtitle}</p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        {mode === 'register' && (
          <Field id="displayName" label="Name" error={errors.displayName?.message}>
            <Input
              id="displayName"
              {...register('displayName')}
              autoComplete="name"
              aria-invalid={Boolean(errors.displayName)}
            />
          </Field>
        )}

        <Field id="email" label="Email" error={errors.email?.message}>
          <Input
            id="email"
            {...register('email')}
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
          />
        </Field>

        <Field id="password" label="Password" error={errors.password?.message}>
          <Input
            id="password"
            {...register('password')}
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

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Working…' : copy.submit}
        </Button>
      </form>

      <p className="text-muted-foreground mt-6 text-sm">
        {copy.switchText}{' '}
        <Link href={copy.switchHref} className="text-foreground underline underline-offset-4">
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
    <div className="flex flex-col gap-1.5">
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
