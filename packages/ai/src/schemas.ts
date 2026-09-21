import { z } from 'zod'

const hintText = z
  .string()
  .min(1)
  .refine((value) => !/\b(full solution|complete solution|here is the code)\b/i.test(value), {
    message: 'Hints must not disclose a complete solution.',
  })

export const hintSchema = z.object({ hint: hintText })

export const codeAnalysisSchema = z.object({
  correctness: z.enum(['correct', 'incorrect', 'partially-correct']),
  issues: z.array(
    z.object({
      severity: z.enum(['error', 'warning', 'info']),
      line: z.number().int().positive().optional(),
      description: z.string().min(1),
    }),
  ),
  timeComplexity: z.string().min(1),
  spaceComplexity: z.string().min(1),
  suggestions: z.array(z.string().min(1)),
  concepts: z.array(z.string().min(1)),
})

export const wrongAnswerSchema = z.object({
  whatHappened: z.string().min(1),
  why: z.string().min(1),
  divergenceLine: z.number().int().positive().optional(),
  missingConcept: z.string().min(1),
})

export const generatedProblemSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1).max(200),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  statement: z.string().min(1),
  constraints: z.string().min(1),
  examples: z.array(z.object({ input: z.string(), output: z.string(), explanation: z.string().nullable().optional() })),
  starterCode: z.record(z.string(), z.string()),
  referenceSolution: z.string().min(1),
  testCases: z.array(z.object({ input: z.string(), expectedOutput: z.string() })).min(1),
  hints: z.array(z.string().min(1)).min(1).max(4),
})

export type GeneratedProblem = z.infer<typeof generatedProblemSchema>

export async function validateGeneratedReference(
  problem: GeneratedProblem,
  execute: (referenceSolution: string, input: string) => Promise<{ output: string; passed: boolean }>,
): Promise<void> {
  for (const [index, testCase] of problem.testCases.entries()) {
    const result = await execute(problem.referenceSolution, testCase.input)
    if (!result.passed || result.output.trim() !== testCase.expectedOutput.trim()) {
      throw new Error(`Generated reference solution failed test case ${index + 1}.`)
    }
  }
}

export const explanationSchema = z.object({
  intuition: z.string().min(1),
  example: z.string().min(1),
  implementation: z.string().min(1),
  complexity: z.string().min(1),
  commonMistakes: z.array(z.string().min(1)),
})

export type HintResponse = z.infer<typeof hintSchema>
export type CodeAnalysisResponse = z.infer<typeof codeAnalysisSchema>
export type WrongAnswerResponse = z.infer<typeof wrongAnswerSchema>
export type ExplanationResponse = z.infer<typeof explanationSchema>