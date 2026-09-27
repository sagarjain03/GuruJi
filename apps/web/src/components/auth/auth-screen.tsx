'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { AuthLayout } from './auth-layout'
import { IllustrationPanel } from './illustration-panel'
import { SignInForm } from './sign-in-form'
import { SignUpForm } from './sign-up-form'

export type AuthMode = 'login' | 'register'

const TITLE: Record<AuthMode, string> = {
  login: 'Sign in · GuruJi',
  register: 'Create account · GuruJi',
}

/**
 * Both forms on one screen. Switching animates in place and rewrites the URL
 * to /login or /register (query string kept, so ?next= survives) without a
 * navigation, so a reload or a shared link still lands on the right form.
 */
export function AuthScreen({ initialMode }: { initialMode: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [switched, setSwitched] = useState(false)
  const reduced = useReducedMotion() ?? false
  const slide = reduced ? 0 : 12

  const switchTo = (next: AuthMode) => {
    setMode(next)
    setSwitched(true)
    window.history.replaceState(null, '', `/${next}${window.location.search}`)
    document.title = TITLE[next]
  }

  const form = (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={mode}
        initial={{ opacity: 0, x: slide }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -slide }}
        transition={{ duration: reduced ? 0 : 0.2, ease: 'easeOut' }}
      >
        {mode === 'login' ? (
          <SignInForm onSwitch={() => switchTo('register')} focusHeading={switched} />
        ) : (
          <SignUpForm onSwitch={() => switchTo('login')} focusHeading={switched} />
        )}
      </motion.div>
    </AnimatePresence>
  )

  return <AuthLayout form={form} panel={<IllustrationPanel />} />
}
