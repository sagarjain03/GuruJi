import { Suspense } from 'react'
import { LoadingState } from '@/components/content/states'
import { ProblemListView } from '@/components/problems/problem-list-view'

export const metadata = { title: 'Problems' }

/**
 * The filters live in the URL, so the view reads `useSearchParams` — which the
 * App Router requires be wrapped in a Suspense boundary, otherwise the whole
 * route opts out of static rendering.
 */
export default function ProblemsPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading problems…" />}>
      <ProblemListView />
    </Suspense>
  )
}
