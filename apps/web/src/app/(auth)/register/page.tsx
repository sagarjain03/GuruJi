import { Suspense } from 'react'
import { AuthScreen } from '@/components/auth/auth-screen'

export const metadata = {
  title: 'Create account',
  description: 'Create a GuruJi account.',
}

export default function RegisterPage() {
  return (
    <Suspense>
      <AuthScreen initialMode="register" />
    </Suspense>
  )
}
