'use client'

import { useMutation } from '@tanstack/react-query'
import { Check, Copy, GripHorizontal, Lightbulb, Loader2, Maximize2, MessageCircle, Minimize2, X } from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { toast } from 'sonner'
import { aiApi, type MentorAnalysis, type MentorExplanation, type MentorSolution } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Callout,
  ComplexityScale,
  ExampleCard,
  HintLadder,
  MentorLabel,
  RichText,
  sentences,
  StepFlow,
  WarningCards,
} from './mentor-visuals'

const MAX_HINT_LEVEL = 4

/** The floating window's width in px, and the gap it keeps from the viewport edge. */
const WINDOW_WIDTH = 720
const EDGE = 12

type Tab = 'hint' | 'concept' | 'analysis' | 'solution'

const TAB_LABEL: Record<Tab, string> = {
  hint: 'Hints',
  concept: 'Concept',
  analysis: 'Analysis',
  solution: 'Solution',
}

const TAB_ORDER: Tab[] = ['hint', 'concept', 'analysis', 'solution']

/**
 * Alt + a digit, read from `event.code` so it is the same key on every layout
 * (macOS turns Alt+1 into `¡` in `event.key`). Alt rather than Ctrl because
 * Ctrl+digit switches browser tabs, and Alt+letter opens the browser menu on
 * Windows.
 */
const SHORTCUT: Record<string, Tab | 'toggle'> = {
  Digit1: 'hint',
  Digit2: 'concept',
  Digit3: 'analysis',
  Digit4: 'solution',
  Digit0: 'toggle',
}

interface Point {
  x: number
  y: number
}

/**
 * Answers open in a floating window, not under the buttons.
 *
 * Inline, four answers stacked below the test panel pushed the whole workspace
 * into a page scroll, and reading one meant losing sight of the code it was
 * about. The window floats over the editor, can be dragged out of the way, and
 * keeps every answer in its own tab — nothing is replaced, nothing is lost.
 */
export function MentorPanel({ problemSlug, code }: { problemSlug: string; code: string }) {
  const storageKey = `guruji:mentor-level:${problemSlug}`
  const [level, setLevel] = useState(() => {
    if (typeof window === 'undefined') {
      return 1
    }
    const saved = Number(window.localStorage.getItem(storageKey))
    return Number.isInteger(saved) && saved >= 1 && saved <= MAX_HINT_LEVEL ? saved : 1
  })
  const [message, setMessage] = useState('')
  // Every hint so far, oldest first: level 3 builds on level 2, so 2 stays readable.
  const [hints, setHints] = useState<{ level: number; text: string }[]>([])
  const [explanation, setExplanation] = useState<MentorExplanation | null>(null)
  const [analysis, setAnalysis] = useState<MentorAnalysis | null>(null)
  const [solution, setSolution] = useState<MentorSolution | null>(null)
  const [confirmSolution, setConfirmSolution] = useState(false)
  const [tab, setTab] = useState<Tab | null>(null)
  const [position, setPosition] = useState<Point | null>(null)

  const hint = useMutation({
    mutationFn: () => aiApi.hint({ problemSlug, level, ...(message ? { message } : {}) }),
    onSuccess: (value) => {
      setHints((current) => [...current, { level: value.level, text: value.hint }])
      window.localStorage.setItem(storageKey, String(Math.min(level + 1, MAX_HINT_LEVEL)))
      setLevel((current) => Math.min(current + 1, MAX_HINT_LEVEL))
    },
    onError: () => toast.error('The mentor is unavailable right now.'),
  })

  const explain = useMutation({
    mutationFn: () => aiApi.explain({ problemSlug, ...(message ? { question: message } : {}) }),
    onSuccess: setExplanation,
    onError: () => toast.error('Could not explain that right now.'),
  })

  const analyze = useMutation({
    mutationFn: () => aiApi.analyzeCode({ problemSlug, code }),
    onSuccess: setAnalysis,
    onError: () => toast.error('Could not analyse your code right now.'),
  })

  const showSolution = useMutation({
    mutationFn: () => aiApi.showSolution({ problemSlug }),
    onSuccess: (value) => {
      setSolution(value)
      setConfirmSolution(false)
    },
    onError: () => toast.error('Could not load the solution right now.'),
  })

  const pending: Record<Tab, boolean> = {
    hint: hint.isPending,
    concept: explain.isPending,
    analysis: analyze.isPending,
    solution: showSolution.isPending,
  }
  const filled: Record<Tab, boolean> = {
    hint: hints.length > 0,
    concept: explanation !== null,
    analysis: analysis !== null,
    // Asking counts: the confirmation lives in the Solution tab, not under the buttons.
    solution: solution !== null || confirmSolution,
  }
  const tabs = TAB_ORDER.filter((key) => pending[key] || filled[key])

  /** Opens the window on one tab, placed top-right the first time. */
  const open = (next: Tab): void => {
    setTab(next)
    setPosition(
      (current) =>
        current ?? {
          x: Math.max(EDGE, window.innerWidth - WINDOW_WIDTH - 24),
          y: 80,
        },
    )
  }

  /** What each button and its shortcut does — one path, so the two never drift. */
  const ask: Record<Tab, () => void> = {
    hint: () => {
      open('hint')
      if (!hint.isPending) hint.mutate()
    },
    concept: () => {
      open('concept')
      if (!explain.isPending) explain.mutate()
    },
    analysis: () => {
      if (code.length === 0) return
      open('analysis')
      if (!analyze.isPending) analyze.mutate()
    },
    // The solution is never one keystroke away: it opens the confirmation, whose
    // Reveal button takes focus, so Enter is the deliberate second step.
    solution: () => {
      if (solution === null) setConfirmSolution(true)
      open('solution')
    },
  }

  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    const action = SHORTCUT[event.code]
    if (action === undefined) return
    event.preventDefault()
    event.stopPropagation()
    if (action !== 'toggle') {
      ask[action]()
    } else if (tab !== null) {
      setTab(null)
    } else if (tabs.length > 0) {
      open(tabs[tabs.length - 1] ?? 'hint')
    }
  })

  // Capture phase: Monaco handles keys on its own textarea and would otherwise
  // see them first. The editor has nothing bound to Alt+digit.
  useEffect(() => {
    const listener = (event: KeyboardEvent): void => {
      onShortcut(event)
    }
    window.addEventListener('keydown', listener, true)
    return () => {
      window.removeEventListener('keydown', listener, true)
    }
  }, [])

  return (
    <section className="border-primary/30 bg-primary/5 flex flex-col gap-3 border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-mono text-[11px] sm:text-[10px] tracking-[0.18em] uppercase">
            <Lightbulb className="size-3.5" /> Mentor
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">Ask for a nudge. The answer stays yours.</p>
        </div>
        <span className="text-muted-foreground font-mono text-[11px] sm:text-[10px] uppercase">Level {level}</span>
      </div>

      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="What part feels stuck?"
        // The API refuses more (docs/security.md): stop typing here, not at a 400.
        maxLength={4000}
        rows={2}
        className="border-border bg-background focus:ring-primary/40 w-full resize-y border p-2 text-sm outline-none focus:ring-2"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={ask.hint} disabled={hint.isPending} aria-keyshortcuts="Alt+1">
          {hint.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Lightbulb className="size-3.5" />}
          Get hint
          <Kbd>Alt 1</Kbd>
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={ask.concept} disabled={explain.isPending} aria-keyshortcuts="Alt+2">
          {explain.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <MessageCircle className="size-3.5" />}
          Explain concept
          <Kbd>Alt 2</Kbd>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={ask.analysis}
          disabled={analyze.isPending || code.length === 0}
          aria-keyshortcuts="Alt+3"
        >
          {analyze.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <MessageCircle className="size-3.5" />}
          Analyze code
          <Kbd>Alt 3</Kbd>
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={ask.solution} disabled={showSolution.isPending} aria-keyshortcuts="Alt+4">
          Show solution
          <Kbd>Alt 4</Kbd>
        </Button>
        {tab === null && tabs.length > 0 && (
          <button
            type="button"
            onClick={() => open(tabs[tabs.length - 1] ?? 'hint')}
            aria-keyshortcuts="Alt+0"
            className="text-muted-foreground hover:text-foreground ml-auto font-mono text-[11px] tracking-[0.14em] uppercase underline-offset-4 hover:underline sm:text-[10px]"
          >
            Open answers ({tabs.length})
          </button>
        )}
      </div>

      {tab !== null && position !== null && (
        <MentorWindow
          tab={tab}
          tabs={tabs}
          position={position}
          onTab={setTab}
          onMove={setPosition}
          onClose={() => setTab(null)}
        >
          {pending[tab] ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" /> The mentor is thinking…
            </p>
          ) : tab === 'hint' ? (
            <ol className="flex flex-col gap-3">
              {hints.map((entry, index) => (
                <li key={index} className="border-border bg-background flex flex-col gap-2 border p-3 text-sm">
                  <HintLadder reached={entry.level} max={MAX_HINT_LEVEL} />
                  <p className="leading-relaxed whitespace-pre-line">
                    <RichText text={entry.text} />
                  </p>
                </li>
              ))}
            </ol>
          ) : tab === 'concept' && explanation ? (
            <div className="flex flex-col gap-5 text-sm">
              <Callout title="Intuition" text={explanation.intuition} />
              <ExampleCard title="Worked example" text={explanation.example} />
              <StepFlow title="Implementation" steps={sentences(explanation.implementation)} />
              <ComplexityScale label="Complexity" value={explanation.complexity} />
              <WarningCards title="Common mistakes" items={explanation.commonMistakes.map((text) => ({ text }))} />
            </div>
          ) : tab === 'analysis' && analysis ? (
            <AnalysisView analysis={analysis} />
          ) : tab === 'solution' && solution ? (
            <SolutionView solution={solution} />
          ) : tab === 'solution' && confirmSolution ? (
            <div className="border-destructive/40 bg-destructive/5 flex flex-col gap-3 border p-4 text-sm">
              <p>This reveals the complete solution and is recorded in your mentor history.</p>
              <div className="flex gap-2">
                <Button type="button" size="sm" autoFocus onClick={() => showSolution.mutate()}>
                  Reveal solution
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setConfirmSolution(false)
                    setTab(tabs.find((option) => option !== 'solution' && filled[option]) ?? null)
                  }}
                >
                  Keep trying
                </Button>
              </div>
            </div>
          ) : null}
        </MentorWindow>
      )}
    </section>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd aria-hidden="true" className="border-current/30 ml-1 hidden border px-1 font-mono text-[9px] opacity-60 lg:inline">
      {children}
    </kbd>
  )
}

/**
 * A non-modal window over the workspace. The header is the drag handle; arrow
 * keys on it move the window too, so it is not pointer-only. The editor stays
 * usable underneath — the point is to read an answer beside the code.
 */
function MentorWindow({
  tab,
  tabs,
  position,
  onTab,
  onMove,
  onClose,
  children,
}: {
  tab: Tab
  tabs: Tab[]
  position: Point
  onTab: (tab: Tab) => void
  onMove: (position: Point) => void
  onClose: () => void
  children: React.ReactNode
}) {
  const windowRef = useRef<HTMLDivElement | null>(null)
  const [maximized, setMaximized] = useState(false)

  /** Keeps at least the header on screen, wherever it is dropped. */
  const place = (x: number, y: number): void => {
    const width = windowRef.current?.offsetWidth ?? WINDOW_WIDTH
    onMove({
      x: Math.min(Math.max(x, EDGE), Math.max(EDGE, window.innerWidth - width - EDGE)),
      y: Math.min(Math.max(y, EDGE), Math.max(EDGE, window.innerHeight - 48)),
    })
  }

  const startDrag = (event: React.PointerEvent<HTMLDivElement>): void => {
    // Tabs and the window buttons live in the header; they are not handles.
    if (maximized || (event.target as HTMLElement).closest('button')) {
      return
    }
    event.preventDefault()
    const offset = { x: event.clientX - position.x, y: event.clientY - position.y }

    const move = (pointer: PointerEvent): void => {
      place(pointer.clientX - offset.x, pointer.clientY - offset.y)
    }
    const stop = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    // Same reason as the workspace dividers: the drag crosses Monaco.
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  const nudge = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const step = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }[event.key]
    if (!step || event.target !== event.currentTarget || maximized) {
      return
    }
    event.preventDefault()
    place(position.x + (step[0] ?? 0), position.y + (step[1] ?? 0))
  }

  /** Arrow keys between tabs, as the tab pattern expects; focus follows. */
  const switchTab = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    event.stopPropagation()
    const index = tabs.indexOf(tab)
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]
    if (!next) return
    onTab(next)
    windowRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)?.focus()
  }

  return (
    <div
      ref={windowRef}
      role="dialog"
      aria-label="Mentor answers"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
      style={maximized ? undefined : { left: position.x, top: position.y, width: WINDOW_WIDTH }}
      className={cn(
        'bg-card text-foreground border-primary/40 fixed z-40 flex flex-col border shadow-2xl shadow-black/50',
        maximized
          ? 'inset-4'
          : // Resizable from the corner; the content scrolls inside, never the page.
            'max-h-[min(85vh,900px)] min-h-48 max-w-[calc(100vw-1.5rem)] min-w-80 resize overflow-hidden',
        // Phones: a bottom sheet. There is no room to drag anything around.
        'max-sm:inset-x-2! max-sm:top-auto! max-sm:bottom-2! max-sm:w-auto! max-sm:max-h-[80vh]! max-sm:resize-none',
      )}
    >
      <div
        tabIndex={0}
        aria-label="Move the mentor window with the arrow keys"
        onPointerDown={startDrag}
        onKeyDown={nudge}
        onDoubleClick={(event) => {
          if (!(event.target as HTMLElement).closest('button')) setMaximized((current) => !current)
        }}
        className={cn(
          'border-border bg-primary/5 focus-visible:bg-primary/15 flex shrink-0 items-center gap-2 border-b px-2 py-1.5 outline-none max-sm:cursor-default',
          !maximized && 'cursor-grab',
        )}
      >
        <GripHorizontal className="text-muted-foreground size-4 shrink-0 max-sm:hidden" aria-hidden="true" />
        <div role="tablist" aria-label="Answer type" onKeyDown={switchTab} className="flex flex-wrap gap-1">
          {tabs.map((option) => (
            <button
              key={option}
              data-tab={option}
              type="button"
              role="tab"
              aria-selected={tab === option}
              tabIndex={tab === option ? 0 : -1}
              onClick={() => onTab(option)}
              className={cn(
                'border-border text-muted-foreground border px-2.5 py-1 font-mono text-[11px] tracking-[0.14em] uppercase sm:text-[10px]',
                tab === option && 'bg-primary text-primary-foreground border-primary',
              )}
            >
              {TAB_LABEL[option]}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center">
          <button
            type="button"
            aria-label={maximized ? 'Restore the mentor window' : 'Maximize the mentor window'}
            title={maximized ? 'Restore' : 'Maximize'}
            onClick={() => setMaximized((current) => !current)}
            className="text-muted-foreground hover:text-foreground p-1 max-sm:hidden"
          >
            {maximized ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
          <button
            type="button"
            aria-label="Close the mentor window"
            title="Close (Esc)"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div role="tabpanel" aria-label={TAB_LABEL[tab]} className="min-h-0 flex-1 overflow-y-auto p-5">
        {children}
      </div>
      <p className="border-border text-muted-foreground/70 shrink-0 border-t px-3 py-1.5 font-mono text-[10px] tracking-wide max-sm:hidden">
        Alt+1–4 ask · Alt+0 hide/show · ←/→ switch tab · Esc close · double-click header to maximize
      </p>
    </div>
  )
}

const CORRECTNESS: Record<MentorAnalysis['correctness'], { label: string; className: string }> = {
  correct: { label: 'Correct', className: 'border-emerald-500/50 text-emerald-400' },
  'partially-correct': { label: 'Partially correct', className: 'border-amber-500/50 text-amber-400' },
  incorrect: { label: 'Incorrect', className: 'border-destructive/60 text-destructive' },
}

function AnalysisView({ analysis }: { analysis: MentorAnalysis }) {
  const verdict = CORRECTNESS[analysis.correctness]
  return (
    <div className="flex flex-col gap-5 text-sm">
      <span className={cn('self-start border px-2 py-0.5 font-mono text-[11px] tracking-[0.14em] uppercase', verdict.className)}>
        {verdict.label}
      </span>
      <div className="grid gap-3 sm:grid-cols-2">
        <ComplexityScale label="Time" value={analysis.timeComplexity} />
        <ComplexityScale label="Space" value={analysis.spaceComplexity} />
      </div>
      <WarningCards
        title="Issues"
        items={analysis.issues.map((issue) => ({
          text: issue.description,
          severity: issue.severity,
          ...(issue.line === undefined ? {} : { line: issue.line }),
        }))}
      />
      <StepFlow title="Suggestions" steps={analysis.suggestions.flatMap(sentences)} />
    </div>
  )
}

function SolutionView({ solution }: { solution: MentorSolution }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-5 text-sm">
      <StepFlow title="Approach" steps={sentences(solution.approach)} />
      <ComplexityScale label="Complexity" value={solution.complexity} />
      <div>
        <div className="flex items-center justify-between">
          <MentorLabel>Code</MentorLabel>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(solution.code).then(() => {
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1500)
              })
            }}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 font-mono text-[11px] tracking-[0.14em] uppercase sm:text-[10px]"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="bg-muted mt-1 overflow-x-auto p-3 font-mono text-xs">{solution.code}</pre>
      </div>
    </div>
  )
}
