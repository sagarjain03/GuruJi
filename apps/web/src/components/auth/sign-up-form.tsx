'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { registerSchema } from '@guruji/types'
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
  displayName: string
  email: string
  password: string
}

export function SignUpForm({
  onSwitch,
  focusHeading = false,
}: {
  onSwitch: () => void
  focusHeading?: boolean
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  const { run, formError } = useAuthSubmit()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  })

  useEffect(() => {
    if (focusHeading) heading.current?.focus()
  }, [focusHeading])

  const onSubmit = handleSubmit((values) => run(() => authApi.register(values)))

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1
          ref={heading}
          tabIndex={-1}
          className="font-display text-3xl font-semibold tracking-tight outline-none"
        >
          Create your account
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          GuruJi learns what you are weak at, then tells you what to practise.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <AuthField id="displayName" label="Name" error={errors.displayName?.message}>
          <Input
            id="displayName"
            {...register('displayName')}
            placeholder="Your name"
            autoComplete="name"
            aria-invalid={Boolean(errors.displayName)}
            className="h-11"
          />
        </AuthField>

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
            placeholder="Create a password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
          />
        </AuthField>

        {formError && (
          <p role="alert" className="text-destructive text-sm">
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Working…' : 'Create account'}
        </Button>
      </form>

      <p className="text-muted-foreground text-sm">
        Already have an account?{' '}
        <a
          href="/login"
          onClick={(e) => {
            e.preventDefault()
            onSwitch()
          }}
          className={authLinkClass}
        >
          Sign in
        </a>
      </p>

      <AuthDivider />
      <GoogleButton />
    </div>
  )
}
