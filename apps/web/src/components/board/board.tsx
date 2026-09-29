'use client'

import type { ProblemDetail } from '@guruji/types'
import { Eraser, Minus, MousePointer2, MoveUpRight, Pencil, Plus, Redo2, Trash, Undo2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { BlockFrame, type UpdateBlock } from './blocks'
import { BLOCK_LABEL, createBlock, newId, type Block, type BlockKind, type Stroke } from './model'
import { useBoard } from './use-board'

type Tool = 'select' | 'pen' | 'arrow' | 'eraser'

const TOOLS: { tool: Tool; label: string; key: string; Icon: typeof Pencil }[] = [
  { tool: 'select', label: 'Select and pan (V)', key: 'v', Icon: MousePointer2 },
  { tool: 'pen', label: 'Pen (P)', key: 'p', Icon: Pencil },
  { tool: 'arrow', label: 'Arrow (A)', key: 'a', Icon: MoveUpRight },
  { tool: 'eraser', label: 'Eraser (E)', key: 'e', Icon: Eraser },
]

/** Ink follows the theme; the rest read on both grounds. */
const COLORS = [
  { value: 'var(--foreground)', label: 'Ink' },
  { value: '#ef4444', label: 'Red' },
  { value: '#22c55e', label: 'Green' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#3b82f6', label: 'Blue' },
] as const

const COMPONENTS: BlockKind[] = ['array', 'stack', 'queue', 'list', 'map', 'tree', 'graph', 'grid', 'variable', 'note']

interface View {
  x: number
  y: number
  zoom: number
}
const ZOOM_MIN = 0.3
const ZOOM_MAX = 2.5
const clampZoom = (zoom: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))

/** Distance from a point to a stroke, for the eraser. */
function nearStroke(stroke: Stroke, x: number, y: number, radius: number): boolean {
  const points = stroke.arrow
    ? [stroke.points[0] ?? 0, stroke.points[1] ?? 0, stroke.points.at(-2) ?? 0, stroke.points.at(-1) ?? 0]
    : stroke.points
  for (let i = 0; i + 1 < points.length; i += 2) {
    const ax = points[i] ?? 0
    const ay = points[i + 1] ?? 0
    const bx = points[i + 2] ?? ax
    const by = points[i + 3] ?? ay
    const dx = bx - ax
    const dy = by - ay
    const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
    if (Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) <= radius) return true
  }
  return false
}

function strokePath(points: number[]): string {
  let d = ''
  for (let i = 0; i + 1 < points.length; i += 2) d += `${i === 0 ? 'M' : 'L'}${String(points[i])} ${String(points[i + 1])}`
  return d
}

function StrokeShape({ stroke }: { stroke: Stroke }) {
  const style = { stroke: stroke.color }
  if (!stroke.arrow) {
    return (
      <path data-stroke d={strokePath(stroke.points)} fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={style} />
    )
  }
  const [x0 = 0, y0 = 0] = stroke.points
  const x1 = stroke.points.at(-2) ?? x0
  const y1 = stroke.points.at(-1) ?? y0
  const angle = Math.atan2(y1 - y0, x1 - x0)
  const head = (turn: number) => `${String(x1 - 13 * Math.cos(angle + turn))} ${String(y1 - 13 * Math.sin(angle + turn))}`
  return (
    <g data-stroke style={style} fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d={`M${String(x0)} ${String(y0)}L${String(x1)} ${String(y1)}`} />
      <path d={`M${head(0.45)}L${String(x1)} ${String(y1)}L${head(-0.45)}`} />
    </g>
  )
}

/**
 * A whiteboard over the editor for working a case by hand: the sample on top,
 * data structures to place and fill in, and a pen for everything else. It
 * never runs code — it is paper, kept per problem in this browser.
 */
export function Board({ problem, onClose }: { problem: ProblemDetail; onClose: () => void }) {
  const { board, change, undo, redo, canUndo, canRedo } = useBoard(problem.slug)
  const [tool, setTool] = useState<Tool>('select')
  const [color, setColor] = useState<string>(COLORS[0].value)
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 })
  const [draft, setDraft] = useState<Stroke | null>(null)
  const draftRef = useRef<Stroke | null>(null)
  const [caseIndex, setCaseIndex] = useState(0)
  const canvas = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDivElement>(null)

  const cases = [...problem.sampleTestCases].sort((a, b) => a.displayOrder - b.displayOrder)
  const current = cases[caseIndex]

  useEffect(() => {
    dialog.current?.focus()
  }, [])

  // Keyboard: Escape closes; undo/redo and tool keys work unless someone is typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      const target = event.target as HTMLElement | null
      const typing = target !== null && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      if (typing) return
      const key = event.key.toLowerCase()
      if ((event.ctrlKey || event.metaKey) && (key === 'z' || key === 'y')) {
        event.preventDefault()
        if (key === 'y' || event.shiftKey) redo()
        else undo()
        return
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const match = TOOLS.find((entry) => entry.key === key)
      if (match) setTool(match.tool)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose, undo, redo])

  // Wheel pans, Ctrl/⌘ + wheel zooms around the pointer. Registered by hand
  // because React's wheel listener is passive and cannot stop the page scrolling.
  useEffect(() => {
    const element = canvas.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      if (event.ctrlKey || event.metaKey) {
        const rect = element.getBoundingClientRect()
        const px = event.clientX - rect.left
        const py = event.clientY - rect.top
        setView((v) => {
          const zoom = clampZoom(v.zoom * Math.exp(-event.deltaY * 0.0015))
          return { zoom, x: px - (px - v.x) * (zoom / v.zoom), y: py - (py - v.y) * (zoom / v.zoom) }
        })
      } else {
        setView((v) => ({ ...v, x: v.x - event.deltaX, y: v.y - event.deltaY }))
      }
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      element.removeEventListener('wheel', onWheel)
    }
  }, [])

  const toWorld = (clientX: number, clientY: number) => {
    const rect = canvas.current?.getBoundingClientRect()
    const left = rect?.left ?? 0
    const top = rect?.top ?? 0
    return { x: (clientX - left - view.x) / view.zoom, y: (clientY - top - view.y) / view.zoom }
  }

  const zoomBy = (factor: number) => {
    const rect = canvas.current?.getBoundingClientRect()
    const px = (rect?.width ?? 0) / 2
    const py = (rect?.height ?? 0) / 2
    setView((v) => {
      const zoom = clampZoom(v.zoom * factor)
      return { zoom, x: px - (px - v.x) * (zoom / v.zoom), y: py - (py - v.y) * (zoom / v.zoom) }
    })
  }

  const addBlock = (kind: BlockKind) => {
    const rect = canvas.current?.getBoundingClientRect()
    const centre = toWorld((rect?.left ?? 0) + (rect?.width ?? 0) / 2, (rect?.top ?? 0) + (rect?.height ?? 0) / 2)
    // Staggered, so several added in a row do not land exactly on top of each other.
    const offset = (board.blocks.length % 8) * 26
    change((current) => ({ ...current, blocks: [...current.blocks, createBlock(kind, centre.x - 120 + offset, centre.y - 90 + offset)] }))
    setTool('select')
  }

  const updateBlock =
    (id: string): UpdateBlock =>
    (update, coalesceKey) => {
      change((current) => ({ ...current, blocks: current.blocks.map((block) => (block.id === id ? update(block) : block)) }), coalesceKey)
    }

  const removeBlock = (id: string) => {
    change((current) => ({ ...current, blocks: current.blocks.filter((block) => block.id !== id) }))
  }

  const dragBlock = (block: Block) => (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    const start = { x: event.clientX, y: event.clientY, bx: block.x, by: block.y, zoom: view.zoom }
    const session = newId()
    const onMove = (move: PointerEvent) => {
      const x = start.bx + (move.clientX - start.x) / start.zoom
      const y = start.by + (move.clientY - start.y) / start.zoom
      change(
        (current) => ({ ...current, blocks: current.blocks.map((b) => (b.id === block.id ? { ...b, x, y } : b)) }),
        `move:${session}`,
      )
    }
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }

  /* Select tool: dragging the empty canvas pans. */
  const onCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (tool !== 'select' || event.button !== 0 || event.target !== event.currentTarget) return
    const element = event.currentTarget
    element.setPointerCapture(event.pointerId)
    const start = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y }
    const onMove = (move: PointerEvent) => {
      setView((v) => ({ ...v, x: start.vx + move.clientX - start.x, y: start.vy + move.clientY - start.y }))
    }
    const onUp = () => {
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerup', onUp)
    }
    element.addEventListener('pointermove', onMove)
    element.addEventListener('pointerup', onUp)
  }

  /* Drawing tools: an overlay above the blocks takes the pointer. */
  const erase = (clientX: number, clientY: number) => {
    const point = toWorld(clientX, clientY)
    const radius = 10 / view.zoom
    change((current) => {
      const strokes = current.strokes.filter((stroke) => !nearStroke(stroke, point.x, point.y, radius))
      return strokes.length === current.strokes.length ? current : { ...current, strokes }
    }, 'erase')
  }

  const onOverlayPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    if (tool === 'eraser') {
      erase(event.clientX, event.clientY)
      return
    }
    const { x, y } = toWorld(event.clientX, event.clientY)
    const stroke: Stroke = { id: newId(), color, points: [x, y], arrow: tool === 'arrow' }
    draftRef.current = stroke
    setDraft(stroke)
  }

  const onOverlayPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (tool === 'eraser') {
      if (event.buttons === 1) erase(event.clientX, event.clientY)
      return
    }
    const stroke = draftRef.current
    if (!stroke) return
    const { x, y } = toWorld(event.clientX, event.clientY)
    const lastX = stroke.points.at(-2) ?? x
    const lastY = stroke.points.at(-1) ?? y
    if (Math.hypot(x - lastX, y - lastY) < 1.5 / view.zoom) return
    const next = { ...stroke, points: stroke.arrow ? [stroke.points[0] ?? x, stroke.points[1] ?? y, x, y] : [...stroke.points, x, y] }
    draftRef.current = next
    setDraft(next)
  }

  const onOverlayPointerUp = () => {
    const stroke = draftRef.current
    draftRef.current = null
    setDraft(null)
    if (stroke && stroke.points.length >= 4) {
      change((current) => ({ ...current, strokes: [...current.strokes, stroke] }))
    }
  }

  const clearAll = () => {
    if (board.blocks.length === 0 && board.strokes.length === 0) return
    change((current) => ({ ...current, blocks: [], strokes: [] }))
    toast('Board cleared.', { action: { label: 'Undo', onClick: undo } })
  }

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="Board"
      tabIndex={-1}
      className="bg-background fixed inset-0 z-50 flex flex-col outline-none"
    >
      {/* The case being worked, always in view. */}
      <header className="surface border-border flex flex-wrap items-start gap-x-6 gap-y-2 border-b px-4 py-3">
        <div className="min-w-40">
          <p className="text-muted-foreground font-mono text-[10px] tracking-[0.16em] uppercase">Board</p>
          <p className="font-display text-sm font-semibold">{problem.title}</p>
        </div>

        {current && (
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div role="tablist" aria-label="Test cases" className="flex gap-1">
              {cases.map((testCase, index) => (
                <button
                  key={testCase.id}
                  type="button"
                  role="tab"
                  aria-selected={index === caseIndex}
                  onClick={() => {
                    setCaseIndex(index)
                  }}
                  className={cn(
                    'border-border text-muted-foreground border px-2 py-0.5 font-mono text-[11px]',
                    index === caseIndex && 'text-foreground border-foreground/40',
                  )}
                >
                  Example {index + 1}
                </button>
              ))}
            </div>
            <div role="tabpanel" className="grid gap-2 sm:grid-cols-2">
              <CasePane label="Input" value={current.input} testId="board-case-input" />
              <CasePane label="Expected output" value={current.expectedOutput} testId="board-case-output" />
            </div>
          </div>
        )}

        <button
          type="button"
          aria-label="Close board (Esc)"
          title="Close (Esc)"
          onClick={onClose}
          className="border-border text-muted-foreground hover:text-foreground ml-auto border p-1.5"
        >
          <X className="size-4" />
        </button>
      </header>

      <div
        ref={canvas}
        data-testid="board-canvas"
        onPointerDown={onCanvasPointerDown}
        className={cn('relative flex-1 touch-none overflow-hidden', tool === 'select' && 'cursor-grab active:cursor-grabbing')}
        style={{
          backgroundImage: 'radial-gradient(circle, color-mix(in oklab, var(--foreground) 14%, transparent) 1px, transparent 1.5px)',
          backgroundSize: `${String(22 * view.zoom)}px ${String(22 * view.zoom)}px`,
          backgroundPosition: `${String(view.x)}px ${String(view.y)}px`,
        }}
      >
        {/* The world: blocks and ink share one transform, so they pan and zoom together. */}
        <div
          className="pointer-events-none absolute top-0 left-0 origin-top-left"
          style={{ transform: `translate(${String(view.x)}px, ${String(view.y)}px) scale(${String(view.zoom)})` }}
        >
          <div className={cn(tool === 'select' ? 'pointer-events-auto' : 'pointer-events-none')}>
            {board.blocks.map((block) => (
              <BlockFrame
                key={block.id}
                block={block}
                update={updateBlock(block.id)}
                onRemove={() => {
                  removeBlock(block.id)
                }}
                onDragStart={dragBlock(block)}
              />
            ))}
          </div>
          <svg className="absolute top-0 left-0 overflow-visible" width={1} height={1} aria-hidden="true">
            {board.strokes.map((stroke) => (
              <StrokeShape key={stroke.id} stroke={stroke} />
            ))}
            {draft && <StrokeShape stroke={draft} />}
          </svg>
        </div>

        {tool !== 'select' && (
          <div
            aria-hidden="true"
            onPointerDown={onOverlayPointerDown}
            onPointerMove={onOverlayPointerMove}
            onPointerUp={onOverlayPointerUp}
            onPointerCancel={onOverlayPointerUp}
            className={cn('absolute inset-0 z-10', tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair')}
          />
        )}

        {board.blocks.length === 0 && board.strokes.length === 0 && (
          <p className="text-muted-foreground pointer-events-none absolute inset-x-0 top-1/3 text-center text-sm">
            Add a structure from the bar below, or pick up the pen (P) and work the case by hand.
          </p>
        )}

        {/* Tools, top centre. */}
        <div className="surface border-border absolute top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 border p-1 shadow-lg">
          {TOOLS.map(({ tool: value, label, Icon }) => (
            <ToolButton
              key={value}
              label={label}
              active={tool === value}
              onClick={() => {
                setTool(value)
              }}
            >
              <Icon className="size-4" />
            </ToolButton>
          ))}
          <span className="bg-border mx-1 h-5 w-px" aria-hidden="true" />
          {COLORS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-label={`${label} ink`}
              aria-pressed={color === value}
              title={label}
              onClick={() => {
                setColor(value)
                if (tool === 'select' || tool === 'eraser') setTool('pen')
              }}
              className={cn('grid size-7 place-items-center border border-transparent', color === value && 'border-foreground/40')}
            >
              <span className="size-3.5 rounded-full" style={{ background: value }} />
            </button>
          ))}
          <span className="bg-border mx-1 h-5 w-px" aria-hidden="true" />
          <ToolButton label="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
            <Undo2 className="size-4" />
          </ToolButton>
          <ToolButton label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}>
            <Redo2 className="size-4" />
          </ToolButton>
          <ToolButton label="Clear board" onClick={clearAll}>
            <Trash className="size-4" />
          </ToolButton>
        </div>

        {/* Structures, bottom centre. */}
        <div
          aria-label="Components"
          role="toolbar"
          className="surface border-border absolute bottom-3 left-1/2 z-20 flex max-w-[calc(100%-7rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1 border p-1 shadow-lg"
        >
          {COMPONENTS.map((kind) => (
            <button
              key={kind}
              type="button"
              aria-label={`Add ${BLOCK_LABEL[kind]}`}
              onClick={() => {
                addBlock(kind)
              }}
              className="text-muted-foreground hover:text-foreground hover:bg-foreground/5 px-2.5 py-1.5 font-mono text-[11px] tracking-[0.08em]"
            >
              {BLOCK_LABEL[kind]}
            </button>
          ))}
        </div>

        {/* Zoom, bottom right. */}
        <div className="surface border-border absolute right-3 bottom-3 z-20 flex items-center border">
          <ToolButton label="Zoom out" onClick={() => { zoomBy(1 / 1.2) }}>
            <Minus className="size-3.5" />
          </ToolButton>
          <button
            type="button"
            title="Reset view"
            onClick={() => {
              setView({ x: 0, y: 0, zoom: 1 })
            }}
            className="text-muted-foreground hover:text-foreground w-12 font-mono text-[11px] tabular-nums"
          >
            {Math.round(view.zoom * 100)}%
          </button>
          <ToolButton label="Zoom in" onClick={() => { zoomBy(1.2) }}>
            <Plus className="size-3.5" />
          </ToolButton>
        </div>
      </div>
    </div>
  )
}

function CasePane({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">{label}</p>
      <pre data-testid={testId} className="bg-background/60 border-border mt-0.5 max-h-24 overflow-auto border px-2 py-1 font-mono text-xs whitespace-pre-wrap">
        {value}
      </pre>
    </div>
  )
}

function ToolButton({
  label,
  active,
  disabled = false,
  onClick,
  children,
}: {
  label: string
  /** Set for tools only: undo, clear and zoom are actions, not toggles. */
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...(active === undefined ? {} : { 'aria-pressed': active })}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'text-muted-foreground hover:text-foreground grid size-8 place-items-center disabled:opacity-35',
        active && 'bg-primary text-primary-foreground hover:text-primary-foreground',
      )}
    >
      {children}
    </button>
  )
}
