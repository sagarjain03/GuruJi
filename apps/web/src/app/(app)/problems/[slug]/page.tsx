import type { ProblemDetail } from '@guruji/types'
import type { Metadata } from 'next'
import { ProblemDetailView } from '@/components/problems/problem-detail-view'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

type Props = { params: Promise<{ slug: string }> }

/**
 * The problem's own title, and the first sentence of its statement as the
 * description. The problem endpoint is public, so this needs no session. If the
 * API is unreachable the page still renders — only the tab title is generic.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  try {
    const response = await fetch(`${API_URL}/problems/${encodeURIComponent(slug)}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(3000),
    })
    if (!response.ok) return { title: 'Problem' }
    const problem = (await response.json()) as ProblemDetail
    return { title: problem.title, description: firstSentence(problem.statement) }
  } catch {
    return { title: 'Problem' }
  }
}

/** Plain text from the statement's markdown, cut at the first sentence or 160 characters. */
function firstSentence(markdown: string): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*_`>[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const end = text.search(/[.!?](\s|$)/)
  const sentence = end === -1 ? text : text.slice(0, end + 1)
  return sentence.length > 160 ? `${sentence.slice(0, 157).trimEnd()}…` : sentence
}

export default async function ProblemPage({ params }: Props) {
  const { slug } = await params
  return <ProblemDetailView slug={slug} />
}
