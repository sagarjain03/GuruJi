import { describe, expect, it } from 'vitest'
import {
  codeAnalysisSchema,
  generatedProblemSchema,
  hintSchema,
  validateGeneratedReference,
  wrongAnswerSchema,
} from './schemas'

describe('AI response schemas', () => {
  it('accepts a teaching hint and rejects a solution-shaped response', () => {
    expect(hintSchema.safeParse({ hint: 'What invariant holds after each step?' }).success).toBe(true)
    expect(hintSchema.safeParse({ hint: 'Here is the complete solution: ...' }).success).toBe(false)
  })

  it('validates structured code analysis and wrong-answer explanations', () => {
    expect(
      codeAnalysisSchema.safeParse({
        correctness: 'partially-correct',
        issues: [{ severity: 'warning', line: 4, description: 'The loop repeats work.' }],
        timeComplexity: 'O(n^2)',
        spaceComplexity: 'O(1)',
        suggestions: ['Look for a way to reuse prior results.'],
        concepts: ['hashing'],
      }).success,
    ).toBe(true)
    expect(
      wrongAnswerSchema.safeParse({
        whatHappened: 'The final case is counted twice.',
        why: 'The boundary is inclusive on both sides.',
        divergenceLine: 8,
        missingConcept: 'half-open ranges',
      }).success,
    ).toBe(true)
  })

  it('rejects a generated problem when its reference solution fails a test case', async () => {
    const generated = generatedProblemSchema.parse({
      slug: 'generated-pairs',
      title: 'Generated Pairs',
      difficulty: 'EASY',
      statement: 'Find a pair.',
      constraints: 'Small input.',
      examples: [],
      starterCode: { CPP: '' },
      referenceSolution: 'reference',
      testCases: [{ input: '1 2', expectedOutput: '3' }],
      hints: ['Think about the target.', 'Track what you saw.'],
    })

    await expect(
      validateGeneratedReference(generated, async () => ({ output: '4', passed: false })),
    ).rejects.toThrow('Generated reference solution failed test case 1.')
  })
})