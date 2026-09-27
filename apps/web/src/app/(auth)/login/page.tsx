import { Suspense } from 'react'
import { AuthScreen } from '@/components/auth/auth-screen'

export const metadata = {
  title: 'Sign in',
  description: 'Sign in to GuruJi.',
}

export default function LoginPage() {
  return (
    <Suspense>
      <AuthScreen initialMode="login" />
    </Suspense>
  )
}
