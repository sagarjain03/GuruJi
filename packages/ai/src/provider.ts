import Groq from 'groq-sdk'

export type ModelTier = 'FAST' | 'QUALITY'

export interface CompletionMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CompletionRequest {
  tier: ModelTier
  messages: CompletionMessage[]
}

export interface CompletionUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface CompletionResponse {
  content: string
  usage: CompletionUsage | null
}

export interface LLMProvider {
  complete(request: CompletionRequest): Promise<CompletionResponse>
  completeStructured<T>(request: CompletionRequest): Promise<T>
}

export async function completeStructuredWithRetry<T>(
  provider: LLMProvider,
  request: CompletionRequest,
  isValid: (value: unknown) => value is T,
  onUsage?: (usage: CompletionUsage | null) => void,
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await provider.complete(request)
      onUsage?.(response.usage)
      const value = JSON.parse(response.content) as unknown
      if (isValid(value)) {
        return value
      }
    } catch {
      // A malformed model response is retried once below.
    }
  }

  throw new Error('Structured response failed validation after one retry.')
}

export interface GroqProviderConfig {
  apiKey?: string
  fastModel: string
  qualityModel: string
}

interface ChatCompletionClient {
  chat: {
    completions: {
      create(request: {
        model: string
        messages: CompletionMessage[]
      }): Promise<{
        choices: Array<{ message: { content: string | null } }>
        usage?: {
          prompt_tokens?: number
          completion_tokens?: number
          total_tokens?: number
        } | null
      }>
    }
  }
}

export class GroqProvider implements LLMProvider {
  private readonly client: ChatCompletionClient

  constructor(
    private readonly config: GroqProviderConfig,
    client?: ChatCompletionClient,
  ) {
    if (client !== undefined) {
      this.client = client
      return
    }
    if (config.apiKey === undefined || config.apiKey.length === 0) {
      throw new Error('GROQ_API_KEY is required for the Groq provider.')
    }
    this.client = new Groq({ apiKey: config.apiKey }) as unknown as ChatCompletionClient
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const result = await this.client.chat.completions.create({
      model: this.modelFor(request.tier),
      messages: request.messages,
    })
    const content = result.choices[0]?.message.content
    if (content === null || content === undefined) {
      throw new Error('The Groq provider returned an empty response.')
    }

    const usage = result.usage
    return {
      content,
      usage:
        usage === null || usage === undefined
          ? null
          : {
              promptTokens: usage.prompt_tokens ?? 0,
              completionTokens: usage.completion_tokens ?? 0,
              totalTokens: usage.total_tokens ?? 0,
            },
    }
  }

  async completeStructured<T>(request: CompletionRequest): Promise<T> {
    const response = await this.complete(request)
    return JSON.parse(response.content) as T
  }

  private modelFor(tier: ModelTier): string {
    return tier === 'FAST' ? this.config.fastModel : this.config.qualityModel
  }
}
