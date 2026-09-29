import { toHistoryEntry } from './history'

const base = {
  id: 'm1',
  createdAt: new Date('2026-09-29T10:00:00.000Z'),
  hintLevel: null,
  conversation: { problem: { slug: 'pair-sums-to-target', title: 'Pair Sums to Target' } },
}

describe('toHistoryEntry', () => {
  it('keeps a hint as one section, with its level', () => {
    expect(toHistoryEntry({ ...base, mode: 'HINT', hintLevel: 2, content: 'Think about a hash map.' })).toEqual({
      id: 'm1',
      mode: 'HINT',
      createdAt: '2026-09-29T10:00:00.000Z',
      problem: { slug: 'pair-sums-to-target', title: 'Pair Sums to Target' },
      hintLevel: 2,
      sections: [{ title: 'Hint', text: 'Think about a hash map.' }],
      code: null,
    })
  })

  it('splits an explanation into the panel’s labelled parts', () => {
    const content = JSON.stringify({
      intuition: 'Remember what you have seen.',
      example: '[2, 7] with target 9.',
      implementation: 'One pass with a map.',
      complexity: 'O(n) time.',
      commonMistakes: ['Pairing an element with itself.', 'Zero-based output.'],
    })
    expect(toHistoryEntry({ ...base, mode: 'EXPLAIN', content }).sections).toEqual([
      { title: 'Intuition', text: 'Remember what you have seen.' },
      { title: 'Example', text: '[2, 7] with target 9.' },
      { title: 'Implementation', text: 'One pass with a map.' },
      { title: 'Complexity', text: 'O(n) time.' },
      { title: 'Common mistakes', text: 'Pairing an element with itself. Zero-based output.' },
    ])
  })

  it('reads a code analysis, joining its issues and suggestions', () => {
    const content = JSON.stringify({
      correctness: 'incorrect',
      issues: [{ severity: 'error', description: 'Reads no input.' }],
      timeComplexity: 'O(1)',
      spaceComplexity: 'O(1)',
      suggestions: ['Read n first.', 'Use a map.'],
      concepts: ['hashing'],
    })
    expect(toHistoryEntry({ ...base, mode: 'ANALYZE_CODE', content }).sections).toEqual([
      { title: 'Correctness', text: 'incorrect' },
      { title: 'Complexity', text: 'O(1) time, O(1) space' },
      { title: 'Issues', text: 'Reads no input.' },
      { title: 'Suggestions', text: 'Read n first. Use a map.' },
    ])
  })

  it('keeps a revealed solution’s code apart from its prose', () => {
    const content = JSON.stringify({ approach: 'Hash map.', code: 'print(1)', complexity: 'O(n)' })
    const entry = toHistoryEntry({ ...base, mode: 'SHOW_SOLUTION', content })
    expect(entry.sections).toEqual([
      { title: 'Approach', text: 'Hash map.' },
      { title: 'Complexity', text: 'O(n)' },
    ])
    expect(entry.code).toBe('print(1)')
  })

  it('drops the markdown fence a model wraps around solution code', () => {
    const content = JSON.stringify({ approach: 'a', code: '```python\nprint(1)\n```', complexity: 'b' })
    expect(toHistoryEntry({ ...base, mode: 'SHOW_SOLUTION', content }).code).toBe('print(1)')
  })

  it('explains a wrong answer in three parts', () => {
    const content = JSON.stringify({ whatHappened: 'Printed a constant.', why: 'No input read.', missingConcept: 'I/O.' })
    expect(toHistoryEntry({ ...base, mode: 'EXPLAIN_WRONG_ANSWER', content }).sections).toEqual([
      { title: 'What happened', text: 'Printed a constant.' },
      { title: 'Why', text: 'No input read.' },
      { title: 'Missing concept', text: 'I/O.' },
    ])
  })

  it('shows stored text as-is when it is not the JSON it should be', () => {
    // Rows written before the schema was enforced must still render, not crash the page.
    expect(toHistoryEntry({ ...base, mode: 'EXPLAIN', content: 'plain words' }).sections).toEqual([
      { title: 'Answer', text: 'plain words' },
    ])
  })

  it('has no problem when the problem is gone', () => {
    const entry = toHistoryEntry({ ...base, mode: 'HINT', hintLevel: 1, content: 'x', conversation: { problem: null } })
    expect(entry.problem).toBeNull()
  })
})
