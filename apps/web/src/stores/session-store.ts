import type { PublicProfile, PublicUser } from '@guruji/types'
import { create } from 'zustand'

type SessionStatus = 'loading' | 'authenticated' | 'anonymous'

interface SessionState {
  status: SessionStatus
  user: PublicUser | null
  profile: PublicProfile | null
  setSession: (user: PublicUser, profile: PublicProfile) => void
  clearSession: () => void
}

/**
 * Who is signed in, for the current tab.
 *
 * The access token is deliberately absent: it lives in a module variable inside
 * the API client, where no component can render it into the DOM by accident and
 * no devtools panel lists it beside the rest of the state.
 *
 * `status` starts as 'loading' because a cold page load cannot know yet — the
 * refresh cookie has to be exchanged first. Treating that moment as 'anonymous'
 * would flash the login page at every signed-in user on every refresh.
 */
export const useSessionStore = create<SessionState>((set) => ({
  status: 'loading',
  user: null,
  profile: null,
  setSession: (user, profile) => set({ status: 'authenticated', user, profile }),
  clearSession: () => set({ status: 'anonymous', user: null, profile: null }),
}))
