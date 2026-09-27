'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema } from '@guruji/types'
import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authApi } from '@/lib/api'
import {
  AuthDivider,
  AuthField,
  authLinkClass,
  GoogleButton,
  PasswordInput,
  useAuthSubmit,
} from './auth-fields'

interface Values {
  email: string
  password: string
}

export function SignInForm({
  onSwitch,
  focusHeading = false,
}: {
  onSwitch: () => void
  /** True after a switch, so keyboard and screen-reader users land on the new form. */
  focusHeading?: boolean
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  const { run, formError } = useAuthSubmit()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    // The same schema the API validates against.
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  useEffect(() => {
    if (focusHeading) heading.current?.focus()
  }, [focusHeading])

  const onSubmit = handleSubmit((values) => run(() => authApi.login(values)))

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1
          ref={heading}
          tabIndex={-1}
          className="font-display text-3xl font-semibold tracking-tight outline-none"
        >
          Sign in
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">Pick up where you left off.</p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <AuthField id="email" label="Email" error={errors.email?.message}>
          <Input
            id="email"
            {...register('email')}
            type="email"
            placeholder="name@email.com"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            className="h-11"
          />
        </AuthField>

        <AuthField id="password" label="Password" error={errors.password?.message}>
          <PasswordInput
            id="password"
            {...register('password')}
            placeholder="Your password"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.password)}
          />
        </AuthField>

        {formError && (
          <p role="alert" className="text-destructive text-sm">
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Working…' : 'Sign in'}
        </Button>
      </form>

      <p className="text-muted-foreground text-sm">
        New here?{' '}
        <a
          href="/register"
          onClick={(e) => {
            e.preventDefault()
            onSwitch()
          }}
          className={authLinkClass}
        >
          Create an account
        </a>
      </p>

      <AuthDivider />
      <GoogleButton />
    </div>
  )
}
