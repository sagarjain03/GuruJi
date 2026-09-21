import { describe, expect, it, vi } from 'vitest'
import { GroqProvider } from './provider'

describe('GroqProvider', () => {
  it('uses the configured model for the requested tier', async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: 'Think about the invariant.' } }],
      usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 },
    })
    const provider = new GroqProvider(
      {
        fastModel: 'fast-model',
        qualityModel: 'quality-model',
      },
      { chat: { completions: { create } } },
    )

    const response = await provider.complete({
      tier: 'QUALITY',
      messages: [{ role: 'user', content: 'Help me reason about this.' }],
    })

    expect(create).toHaveBeenCalledWith({
      model: 'quality-model',
      messages: [{ role: 'user', content: 'Help me reason about this.' }],
    })
    expect(response).toEqual({
      content: 'Think about the invariant.',
      usage: { promptTokens: 12, completionTokens: 7, totalTokens: 19 },
    })
  })
})
