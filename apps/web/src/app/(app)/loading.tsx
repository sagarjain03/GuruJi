import { Skeleton } from '@/components/ui/skeleton'

/**
 * Shown inside the app shell while a route's code and first render arrive.
 *
 * Every page is split into its own chunk and loaded on navigation; without
 * this the old page simply sits there, and a slow chunk reads as a dead click.
 * The shape is generic on purpose — a heading and a column of cards is what
 * every page here starts with.
 */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="mx-auto flex w-full max-w-6xl flex-col gap-3">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-9 w-72 max-w-full" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
      <Skeleton className="h-56 w-full" />
    </div>
  )
}
