import { Suspense } from 'react'
import { AuthForm } from '@/components/auth/auth-form'

export const metadata = { title: 'Create account' }

export default function RegisterPage() {
  return (
    <Suspense>
      <AuthForm mode="register" />
    </Suspense>
  )
}
