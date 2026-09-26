import { algorithmRegistry } from '@guruji/algorithms'
import { create } from 'zustand'

const FIRST = algorithmRegistry[0]

export const SPEEDS = [0.5, 1, 1.5, 2, 4] as const

interface VisualizerState {
  algorithmId: string
  /** The input the current step stream was generated from — not the draft in the box. */
  input: string
  stepIndex: number
  playing: boolean
  speed: number
  selectAlgorithm: (id: string, defaultInput: string) => void
  applyInput: (input: string) => void
  /** Clamped by the caller, which is the only one that knows the stream length. */
  goTo: (index: number) => void
  advance: (lastIndex: number) => void
  setPlaying: (playing: boolean) => void
  setSpeed: (speed: number) => void
}

/**
 * The visualiser's playback state. Pure UI state, so Zustand rather than
 * TanStack Query; the step stream itself is derived, memoised against
 * `(algorithmId, input)`, and never stored here — changing the speed must not
 * regenerate it.
 */
export const useVisualizerStore = create<VisualizerState>((set) => ({
  algorithmId: FIRST?.id ?? '',
  input: FIRST?.defaultInput ?? '',
  stepIndex: 0,
  playing: false,
  speed: 1,
  selectAlgorithm: (algorithmId, defaultInput) =>
    set({ algorithmId, input: defaultInput, stepIndex: 0, playing: false }),
  applyInput: (input) => set({ input, stepIndex: 0, playing: false }),
  goTo: (stepIndex) => set({ stepIndex, playing: false }),
  advance: (lastIndex) =>
    set((state) =>
      state.stepIndex >= lastIndex ? { playing: false } : { stepIndex: state.stepIndex + 1 },
    ),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
}))
