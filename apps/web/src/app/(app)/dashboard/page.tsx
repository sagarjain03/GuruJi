import { DashboardView } from '@/components/dashboard/dashboard-view'

export const metadata = { title: 'Dashboard' }

/**
 * Phase 1 dashboard.
 *
 * Everything on it that carries a number is read from the signed-in profile —
 * language, level, daily goal, timezone, streak. Mastery and the revision queue
 * render their real empty states rather than invented bars, because the engines
 * that fill them do not exist until Phases 5 and 6, and a dashboard that looks
 * finished while nothing behind it works is the one thing the product spec rules
 * out.
 */
export default function DashboardPage() {
  return <DashboardView />
}
