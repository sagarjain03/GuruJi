'use client'

import {
  algorithmRegistry,
  describeSnapshot,
  findAlgorithm,
  VisualizerInputError,
  type AlgorithmCategory,
  type AlgorithmDefinition,
  type AlgorithmStep,
} from '@guruji/algorithms'
import { ChevronFirst, ChevronLast, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SPEEDS, useVisualizerStore } from '@/stores/visualizer-store'
import { ArrayCanvas } from './array-canvas'
import { GraphCanvas } from './graph-canvas'
import { ListCanvas } from './list-canvas'
import { TableCanvas } from './table-canvas'
import { TreeCanvas } from './tree-canvas'

/** Milliseconds per step at 1× speed. */
const STEP_MS = 700

const CATEGORY_LABEL: Record<AlgorithmCategory, string> = {
  SORTING: 'Sorting',
  SEARCHING: 'Searching',
  LINKED_LIST: 'Linked list',
  TREE: 'Trees',
  GRAPH: 'Graphs',
  DP: 'Dynamic programming',
}

const GROUPS = (Object.keys(CATEGORY_LABEL) as AlgorithmCategory[]).map((category) => ({
  category,
  algorithms: algorithmRegistry.filter((definition) => definition.category === category),
}))

type Run = { steps: AlgorithmStep[]; error: null } | { steps: null; error: string }

function run(definition: AlgorithmDefinition, input: string): Run {
  try {
    return { steps: definition.run(input), error: null }
  } catch (error) {
    if (error instanceof VisualizerInputError) return { steps: null, error: error.message }
    throw error
  }
}

/** Keys that the focused control already handles itself. */
function ownsKey(target: EventTarget, key: string): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return true
  return target.tagName === 'BUTTON' && (key === ' ' || key === 'Enter')
}

export function VisualizerView() {
  const { algorithmId, input, stepIndex, playing, speed } = useVisualizerStore()
  const { selectAlgorithm, applyInput, goTo, advance, setPlaying, setSpeed } = useVisualizerStore.getState()
  const definition = findAlgorithm(algorithmId) ?? algorithmRegistry[0]

  // Memoised on (algorithm, input) only: speed and position never regenerate it.
  const result = useMemo(() => (definition === undefined ? null : run(definition, input)), [definition, input])
  const steps = result?.steps ?? null
  const lastIndex = steps === null ? 0 : steps.length - 1
  const index = Math.min(stepIndex, lastIndex)
  const step = steps?.[index]

  // One requestAnimationFrame loop drives playback — no per-element timers to drift.
  useEffect(() => {
    if (!playing || steps === null) return
    let frame = 0
    let previous: number | null = null
    const tick = (now: number): void => {
      previous ??= now
      if (now - previous >= STEP_MS / speed) {
        previous = now
        advance(lastIndex)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, speed, steps, lastIndex, advance])

  if (definition === undefined) return null

  const move = (next: number): void => goTo(Math.min(Math.max(next, 0), lastIndex))
  const togglePlay = (): void => {
    if (!playing && index >= lastIndex) goTo(0)
    setPlaying(!playing)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (steps === null || ownsKey(event.target, event.key)) return
    const actions: Record<string, () => void> = {
      ' ': togglePlay,
      ArrowLeft: () => move(index - 1),
      ArrowRight: () => move(index + 1),
      Home: () => move(0),
      End: () => move(lastIndex),
    }
    const action = actions[event.key]
    if (action === undefined) return
    event.preventDefault()
    action()
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-5 lg:p-8" onKeyDown={onKeyDown}>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-muted-foreground font-mono text-[10px] tracking-[0.18em] uppercase">
            Algorithm laboratory · {CATEGORY_LABEL[definition.category]}
          </p>
          <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">{definition.name}</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
            {definition.summary} <span className="font-mono text-xs">{definition.complexity}</span>
          </p>
        </div>
        <label className="text-muted-foreground flex flex-col gap-1 font-mono text-[10px] tracking-[0.14em] uppercase">
          Algorithm
          <select
            value={definition.id}
            onChange={(event) => {
              const next = findAlgorithm(event.target.value)
              if (next !== undefined) selectAlgorithm(next.id, next.defaultInput)
            }}
            className="border-border bg-background text-foreground border px-2 py-2 text-sm tracking-normal normal-case outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            {GROUPS.map((group) => (
              <optgroup key={group.category} label={CATEGORY_LABEL[group.category]}>
                {group.algorithms.map((algorithm) => (
                  <option key={algorithm.id} value={algorithm.id}>
                    {algorithm.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </header>

      <InputForm key={`${definition.id}:${input}`} definition={definition} applied={input} error={result?.error ?? null} onApply={applyInput} />

      {steps !== null && step !== undefined && (
        <section className="border-border bg-card flex flex-col gap-5 border p-5" aria-label="Algorithm visualizer">
          <div
            role="img"
            tabIndex={0}
            aria-label={describeSnapshot(step.state)}
            className="border-border bg-background border p-4 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            <StructureCanvas step={step} />
          </div>

          <div className="flex flex-col gap-3 border-t pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="icon" variant="ghost" aria-label="First step" onClick={() => move(0)} disabled={index === 0}>
                <ChevronFirst />
              </Button>
              <Button size="icon" variant="outline" aria-label="Previous step" onClick={() => move(index - 1)} disabled={index === 0}>
                <SkipBack />
              </Button>
              <Button size="icon" aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlay}>
                {playing ? <Pause /> : <Play />}
              </Button>
              <Button size="icon" variant="outline" aria-label="Next step" onClick={() => move(index + 1)} disabled={index === lastIndex}>
                <SkipForward />
              </Button>
              <Button size="icon" variant="ghost" aria-label="Last step" onClick={() => move(lastIndex)} disabled={index === lastIndex}>
                <ChevronLast />
              </Button>
              <label className="text-muted-foreground ml-auto flex items-center gap-2 font-mono text-xs">
                Speed
                <select
                  value={speed}
                  onChange={(event) => setSpeed(Number(event.target.value))}
                  className="border-border bg-background text-foreground border px-2 py-1 outline-none focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
                >
                  {SPEEDS.map((option) => (
                    <option key={option} value={option}>
                      {option}×
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <input
              type="range"
              aria-label="Step"
              min={0}
              max={lastIndex}
              value={index}
              onChange={(event) => move(Number(event.target.value))}
              className="accent-[var(--primary)]"
            />
          </div>

          <div className="border-border bg-muted grid gap-3 border p-4 text-sm sm:grid-cols-[1fr_auto]">
            <p aria-live="polite" aria-atomic="true">
              <span className="text-muted-foreground mr-2 font-mono text-[10px] tracking-[0.14em] uppercase">{step.type}</span>
              {step.description}
            </p>
            <p className="text-muted-foreground font-mono text-xs">
              Step {index + 1} / {steps.length}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ValuePanel title="Variables" values={step.variables} empty="No variables at this step." />
            <ValuePanel title="Metrics" values={step.metrics} empty="" />
          </div>

          <p className="text-muted-foreground font-mono text-[10px]">
            Keys: Space play/pause · ← → step · Home / End jump to the first or last step.
          </p>
        </section>
      )}
    </main>
  )
}

/**
 * Picks the canvas by structure kind. Every algorithm reaches the screen
 * through this switch, so a new algorithm on an existing structure needs no
 * React at all.
 */
function StructureCanvas({ step }: { step: AlgorithmStep }) {
  const state = step.state
  switch (state.kind) {
    case 'array':
      return <ArrayCanvas step={step} state={state} />
    case 'list':
      return <ListCanvas step={step} state={state} />
    case 'tree':
      return <TreeCanvas step={step} state={state} />
    case 'graph':
      return <GraphCanvas step={step} state={state} />
    case 'table':
      return <TableCanvas step={step} state={state} />
  }
}

function InputForm({
  definition,
  applied,
  error,
  onApply,
}: {
  definition: AlgorithmDefinition
  applied: string
  error: string | null
  onApply: (input: string) => void
}) {
  const [draft, setDraft] = useState(applied)
  const submit = (event: FormEvent): void => {
    event.preventDefault()
    onApply(draft.trim())
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor="visualizer-input" className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
        Input
      </label>
      <div className="flex flex-wrap gap-2">
        <Input
          id="visualizer-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-describedby="visualizer-input-hint"
          aria-invalid={error !== null}
          className="min-w-0 flex-1 font-mono"
          spellCheck={false}
          autoComplete="off"
        />
        <Button type="submit">Run</Button>
        <Button type="button" variant="ghost" onClick={() => onApply(definition.defaultInput)}>
          Example
        </Button>
      </div>
      <p id="visualizer-input-hint" className="text-muted-foreground text-xs">
        {definition.inputHint}
      </p>
      {error !== null && (
        <p role="alert" className="border-destructive text-destructive border px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </form>
  )
}

function ValuePanel({ title, values, empty }: { title: string; values: object; empty: string }) {
  const entries = Object.entries(values)
  return (
    <div className="border-border border p-3">
      <h2 className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">{title}</h2>
      {entries.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-xs">{empty}</p>
      ) : (
        <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
          {entries.map(([key, value]) => (
            <div key={key} className="min-w-0">
              <dt className="text-muted-foreground">{key}</dt>
              <dd className="font-mono break-words">{value === null ? 'null' : String(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
