import { Suspense } from 'react'
import { ListSkeleton } from '@/components/content/states'
import { ProblemListView } from '@/components/problems/problem-list-view'

export const metadata = {
  title: 'Problems',
  description: 'Every problem written for GuruJi, with its own test cases and hints.',
}

/**
 * The filters live in the URL, so the view reads `useSearchParams` — which the
 * App Router requires be wrapped in a Suspense boundary, otherwise the whole
 * route opts out of static rendering.
 */
export default function ProblemsPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={8} label="Loading problems…" rowClassName="h-12" />}>
      <ProblemListView />
    </Suspense>
  )
}
