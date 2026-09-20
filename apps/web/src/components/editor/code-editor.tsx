'use client'

import Editor from '@monaco-editor/react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import type { Language } from '@guruji/types'
import { LoadingState } from '@/components/content/states'
import { MONACO_LANGUAGE, useEditorStore } from '@/stores/editor-store'
import { setupMonaco } from './monaco-setup'

interface CodeEditorProps {
  language: Language
  /** Read once per mount. See the note on `editorKey`. */
  initialValue: string
  /**
   * Remount the editor when this changes.
   *
   * Monaco is deliberately **uncontrolled**. Passing `value` on every render
   * makes `@monaco-editor/react` push the string back into the model each time
   * the parent re-renders — which, with a parent that re-renders on every
   * keystroke, races the person typing and drops characters. `int cpp_marker = 1;`
   * arrives as `int r = 1;`.
   *
   * So the content is set once per mount, and anything that legitimately
   * replaces it from outside — switching language, resetting to starter code —
   * changes this key instead.
   */
  editorKey: string
  onChange: (value: string) => void
}

/**
 * The editor itself. Everything about *what* is being edited lives in the
 * workspace above it — this component knows a language, a string, and how to
 * report a change.
 */
export function CodeEditor({ language, initialValue, editorKey, onChange }: CodeEditorProps) {
  const [ready, setReady] = useState(false)
  const { resolvedTheme } = useTheme()
  const fontSize = useEditorStore((state) => state.fontSize)
  const tabSize = useEditorStore((state) => state.tabSize)
  const wordWrap = useEditorStore((state) => state.wordWrap)
  const minimap = useEditorStore((state) => state.minimap)

  useEffect(() => {
    let cancelled = false
    void setupMonaco().then(() => {
      if (!cancelled) {
        setReady(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!ready) {
    return <LoadingState label="Loading the editor…" />
  }

  return (
    <Editor
      key={editorKey}
      height="100%"
      language={MONACO_LANGUAGE[language]}
      defaultValue={initialValue}
      theme={resolvedTheme === 'light' ? 'guruji-light' : 'guruji-dark'}
      onChange={(next) => {
        onChange(next ?? '')
      }}
      loading={<LoadingState label="Loading the editor…" />}
      options={{
        fontSize,
        tabSize,
        wordWrap: wordWrap ? 'on' : 'off',
        minimap: { enabled: minimap },
        fontFamily: 'var(--font-mono)',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        renderLineHighlight: 'line',
        smoothScrolling: true,
        padding: { top: 12, bottom: 12 },
        // Nothing here needs a language service, and asking for suggestions
        // Monaco cannot compute just renders an empty popup over the code.
        quickSuggestions: false,
        suggestOnTriggerCharacters: false,
        parameterHints: { enabled: false },
        occurrencesHighlight: 'off',
        codeLens: false,
      }}
    />
  )
}
