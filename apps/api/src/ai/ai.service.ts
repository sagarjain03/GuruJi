import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common'
import {
  assembleMentorPrompt,
  codeAnalysisSchema,
  completeStructuredWithRetry,
  explanationSchema,
  generatedProblemSchema,
  hintSchema,
  solutionSchema,
  validateGeneratedReference,
  wrongAnswerSchema,
  type CodeAnalysisResponse,
  type ExplanationResponse,
  type GeneratedProblem,
  type HintResponse,
  type SolutionResponse,
  type LLMProvider,
  type CompletionUsage,
  type WrongAnswerResponse,
} from '@guruji/ai'
import { prisma } from '@guruji/database'
import type Redis from 'ioredis'
import { NotFoundError } from '../common/app-error'
import { ProblemRepository } from '../content/problem.repository'
import { HintDto } from './dto/hint.dto'
import { AnalyzeCodeDto, ExplainDto, ExplainWrongAnswerDto } from './dto/mentor.dto'
import { GenerateProblemDto } from './dto/generate-problem.dto'
import { REDIS } from '../redis/redis.module'

export const AI_PROVIDER = Symbol('AI_PROVIDER')
export const AI_REFERENCE_EXECUTOR = Symbol('AI_REFERENCE_EXECUTOR')

export interface ReferenceExecutor {
  execute(referenceSolution: string, input: string): Promise<{ output: string; passed: boolean }>
}

@Injectable()
export class AIService {
  constructor(
    private readonly problems: ProblemRepository,
    @Inject(AI_PROVIDER) private readonly provider: LLMProvider,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(AI_REFERENCE_EXECUTOR) private readonly referenceExecutor: ReferenceExecutor,
  ) {}

  async hint(userId: string, request: HintDto): Promise<{ hint: string; level: number; curated: boolean }> {
    await this.guardQuota(userId)
    const problem = await this.problems.findBySlug(request.problemSlug)
    if (problem === null) {
      throw new NotFoundError('PROBLEM_NOT_FOUND', 'That problem does not exist.')
    }

    const conversation = await prisma.aIConversation.create({
      data: { userId, problemId: problem.id, mode: 'HINT' },
    })

    const curated = await this.problems.findHint(request.problemSlug, request.level)
    if (curated !== null) {
      await prisma.aIMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'ASSISTANT',
          mode: 'HINT',
          content: curated.content,
          hintLevel: request.level,
        },
      })
      return { hint: curated.content, level: request.level, curated: true }
    }

    const usage: { value: CompletionUsage | null } = { value: null }
    try {
      const response = await completeStructuredWithRetry(
        this.provider,
        {
          tier: 'FAST',
          messages: assembleMentorPrompt({
            developer: `Give only a level ${request.level} hint. Do not provide code or a complete solution. Return JSON with one string field named hint.`,
            context: `${problem.title}\n${problem.statement}\nConstraints: ${problem.constraints}`,
            user: request.message ?? `I need a level ${request.level} hint for ${problem.title}.`,
          }),
        },
        (value): value is HintResponse => hintSchema.safeParse(value).success,
        (value) => {
          usage.value = value
        },
      )
      await this.recordUsage(userId, usage.value?.totalTokens ?? 0)

      await prisma.aIMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'ASSISTANT',
          mode: 'HINT',
          content: response.hint,
          hintLevel: request.level,
          promptTokens: usage.value?.promptTokens ?? null,
          completionTokens: usage.value?.completionTokens ?? null,
          totalTokens: usage.value?.totalTokens ?? null,
        },
      })
      return { hint: response.hint, level: request.level, curated: false }
    } catch {
      await prisma.aIMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'ASSISTANT',
          mode: 'HINT',
          content: 'AI provider unavailable.',
          hintLevel: request.level,
        },
      })
      throw new ServiceUnavailableException('The mentor is temporarily unavailable.')
    }
  }

  async explain(userId: string, request: ExplainDto): Promise<ExplanationResponse> {
    await this.guardQuota(userId)
    const problem = await this.problem(request.problemSlug)
    return this.complete(userId, problem.id, 'EXPLAIN', explanationSchema, {
      tier: 'QUALITY',
      messages: assembleMentorPrompt({
        developer: 'Explain intuition, a small worked example, implementation ideas, complexity, and common mistakes. Return JSON matching the schema. Do not dump a complete answer.',
        context: `${problem.title}\n${problem.statement}\n${problem.constraints}`,
        user: request.question ?? 'Explain this concept so a beginner can reason about it.',
      }),
    })
  }

  async analyzeCode(userId: string, request: AnalyzeCodeDto): Promise<CodeAnalysisResponse> {
    await this.guardQuota(userId)
    const problem = await this.problem(request.problemSlug)
    return this.complete(userId, problem.id, 'ANALYZE_CODE', codeAnalysisSchema, {
      tier: 'QUALITY',
      messages: assembleMentorPrompt({
        developer: 'Analyze correctness and complexity. Give directional suggestions only; never provide replacement code. Return JSON matching the schema.',
        context: `${problem.title}\n${problem.statement}\n${problem.constraints}`,
        user: `Code to analyze:\n${request.code}`,
      }),
    })
  }

  async explainWrongAnswer(userId: string, request: ExplainWrongAnswerDto): Promise<WrongAnswerResponse> {
    await this.guardQuota(userId)
    const problem = await this.problem(request.problemSlug)
    return this.complete(userId, problem.id, 'EXPLAIN_WRONG_ANSWER', wrongAnswerSchema, {
      tier: 'QUALITY',
      messages: assembleMentorPrompt({
        developer: 'Explain what happened and where the logic diverged. Stop before giving the correction or replacement code. Return JSON matching the schema.',
        context: `${problem.title}\n${problem.statement}\n${problem.constraints}`,
        user: `Code:\n${request.code}\nFailed input:\n${request.failedInput}\nExpected:\n${request.expectedOutput}\nActual:\n${request.actualOutput}`,
      }),
    })
  }

  async showSolution(userId: string, request: ExplainDto): Promise<SolutionResponse> {
    await this.guardQuota(userId)
    const problem = await this.problem(request.problemSlug)
    return this.complete(userId, problem.id, 'SHOW_SOLUTION', solutionSchema, {
      tier: 'QUALITY',
      messages: assembleMentorPrompt({
        developer: 'The user explicitly requested the solution. Return the correct approach, complete code, and complexity as JSON matching the schema. This is a separate deliberate action, not a hint.',
        context: `${problem.title}\n${problem.statement}\n${problem.constraints}`,
        user: request.question ?? 'Show the complete solution now.',
      }),
    })
  }

  async generateProblem(userId: string, request: GenerateProblemDto): Promise<{ id: string; reviewStatus: 'IN_REVIEW' }> {
    await this.guardQuota(userId)
    const generated = await completeStructuredWithRetry<GeneratedProblem>(
      this.provider,
      {
        tier: 'QUALITY',
        messages: assembleMentorPrompt({
          developer: 'Generate one original programming problem. Return JSON matching the generated problem schema. Include a correct reference solution and tests. Never include secrets or external copyrighted text.',
          context: 'The generated problem will be manually reviewed. It must remain IN_REVIEW and must never be published automatically.',
          user: request.brief,
        }),
      },
      (value): value is GeneratedProblem => generatedProblemSchema.safeParse(value).success,
    )

    try {
      await validateGeneratedReference(generated, (referenceSolution, input) =>
        this.referenceExecutor.execute(referenceSolution, input),
      )
    } catch {
      throw new ServiceUnavailableException('The reference validator is unavailable or rejected the generated problem.')
    }

    const problem = await prisma.problem.create({
      data: {
        slug: generated.slug,
        title: generated.title,
        difficulty: generated.difficulty,
        statement: generated.statement,
        constraints: generated.constraints,
        examples: generated.examples,
        starterCode: generated.starterCode,
        timeLimitMs: 1000,
        memoryLimitMb: 256,
        estimatedMinutes: 20,
        source: 'AI_GENERATED',
        aiGenerated: true,
        reviewStatus: 'IN_REVIEW',
        hints: { create: generated.hints.map((content, index) => ({ level: index + 1, content })) },
        testCases: {
          create: generated.testCases.map((testCase, index) => ({
            input: testCase.input,
            expectedOutput: testCase.expectedOutput,
            isSample: index === 0,
            isHidden: index !== 0,
            displayOrder: index,
          })),
        },
      },
      select: { id: true },
    })

    return { id: problem.id, reviewStatus: 'IN_REVIEW' }
  }

  private async problem(slug: string) {
    const problem = await this.problems.findBySlug(slug)
    if (problem === null) {
      throw new NotFoundError('PROBLEM_NOT_FOUND', 'That problem does not exist.')
    }
    return problem
  }

  private async complete<T extends object>(
    userId: string,
    problemId: string,
    mode: 'EXPLAIN' | 'ANALYZE_CODE' | 'EXPLAIN_WRONG_ANSWER' | 'SHOW_SOLUTION',
    schema: { safeParse(value: unknown): { success: boolean } },
    request: Parameters<LLMProvider['complete']>[0],
  ): Promise<T> {
    const conversation = await prisma.aIConversation.create({ data: { userId, problemId, mode } })
    const usage: { value: CompletionUsage | null } = { value: null }
    try {
      const value = await completeStructuredWithRetry(
        this.provider,
        request,
        (candidate): candidate is T => schema.safeParse(candidate).success,
        (responseUsage) => {
          usage.value = responseUsage
        },
      )
      await this.recordUsage(userId, usage.value?.totalTokens ?? 0)
      await prisma.aIMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'ASSISTANT',
          mode,
          content: JSON.stringify(value),
          promptTokens: usage.value?.promptTokens ?? null,
          completionTokens: usage.value?.completionTokens ?? null,
          totalTokens: usage.value?.totalTokens ?? null,
        },
      })
      return value
    } catch {
      throw new ServiceUnavailableException('The mentor is temporarily unavailable.')
    }
  }

  private async guardQuota(userId: string): Promise<void> {
    const minuteKey = `ai:rate:${userId}:${Math.floor(Date.now() / 60000)}`
    const [requests] = await Promise.all([this.redis.incr(minuteKey)])
    if (requests === 1) await this.redis.expire(minuteKey, 60)
    const dailyKey = `ai:tokens:${userId}:${new Date().toISOString().slice(0, 10)}`
    const tokens = await this.redis.get(dailyKey)
    if (requests > 20 || Number(tokens ?? 0) > 100000) {
      throw new ServiceUnavailableException('The mentor usage limit has been reached. Try again later.')
    }
  }

  private async recordUsage(userId: string, tokens: number): Promise<void> {
    if (tokens <= 0) return
    const dailyKey = `ai:tokens:${userId}:${new Date().toISOString().slice(0, 10)}`
    const total = await this.redis.incrby(dailyKey, tokens)
    if (total === tokens) await this.redis.expire(dailyKey, 86400)
    if (total > 100000) {
      throw new ServiceUnavailableException('The mentor usage limit has been reached. Try again later.')
    }
  }
}