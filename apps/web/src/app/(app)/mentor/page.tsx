import { MentorHistoryView } from '@/components/mentor/mentor-history-view'

export const metadata = {
  title: 'AI Mentor',
  description: 'Every hint, explanation, analysis and solution the mentor has given you.',
}

/** The mentor's past answers. Asking happens on a problem page; this is the record. */
export default function MentorPage() {
  return <MentorHistoryView />
}
