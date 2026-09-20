'use client'

import { Minus, Play, Plus, RotateCcw, Send } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import type { Language, ProblemDetail } from '@guruji/types'
import { CodeEditor } from '@/components/editor/code-editor'
import { useDrafts, type SaveStatus } from '@/components/editor/use-drafts'
import { ResultPanel } from '@/components/problems/result-panel'
import { useSubmission, type RunKind } from '@/components/problems/use-submission'
import { Button } from '@/components/ui/button'
import { EDITOR_LANGUAGES, LANGUAGE_LABEL, useEditorStore } from '@/stores/editor-store'
import { useSessionStore } from '@/stores/session-store'
import { cn } from '@/lib/utils'

const MIN_PANE = 25
const MAX_PANE = 70

/**
 * Statement on the left, editor on the right, test cases underneath.
 *
 * The split is draggable because the right balance is personal and changes with
 * the task — reading a long statement wants one thing, debugging an indexing
 * mistake wants another.
 */
export function Workspace({ problem, statement }: { problem: ProblemDetail; statement: React.ReactNode }) {
  const profile = useSessionStore((state) => state.profile)
  const [language, setLanguage] = useState<Language>(profile?.preferredLanguage ?? 'CPP')
  const [leftPercent, setLeftPercent] = useState(42)
  // Bumped when the editor's content is replaced from outside, which remounts
  // it. See `editorKey` on CodeEditor for why that is not a `value` prop.
  const [contentVersion, setContentVersion] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const drafts = useDrafts(problem.slug, language, problem.starterCode)

  const onDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container) {
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)

    const move = (pointer: PointerEvent): void => {
      const bounds = container.getBoundingClientRect()
      const percent = ((pointer.clientX - bounds.left) / bounds.width) * 100
      setLeftPercent(Math.min(Math.max(percent, MIN_PANE), MAX_PANE))
    }
    const stop = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }, [])

  return (
    <div
      ref={containerRef}
      className="flex h-[calc(100svh-6.5rem)] min-h-[560px] flex-col lg:flex-row"
    >
      <div
        className="border-border overflow-y-auto border lg:border-r-0"
        style={{ flexBasis: `${leftPercent}%` }}
      >
        <div className="p-5">{statement}</div>
      </div>

      {/* Keyboard users resize with the arrow keys; a drag-only handle is not
          reachable without a pointer. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the statement panel"
        tabIndex={0}
        onPointerDown={onDrag}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            setLeftPercent((p) => Math.max(p - 2, MIN_PANE))
          }
          if (event.key === 'ArrowRight') {
            setLeftPercent((p) => Math.min(p + 2, MAX_PANE))
          }
        }}
        className="border-border hover:bg-primary/40 focus-visible:bg-primary/60 hidden w-1.5 shrink-0 cursor-col-resize border-y bg-transparent lg:block"
      />

      <div className="border-border flex min-h-0 flex-1 flex-col border">
        <Toolbar
          language={language}
          onLanguage={setLanguage}
          status={drafts.status}
          onReset={() => {
            drafts.reset()
            setContentVersion((version) => version + 1)
          }}
        />

        <div className="min-h-0 flex-1">
          {drafts.isLoading ? null : (
            <CodeEditor
              language={language}
              editorKey={`${language}:${String(contentVersion)}`}
              initialValue={drafts.code}
              onChange={drafts.setCode}
            />
          )}
        </div>

        <TestPanel problem={problem} language={language} code={drafts.code} />
      </div>
    </div>
  )
}

function Toolbar({
  language,
  onLanguage,
  status,
  onReset,
}: {
  language: Language
  onLanguage: (language: Language) => void
  status: SaveStatus
  onReset: () => void
}) {
  const { fontSize, setFontSize, wordWrap, toggleWordWrap, minimap, toggleMinimap } =
    useEditorStore()

  return (
    <div className="border-border flex flex-wrap items-center gap-2 border-b p-2">
      <div className="flex">
        {EDITOR_LANGUAGES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={language === option}
            onClick={() => {
              onLanguage(option)
            }}
            className={cn(
              'border-border border px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] uppercase',
              'text-muted-foreground -ml-px first:ml-0',
              language === option && 'bg-primary text-primary-foreground border-primary',
            )}
          >
            {LANGUAGE_LABEL[option]}
          </button>
        ))}
      </div>

      <SaveIndicator status={status} />

      <div className="ml-auto flex items-center gap-1">
        <IconButton
          label="Smaller font"
          onClick={() => {
            setFontSize(fontSize - 1)
          }}
        >
          <Minus className="size-3" />
        </IconButton>
        <span className="text-muted-foreground w-8 text-center font-mono text-[10px]">
          {fontSize}px
        </span>
        <IconButton
          label="Larger font"
          onClick={() => {
            setFontSize(fontSize + 1)
          }}
        >
          <Plus className="size-3" />
        </IconButton>

        <Toggle label="Wrap" on={wordWrap} onClick={toggleWordWrap} />
        <Toggle label="Map" on={minimap} onClick={toggleMinimap} />

        <IconButton label="Reset to starter code" onClick={onReset}>
          <RotateCcw className="size-3" />
        </IconButton>
      </div>
    </div>
  )
}

const STATUS_LABEL: Record<SaveStatus, string> = {
  clean: '',
  pending: 'unsaved',
  saving: 'saving…',
  saved: 'saved',
  error: 'not saved',
}

/**
 * Autosave is invisible when it works, which is exactly when a user cannot tell
 * whether it works. The failure state says so plainly rather than staying quiet.
 */
function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'clean') {
    return null
  }
  return (
    <span
      role="status"
      className={cn(
        'font-mono text-[10px] tracking-[0.14em] uppercase',
        status === 'error' ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="border-border text-muted-foreground hover:text-foreground border p-1.5"
    >
      {children}
    </button>
  )
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'border-border text-muted-foreground border px-2 py-1 font-mono text-[10px] tracking-[0.14em] uppercase',
        on && 'text-foreground border-foreground/30',
      )}
    >
      {label}
    </button>
  )
}

/**
 * Sample cases, the verdict, and the two buttons that produce it.
 *
 * Run grades the samples; Submit grades everything. Which cases each one uses
 * is decided by the server from the problem's own rows — the client says which
 * of the two it wants and nothing more.
 */
function TestPanel({
  problem,
  language,
  code,
}: {
  problem: ProblemDetail
  language: Language
  code: string
}) {
  const [tab, setTab] = useState<'samples' | 'result'>('samples')
  const run = useSubmission(problem.id)

  /**
   * Pressing Run or Submit moves you to the Result tab.
   *
   * Done here, in the handler, rather than in an effect watching the status:
   * leaving the user on the samples tab means the answer they asked for lands
   * off-screen, and an effect that calls setState for it is a cascading render
   * for something a click already knew.
   */
  const startAndShow = (kind: RunKind): void => {
    run.start(kind, language, code)
    setTab('result')
  }

  return (
    <div className="border-border flex h-64 shrink-0 flex-col border-t">
      <div className="border-border flex flex-wrap items-center gap-2 border-b p-2">
        {(['samples', 'result'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={tab === option}
            onClick={() => {
              setTab(option)
            }}
            className={cn(
              'border-border text-muted-foreground border px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] uppercase',
              tab === option && 'text-foreground border-foreground/30',
            )}
          >
            {option === 'samples' ? `Samples (${String(problem.sampleTestCases.length)})` : 'Result'}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          {run.error !== null && (
            <span role="alert" className="text-destructive font-mono text-[10px]">
              {run.error}
            </span>
          )}

          <Button
            size="sm"
            variant="outline"
            disabled={run.isBusy}
            onClick={() => {
              startAndShow('run')
            }}
          >
            <Play className="size-3" />
            {run.isBusy && run.kind === 'run' ? 'Running…' : 'Run'}
          </Button>

          <Button
            size="sm"
            disabled={run.isBusy}
            onClick={() => {
              startAndShow('submit')
            }}
          >
            <Send className="size-3" />
            {run.isBusy && run.kind === 'submit' ? 'Judging…' : 'Submit'}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === 'samples' ? (
          <div className="flex flex-col gap-3">
            {problem.sampleTestCases.map((testCase, index) => (
              <div key={testCase.id} className="grid gap-2 sm:grid-cols-2">
                <Pane label={`Input ${String(index + 1)}`} value={testCase.input} />
                <Pane label={`Expected ${String(index + 1)}`} value={testCase.expectedOutput} />
              </div>
            ))}
          </div>
        ) : (
          <ResultPanel submission={run.submission} status={run.status} />
        )}
      </div>
    </div>
  )
}

function Pane({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
        {label}
      </p>
      <pre className="bg-muted mt-1 overflow-x-auto p-2 font-mono text-xs whitespace-pre-wrap">
        {value}
      </pre>
    </div>
  )
}
