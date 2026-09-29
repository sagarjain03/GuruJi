import type { MentorHistoryEntry, MentorHistoryMode, MentorHistorySection } from '@guruji/types'

/** One stored mentor answer, as the history query selects it. */
export interface HistoryRow {
  id: string
  mode: MentorHistoryMode
  content: string
  hintLevel: number | null
  createdAt: Date
  conversation: { problem: { slug: string; title: string } | null }
}

type Json = Record<string, unknown>

const text = (value: unknown): string =>
  Array.isArray(value) ? value.map(text).join(' ') : typeof value === 'string' ? value : ''

/**
 * The labelled parts of each structured answer, in the order the mentor panel
 * shows them, so the history reads the same as the moment it was given.
 */
const SECTIONS: Record<Exclude<MentorHistoryMode, 'HINT'>, (value: Json) => MentorHistorySection[]> = {
  EXPLAIN: (value) => [
    { title: 'Intuition', text: text(value.intuition) },
    { title: 'Example', text: text(value.example) },
    { title: 'Implementation', text: text(value.implementation) },
    { title: 'Complexity', text: text(value.complexity) },
    { title: 'Common mistakes', text: text(value.commonMistakes) },
  ],
  ANALYZE_CODE: (value) => [
    { title: 'Correctness', text: text(value.correctness) },
    { title: 'Complexity', text: `${text(value.timeComplexity)} time, ${text(value.spaceComplexity)} space` },
    {
      title: 'Issues',
      text: Array.isArray(value.issues) ? value.issues.map((issue: Json) => text(issue.description)).join(' ') : '',
    },
    { title: 'Suggestions', text: text(value.suggestions) },
  ],
  EXPLAIN_WRONG_ANSWER: (value) => [
    { title: 'What happened', text: text(value.whatHappened) },
    { title: 'Why', text: text(value.why) },
    { title: 'Missing concept', text: text(value.missingConcept) },
  ],
  SHOW_SOLUTION: (value) => [
    { title: 'Approach', text: text(value.approach) },
    { title: 'Complexity', text: text(value.complexity) },
  ],
}

/** Models often wrap code in a ```lang fence; the page shows code, not markdown. */
const unfence = (code: string): string => code.replace(/^\s*```[\w+-]*\s*\n([\s\S]*?)\n?\s*```\s*$/, '$1')

function parse(content: string): Json | null {
  try {
    const value: unknown = JSON.parse(content)
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : null
  } catch {
    return null
  }
}

export function toHistoryEntry(row: HistoryRow): MentorHistoryEntry {
  const base = {
    id: row.id,
    mode: row.mode,
    createdAt: row.createdAt.toISOString(),
    problem: row.conversation.problem,
    hintLevel: row.hintLevel,
  }

  if (row.mode === 'HINT') {
    return { ...base, sections: [{ title: 'Hint', text: row.content }], code: null }
  }

  const value = parse(row.content)
  if (value === null) {
    // Rows from before the schema was enforced still render rather than failing the page.
    return { ...base, sections: [{ title: 'Answer', text: row.content }], code: null }
  }

  return {
    ...base,
    sections: SECTIONS[row.mode](value).filter((section) => section.text.trim().length > 0),
    code: row.mode === 'SHOW_SOLUTION' ? unfence(text(value.code)) || null : null,
  }
}
