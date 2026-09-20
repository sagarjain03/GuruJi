import { RevisionView } from '@/components/revision/revision-view'

export const metadata = { title: 'Revision' }

/** The spaced-repetition queue. See docs/revision-engine.md. */
export default function RevisionPage() {
  return <RevisionView />
}
