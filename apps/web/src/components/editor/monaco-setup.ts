import { loader } from '@monaco-editor/react'

/**
 * Monaco, configured to satisfy the CSP in docs/security.md.
 *
 * Two things are deliberate here.
 *
 * **It is loaded from our own bundle, not a CDN.** `@monaco-editor/react`
 * defaults to fetching Monaco from jsdelivr at runtime. That would mean
 * `script-src` has to name a third-party origin, and that the editor stops
 * working when someone else's CDN does.
 *
 * **Only the Monarch tokenizers are imported, never the language services.**
 * `basic-languages/*` is syntax highlighting and nothing else. The TypeScript
 * and JSON *services* — the parts that would pull in a worker doing dynamic
 * compilation — are never referenced, so nothing in the editor needs
 * `unsafe-eval`. We get colours, not IntelliSense, and colours are what a
 * submission box needs.
 */
let started: Promise<void> | null = null

export function setupMonaco(): Promise<void> {
  started ??= (async () => {
    const monaco = await import('monaco-editor/editor/editor.api')

    // Syntax only. Each import registers Monarch grammars — `cpp/register`
    // covers both C and C++. The language *services* under
    // `monaco-editor/languages/*`, which are what would need dynamic
    // compilation, are never imported.
    await Promise.all([
      import('monaco-editor/languages/definitions/cpp/register'),
      import('monaco-editor/languages/definitions/python/register'),
      import('monaco-editor/languages/definitions/javascript/register'),
    ])

    // Same-origin worker, compiled from `monaco.worker.ts` in this directory.
    // Monaco's own fallback builds one from a `blob:` URL, which the CSP
    // rejects.
    window.MonacoEnvironment = {
      getWorker: () =>
        new Worker(new URL('./monaco.worker.ts', import.meta.url), { type: 'module' }),
    }

    defineThemes(monaco)
    loader.config({ monaco })
    await loader.init()
  })()

  return started
}

type Monaco = typeof import('monaco-editor/editor/editor.api')

/**
 * Themes built from the app's own tokens rather than Monaco's defaults, so the
 * editor does not look like a different program embedded in the page.
 */
function defineThemes(monaco: Monaco): void {
  monaco.editor.defineTheme('guruji-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#0b0b0e',
      'editor.foreground': '#f2f2f4',
      'editorLineNumber.foreground': '#4a4a52',
      'editorLineNumber.activeForeground': '#9a9aa4',
      'editor.selectionBackground': '#8b5cf640',
      'editor.lineHighlightBackground': '#ffffff08',
      'editorCursor.foreground': '#8b5cf6',
      'editorIndentGuide.background1': '#ffffff10',
    },
  })

  monaco.editor.defineTheme('guruji-light', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#18181b',
      'editorLineNumber.foreground': '#a1a1aa',
      'editor.selectionBackground': '#7c3aed26',
      'editor.lineHighlightBackground': '#0000000a',
      'editorCursor.foreground': '#7c3aed',
    },
  })
}

declare global {
  interface Window {
    MonacoEnvironment?: { getWorker: () => Worker }
  }
}
