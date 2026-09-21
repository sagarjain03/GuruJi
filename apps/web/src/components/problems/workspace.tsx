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

/** Statement pane, as a percentage of the workspace width. */
const STATEMENT = { min: 20, max: 75, initial: 42 }
/** Test panel height in px, and the room the editor keeps above it. */
const TEST_MIN = 96
const EDITOR_MIN = 140

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

/**
 * Statement on the left, editor on the right, test cases underneath.
 *
 * Both splits are draggable because the right balance is personal and changes
 * with the task — reading a long statement wants one thing, staring at a
 * failing case wants another.
 */
export function Workspace({
  problem,
  statement,
}: {
  problem: ProblemDetail
  statement: React.ReactNode
}) {
  const profile = useSessionStore((state) => state.profile)
  const [language, setLanguage] = useState<Language>(profile?.preferredLanguage ?? 'CPP')
  const [leftPercent, setLeftPercent] = useState(STATEMENT.initial)
  const [testHeight, setTestHeight] = useState(256)
  // Bumped when the editor's content is replaced from outside, which remounts
  // it. See `editorKey` on CodeEditor for why that is not a `value` prop.
  const [contentVersion, setContentVersion] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const columnRef = useRef<HTMLDivElement | null>(null)

  const drafts = useDrafts(problem.slug, language, problem.starterCode)

  const dragStatement = useCallback((pointer: PointerEvent) => {
    const bounds = containerRef.current?.getBoundingClientRect()
    if (!bounds) {
      return
    }
    const percent = ((pointer.clientX - bounds.left) / bounds.width) * 100
    setLeftPercent(clamp(percent, STATEMENT.min, STATEMENT.max))
  }, [])

  // Measured from the bottom of the editor column rather than from where the
  // drag started: the panel then tracks the pointer exactly, instead of drifting
  // away from it once a clamp has been hit and released.
  const dragTests = useCallback((pointer: PointerEvent) => {
    const bounds = columnRef.current?.getBoundingClientRect()
    if (!bounds) {
      return
    }
    setTestHeight(clamp(bounds.bottom - pointer.clientY, TEST_MIN, bounds.height - EDITOR_MIN))
  }, [])

  const nudgeTests = useCallback((step: number) => {
    const height = columnRef.current?.getBoundingClientRect().height ?? 0
    setTestHeight((current) => clamp(current - step * 24, TEST_MIN, height - EDITOR_MIN))
  }, [])

  return (
    <div
      ref={containerRef}
      className="flex h-[calc(100svh-6.5rem)] min-h-[560px] flex-col lg:flex-row"
    >
      <div
        className="border-border min-w-0 overflow-y-auto border lg:border-r-0"
        style={{ flexBasis: `${String(leftPercent)}%` }}
      >
        <div className="p-5">{statement}</div>
      </div>

      <ResizeHandle
        axis="x"
        label="Resize the statement panel"
        value={leftPercent}
        min={STATEMENT.min}
        max={STATEMENT.max}
        onMove={dragStatement}
        onNudge={(step) => {
          setLeftPercent((p) => clamp(p + step * 2, STATEMENT.min, STATEMENT.max))
        }}
      />

      {/* `min-w-0` is load-bearing: without it the column refuses to shrink below
          Monaco's min-content width, and the statement split can be dragged
          narrower but never wider. */}
      <div ref={columnRef} className="border-border flex min-h-0 min-w-0 flex-1 flex-col border">
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

        <ResizeHandle
          axis="y"
          label="Resize the test panel"
          value={testHeight}
          min={TEST_MIN}
          max={2000}
          onMove={dragTests}
          onNudge={nudgeTests}
        />

        <TestPanel problem={problem} language={language} code={drafts.code} height={testHeight} />
      </div>
    </div>
  )
}

/**
 * A draggable divider.
 *
 * Visible at rest on purpose. The statement split was always draggable and its
 * handle was transparent, so the layout read as fixed and nobody dragged it.
 *
 * Keyboard users resize with the arrow keys; a drag-only handle is not
 * reachable without a pointer.
 */
function ResizeHandle({
  axis,
  label,
  value,
  min,
  max,
  onMove,
  onNudge,
}: {
  axis: 'x' | 'y'
  label: string
  value: number
  min: number
  max: number
  onMove: (pointer: PointerEvent) => void
  /** -1 towards the start of the axis, +1 towards the end. */
  onNudge: (step: number) => void
}) {
  const start = (event: React.PointerEvent<HTMLDivElement>): void => {
    event.preventDefault()

    const move = (pointer: PointerEvent): void => {
      onMove(pointer)
    }
    const stop = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    // The pointer spends the whole drag over Monaco, which would otherwise put
    // its own cursor back and select every line it passes over.
    document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  const back = axis === 'x' ? 'ArrowLeft' : 'ArrowUp'
  const forward = axis === 'x' ? 'ArrowRight' : 'ArrowDown'

  return (
    <div
      role="separator"
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={start}
      onKeyDown={(event) => {
        if (event.key !== back && event.key !== forward) {
          return
        }
        event.preventDefault()
        onNudge(event.key === back ? -1 : 1)
      }}
      className={cn(
        'group border-border bg-card/50 relative grid shrink-0 place-items-center outline-none',
        'hover:bg-primary/25 focus-visible:bg-primary/40 transition-colors',
        axis === 'x'
          ? 'hidden w-2 cursor-col-resize border-y lg:grid'
          : 'h-2 cursor-row-resize border-x',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'bg-muted-foreground/40 group-hover:bg-primary rounded-full transition-colors',
          axis === 'x' ? 'h-8 w-0.5' : 'h-0.5 w-8',
        )}
      />
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
  height,
}: {
  problem: ProblemDetail
  language: Language
  code: string
  height: number
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
    <div style={{ height }} className="border-border flex shrink-0 flex-col border-t">
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
            {option === 'samples'
              ? `Samples (${String(problem.sampleTestCases.length)})`
              : 'Result'}
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
