import { MistakesView } from '@/components/mistakes/mistakes-view'

export const metadata = { title: 'Mistake journal' }

/** What went wrong, and what keeps going wrong. See docs/mastery-model.md. */
export default function MistakesPage() {
  return <MistakesView />
}
