import type { Language } from '@guruji/types'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const EDITOR_LANGUAGES: Language[] = ['CPP', 'C', 'PYTHON', 'JAVASCRIPT']

export const LANGUAGE_LABEL: Record<Language, string> = {
  CPP: 'C++',
  C: 'C',
  PYTHON: 'Python',
  JAVASCRIPT: 'JavaScript',
}

/** Monaco's own language ids. `cpp/register` registers both `cpp` and `c`. */
export const MONACO_LANGUAGE: Record<Language, string> = {
  CPP: 'cpp',
  C: 'c',
  PYTHON: 'python',
  JAVASCRIPT: 'javascript',
}

interface EditorPreferences {
  fontSize: number
  tabSize: number
  wordWrap: boolean
  minimap: boolean
  setFontSize: (size: number) => void
  setTabSize: (size: number) => void
  toggleWordWrap: () => void
  toggleMinimap: () => void
}

/**
 * How the editor looks, not what is in it.
 *
 * Persisted to localStorage rather than to the server: these are per-device
 * preferences — the font size that suits a laptop is not the one that suits an
 * external monitor — and they are worth nothing to anyone else. Draft *code*
 * goes to the server, because losing that matters.
 */
export const useEditorStore = create<EditorPreferences>()(
  persist(
    (set) => ({
      fontSize: 14,
      tabSize: 4,
      wordWrap: false,
      minimap: false,
      setFontSize: (fontSize) => set({ fontSize: clamp(fontSize, 10, 24) }),
      setTabSize: (tabSize) => set({ tabSize: clamp(tabSize, 2, 8) }),
      toggleWordWrap: () => set((state) => ({ wordWrap: !state.wordWrap })),
      toggleMinimap: () => set((state) => ({ minimap: !state.minimap })),
    }),
    {
      name: 'guruji.editor',
      // Only the values. Persisting the setters would store functions, which
      // JSON drops, and the rehydrated store would then have none.
      partialize: (state) => ({
        fontSize: state.fontSize,
        tabSize: state.tabSize,
        wordWrap: state.wordWrap,
        minimap: state.minimap,
      }),
    },
  ),
)

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high)
}
