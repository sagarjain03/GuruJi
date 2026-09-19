import { ProblemDetailView } from '@/components/problems/problem-detail-view'

export const metadata = { title: 'Problem' }

export default async function ProblemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <ProblemDetailView slug={slug} />
}
