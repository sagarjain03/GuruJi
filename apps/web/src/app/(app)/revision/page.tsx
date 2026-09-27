import { RevisionView } from '@/components/revision/revision-view'

export const metadata = {
  title: 'Revision',
  description: 'Problems due to be recalled today, spaced so they return before you forget them.',
}

/** The spaced-repetition queue. See docs/revision-engine.md. */
export default function RevisionPage() {
  return <RevisionView />
}
