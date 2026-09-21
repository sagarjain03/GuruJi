import { describe, expect, it, vi } from 'vitest'
import { GroqProvider, completeStructuredWithRetry } from './provider'

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

  it('retries one malformed structured response and returns the validated value', async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({ choices: [{ message: { content: '{"hint":}' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: '{"hint":"Use a map."}' } }] })
    const provider = new GroqProvider(
      { fastModel: 'fast-model', qualityModel: 'quality-model' },
      { chat: { completions: { create } } },
    )
    let totalTokens = 0

    const result = await completeStructuredWithRetry(
      provider,
      {
        tier: 'FAST',
        messages: [{ role: 'user', content: 'Give a hint.' }],
      },
      (value): value is { hint: string } =>
        typeof value === 'object' && value !== null && typeof (value as { hint?: unknown }).hint === 'string',
      (usage) => {
        totalTokens = usage?.totalTokens ?? 0
      },
    )

    expect(result).toEqual({ hint: 'Use a map.' })
    expect(create).toHaveBeenCalledTimes(2)
    expect(totalTokens).toBe(0)
  })

  it('fails after one retry when structured output remains invalid', async () => {
    const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: '{"wrong":true}' } }] })
    const provider = new GroqProvider(
      { fastModel: 'fast-model', qualityModel: 'quality-model' },
      { chat: { completions: { create } } },
    )

    await expect(
      completeStructuredWithRetry(
        provider,
        { tier: 'FAST', messages: [{ role: 'user', content: 'Give a hint.' }] },
        (value): value is { hint: string } =>
          typeof value === 'object' && value !== null && typeof (value as { hint?: unknown }).hint === 'string',
      ),
    ).rejects.toThrow('Structured response failed validation after one retry.')
    expect(create).toHaveBeenCalledTimes(2)
  })
})
