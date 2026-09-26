export interface PlaybackState {
  readonly index: number
  readonly isFirst: boolean
  readonly isLast: boolean
  next(): PlaybackState
  previous(): PlaybackState
  reset(): PlaybackState
  last(): PlaybackState
}

export function createPlayback(length: number, index = 0): PlaybackState {
  if (length < 1) {
    throw new Error('Playback requires at least one step.')
  }

  const bounded = Math.min(Math.max(index, 0), length - 1)
  return {
    index: bounded,
    isFirst: bounded === 0,
    isLast: bounded === length - 1,
    next: () => createPlayback(length, bounded + 1),
    previous: () => createPlayback(length, bounded - 1),
    reset: () => createPlayback(length, 0),
    last: () => createPlayback(length, length - 1),
  }
}