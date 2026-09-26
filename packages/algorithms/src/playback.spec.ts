import { describe, expect, it } from 'vitest'
import { createPlayback } from './playback'

describe('playback state', () => {
  it('moves exactly one event at a time in both directions', () => {
    const playback = createPlayback(4)

    expect(playback.index).toBe(0)
    let current = playback.next()
    expect(current.index).toBe(1)
    current = current.next()
    expect(current.index).toBe(2)
    current = current.previous()
    expect(current.index).toBe(1)
    current = current.previous()
    expect(current.index).toBe(0)
    expect(current.previous().index).toBe(0)
    current = current.last()
    expect(current.index).toBe(3)
    expect(current.next().index).toBe(3)
    expect(current.reset().index).toBe(0)
  })

  it('rejects an empty event stream', () => {
    expect(() => createPlayback(0)).toThrow('Playback requires at least one step.')
  })
})