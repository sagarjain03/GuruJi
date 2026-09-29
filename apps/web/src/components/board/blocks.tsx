'use client'

import { GripVertical, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { BLOCK_LABEL, layoutTree, parseGraph, type Block, type BlockOf } from './model'

/** Change one block. The key groups rapid edits (typing) into one undo step. */
export type UpdateBlock = (update: (block: Block) => Block, coalesceKey?: string) => void

const CELL = 'border-border bg-background/40 h-9 w-10 border text-center font-mono text-sm outline-none focus:border-primary focus:z-10'
const SMALL_BUTTON =
  'border-border text-muted-foreground hover:text-foreground border px-2 py-0.5 font-mono text-[11px] disabled:opacity-40'
const POINTERS = ['', 'i', 'j', 'k']

/**
 * One block on the board: a header to drag it by and remove it with, and the
 * structure itself underneath. Every structure is edited in place — the board
 * is for working a case by hand, so nothing here runs code.
 */
export function BlockFrame({
  block,
  update,
  onRemove,
  onDragStart,
}: {
  block: Block
  update: UpdateBlock
  onRemove: () => void
  onDragStart: (event: React.PointerEvent<HTMLElement>) => void
}) {
  return (
    <div
      data-block-kind={block.kind}
      className="surface border-border absolute flex min-w-40 flex-col border shadow-[0_10px_30px_rgb(0,0,0,0.35)]"
      style={{ left: block.x, top: block.y }}
    >
      <div
        onPointerDown={onDragStart}
        className="border-border flex cursor-grab touch-none items-center gap-1.5 border-b px-2 py-1 active:cursor-grabbing"
      >
        <GripVertical className="text-muted-foreground size-3.5" aria-hidden="true" />
        <span className="text-muted-foreground font-mono text-[10px] tracking-[0.16em] uppercase">
          {BLOCK_LABEL[block.kind]}
        </span>
        <button
          type="button"
          aria-label={`Remove ${BLOCK_LABEL[block.kind]}`}
          onPointerDown={(event) => {
            event.stopPropagation()
          }}
          onClick={onRemove}
          className="text-muted-foreground hover:text-foreground ml-auto p-0.5"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="p-3">
        <BlockBody block={block} update={update} />
      </div>
    </div>
  )
}

function BlockBody({ block, update }: { block: Block; update: UpdateBlock }) {
  switch (block.kind) {
    case 'array':
      return <ArrayBody block={block} update={update} />
    case 'stack':
      return <StackBody block={block} update={update} />
    case 'queue':
      return <QueueBody block={block} update={update} />
    case 'list':
      return <ListBody block={block} update={update} />
    case 'map':
      return <MapBody block={block} update={update} />
    case 'tree':
      return <TreeBody block={block} update={update} />
    case 'graph':
      return <GraphBody block={block} update={update} />
    case 'grid':
      return <GridBody block={block} update={update} />
    case 'variable':
      return <VariableBody block={block} update={update} />
    case 'note':
      return <NoteBody block={block} update={update} />
  }
}

/** Narrowed update for one kind, so each body edits its own fields without casts at every call. */
function narrow<K extends Block['kind']>(block: BlockOf<K>, update: UpdateBlock) {
  return (patch: (current: BlockOf<K>) => BlockOf<K>, coalesceKey?: string) => {
    update((current) => (current.kind === block.kind ? patch(current as BlockOf<K>) : current), coalesceKey)
  }
}

/* ---------------------------------------------------------------- array -- */

function ArrayBody({ block, update }: { block: BlockOf<'array'>; update: UpdateBlock }) {
  const set = narrow(block, update)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex">
        {block.cells.map((value, index) => {
          const mark = block.marks[String(index)] ?? ''
          return (
            <div key={index} className="-ml-px flex flex-col items-center first:ml-0">
              <input
                aria-label={`Cell ${String(index)}`}
                value={value}
                onChange={(event) => {
                  const next = event.target.value
                  set((current) => ({ ...current, cells: current.cells.map((cell, i) => (i === index ? next : cell)) }), `${block.id}:cell:${String(index)}`)
                }}
                className={CELL}
              />
              <button
                type="button"
                aria-label={`Index ${String(index)}${mark ? `, pointer ${mark}` : ''}`}
                title="Click to place a pointer"
                onClick={() => {
                  const nextMark = POINTERS[(POINTERS.indexOf(mark) + 1) % POINTERS.length] ?? ''
                  set((current) => {
                    const marks = { ...current.marks }
                    if (nextMark) marks[String(index)] = nextMark
                    else delete marks[String(index)]
                    return { ...current, marks }
                  })
                }}
                className="text-muted-foreground hover:text-foreground flex h-8 w-10 flex-col items-center font-mono text-[10px]"
              >
                {index}
                {mark && <span className="text-primary text-xs leading-none font-semibold">↑{mark}</span>}
              </button>
            </div>
          )
        })}
      </div>
      <div className="flex gap-1">
        <button type="button" className={SMALL_BUTTON} onClick={() => { set((current) => ({ ...current, cells: [...current.cells, ''] })) }}>
          + cell
        </button>
        <button
          type="button"
          className={SMALL_BUTTON}
          disabled={block.cells.length <= 1}
          onClick={() => { set((current) => ({ ...current, cells: current.cells.slice(0, -1) })) }}
        >
          − cell
        </button>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- stack/queue -- */

function EntryRow({
  label,
  action,
  onSubmit,
}: {
  label: string
  action: string
  onSubmit: (value: string) => void
}) {
  const [value, setValue] = useState('')
  const submit = () => {
    if (value.trim() === '') return
    onSubmit(value.trim())
    setValue('')
  }
  return (
    <div className="flex gap-1">
      <input
        aria-label={label}
        value={value}
        onChange={(event) => { setValue(event.target.value) }}
        onKeyDown={(event) => { if (event.key === 'Enter') submit() }}
        className="border-border bg-background/40 h-7 w-20 border px-2 font-mono text-xs outline-none focus:border-primary"
      />
      <button type="button" className={SMALL_BUTTON} onClick={submit}>
        {action}
      </button>
    </div>
  )
}

function StackBody({ block, update }: { block: BlockOf<'stack'>; update: UpdateBlock }) {
  const set = narrow(block, update)
  const topFirst = [...block.items].reverse()
  return (
    <div className="flex flex-col gap-2">
      <div className="border-border flex min-h-10 w-28 flex-col border-x border-b">
        {topFirst.length === 0 ? (
          <p className="text-muted-foreground py-2 text-center font-mono text-[11px]">empty</p>
        ) : (
          topFirst.map((item, index) => (
            <div
              key={`${String(index)}-${item}`}
              className={cn('border-border flex h-8 items-center justify-center border-t font-mono text-sm', index === 0 && 'bg-primary/10')}
            >
              <span {...(index === 0 ? { 'data-testid': 'stack-top' } : {})}>{item}</span>
              {index === 0 && <span className="text-primary ml-2 font-mono text-[10px]">← top</span>}
            </div>
          ))
        )}
      </div>
      <EntryRow label="Value to push" action="Push" onSubmit={(value) => { set((current) => ({ ...current, items: [...current.items, value] })) }} />
      <button
        type="button"
        className={SMALL_BUTTON}
        disabled={block.items.length === 0}
        onClick={() => { set((current) => ({ ...current, items: current.items.slice(0, -1) })) }}
      >
        Pop
      </button>
    </div>
  )
}

function QueueBody({ block, update }: { block: BlockOf<'queue'>; update: UpdateBlock }) {
  const set = narrow(block, update)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <span className="text-muted-foreground font-mono text-[10px] whitespace-nowrap">front →</span>
        <div className="border-border flex min-h-9 min-w-24 border-y">
          {block.items.length === 0 ? (
            <p className="text-muted-foreground self-center px-3 font-mono text-[11px]">empty</p>
          ) : (
            block.items.map((item, index) => (
              <div key={`${String(index)}-${item}`} className="border-border flex h-9 min-w-9 items-center justify-center border-l px-2 font-mono text-sm first:border-l-0">
                {item}
              </div>
            ))
          )}
        </div>
        <span className="text-muted-foreground font-mono text-[10px] whitespace-nowrap">← rear</span>
      </div>
      <EntryRow label="Value to enqueue" action="Enqueue" onSubmit={(value) => { set((current) => ({ ...current, items: [...current.items, value] })) }} />
      <button
        type="button"
        className={SMALL_BUTTON}
        disabled={block.items.length === 0}
        onClick={() => { set((current) => ({ ...current, items: current.items.slice(1) })) }}
      >
        Dequeue
      </button>
    </div>
  )
}

/* ----------------------------------------------------------------- list -- */

function ListBody({ block, update }: { block: BlockOf<'list'>; update: UpdateBlock }) {
  const set = narrow(block, update)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground mr-1 font-mono text-[10px]">head</span>
        {block.items.map((value, index) => (
          <div key={index} className="flex items-center gap-1">
            <input
              aria-label={`Node ${String(index)}`}
              value={value}
              onChange={(event) => {
                const next = event.target.value
                set((current) => ({ ...current, items: current.items.map((item, i) => (i === index ? next : item)) }), `${block.id}:node:${String(index)}`)
              }}
              className={cn(CELL, 'w-10')}
            />
            <span className="text-muted-foreground" aria-hidden="true">→</span>
          </div>
        ))}
        <span className="text-muted-foreground font-mono text-xs">null</span>
      </div>
      <div className="flex gap-1">
        <button type="button" className={SMALL_BUTTON} onClick={() => { set((current) => ({ ...current, items: [...current.items, ''] })) }}>
          + node
        </button>
        <button
          type="button"
          className={SMALL_BUTTON}
          disabled={block.items.length === 0}
          onClick={() => { set((current) => ({ ...current, items: current.items.slice(0, -1) })) }}
        >
          − node
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ map -- */

function MapBody({ block, update }: { block: BlockOf<'map'>; update: UpdateBlock }) {
  const set = narrow(block, update)
  const edit = (row: number, column: 0 | 1, value: string) => {
    set(
      (current) => ({
        ...current,
        rows: current.rows.map((pair, i): [string, string] => (i === row ? (column === 0 ? [value, pair[1]] : [pair[0], value]) : pair)),
      }),
      `${block.id}:${String(row)}:${String(column)}`,
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[auto_auto_auto] items-center gap-x-1 gap-y-1">
        <span className="text-muted-foreground font-mono text-[10px]">key</span>
        <span className="text-muted-foreground font-mono text-[10px]">value</span>
        <span />
        {block.rows.map(([key, value], row) => (
          <div key={row} className="contents">
            <input aria-label={`Key ${String(row)}`} value={key} onChange={(event) => { edit(row, 0, event.target.value) }} className={cn(CELL, 'w-16')} />
            <input aria-label={`Value ${String(row)}`} value={value} onChange={(event) => { edit(row, 1, event.target.value) }} className={cn(CELL, 'w-16')} />
            <button
              type="button"
              aria-label={`Remove row ${String(row)}`}
              className="text-muted-foreground hover:text-foreground px-1"
              onClick={() => { set((current) => ({ ...current, rows: current.rows.filter((_, i) => i !== row) })) }}
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className={SMALL_BUTTON} onClick={() => { set((current) => ({ ...current, rows: [...current.rows, ['', '']] })) }}>
        + row
      </button>
    </div>
  )
}

/* ----------------------------------------------------------------- tree -- */

const TREE_STEP_X = 36
const TREE_STEP_Y = 50
const NODE_R = 15

function TreeBody({ block, update }: { block: BlockOf<'tree'>; update: UpdateBlock }) {
  const set = narrow(block, update)
  const layout = layoutTree(block.source)
  const width = Math.max(1, ...layout.nodes.map((node) => node.x + 1)) * TREE_STEP_X
  const height = (Math.max(0, ...layout.nodes.map((node) => node.y)) + 1) * TREE_STEP_Y
  const at = (id: number) => layout.nodes.find((node) => node.id === id)
  const cx = (x: number) => x * TREE_STEP_X + TREE_STEP_X / 2
  const cy = (y: number) => y * TREE_STEP_Y + NODE_R + 4

  return (
    <div className="flex flex-col gap-2">
      <input
        aria-label="Level order"
        value={block.source}
        placeholder="1,2,3,null,5"
        onChange={(event) => {
          const next = event.target.value
          set((current) => ({ ...current, source: next, marked: [] }), `${block.id}:source`)
        }}
        className="border-border bg-background/40 h-7 w-full min-w-40 border px-2 font-mono text-xs outline-none focus:border-primary"
      />
      {layout.nodes.length > 0 && (
        <svg width={width} height={height} className="overflow-visible">
          {layout.edges.map(([from, to]) => {
            const a = at(from)
            const b = at(to)
            if (!a || !b) return null
            return <line key={`${String(from)}-${String(to)}`} x1={cx(a.x)} y1={cy(a.y)} x2={cx(b.x)} y2={cy(b.y)} className="stroke-muted-foreground" strokeWidth={1.5} />
          })}
          {layout.nodes.map((node) => {
            const marked = block.marked.includes(node.id)
            return (
              <g
                key={node.id}
                data-tree-node
                role="button"
                aria-label={`Node ${node.value}${marked ? ', marked' : ''}`}
                aria-pressed={marked}
                className="cursor-pointer"
                onClick={() => {
                  set((current) => ({
                    ...current,
                    marked: current.marked.includes(node.id) ? current.marked.filter((id) => id !== node.id) : [...current.marked, node.id],
                  }))
                }}
              >
                <circle cx={cx(node.x)} cy={cy(node.y)} r={NODE_R} className={marked ? 'fill-primary stroke-primary' : 'fill-background stroke-foreground/60'} strokeWidth={1.5} />
                <text x={cx(node.x)} y={cy(node.y)} textAnchor="middle" dominantBaseline="central" className={cn('font-mono text-[11px]', marked ? 'fill-primary-foreground' : 'fill-foreground')}>
                  {node.value.slice(0, 4)}
                </text>
              </g>
            )
          })}
        </svg>
      )}
      <p className="text-muted-foreground font-mono text-[10px]">click a node to mark it</p>
    </div>
  )
}

/* ---------------------------------------------------------------- graph -- */

function GraphBody({ block, update }: { block: BlockOf<'graph'>; update: UpdateBlock }) {
  const set = narrow(block, update)
  const graph = parseGraph(block.source)
  const radius = Math.max(50, graph.nodes.length * 14)
  const size = radius * 2 + NODE_R * 2 + 8
  const centre = size / 2
  const position = new Map(
    graph.nodes.map((name, index) => {
      const angle = (index / Math.max(1, graph.nodes.length)) * Math.PI * 2 - Math.PI / 2
      return [name, { x: centre + radius * Math.cos(angle), y: centre + radius * Math.sin(angle) }]
    }),
  )
  const markerId = `arrow-${block.id}`

  return (
    <div className="flex flex-col gap-2">
      <input
        aria-label="Edges"
        value={block.source}
        placeholder="A-B, B->C, C-D:4"
        onChange={(event) => {
          const next = event.target.value
          set((current) => ({ ...current, source: next, marked: [] }), `${block.id}:source`)
        }}
        className="border-border bg-background/40 h-7 w-full min-w-48 border px-2 font-mono text-xs outline-none focus:border-primary"
      />
      {graph.nodes.length > 0 && (
        <svg width={size} height={size}>
          <defs>
            <marker id={markerId} viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 10 5 0 10Z" className="fill-muted-foreground" />
            </marker>
          </defs>
          {graph.edges.map((edge, index) => {
            const a = position.get(edge.from)
            const b = position.get(edge.to)
            if (!a || !b) return null
            // Stop at the circle's rim so an arrowhead is not hidden under the node.
            const length = Math.hypot(b.x - a.x, b.y - a.y) || 1
            const ux = (b.x - a.x) / length
            const uy = (b.y - a.y) / length
            return (
              <g key={index}>
                <line
                  x1={a.x + ux * NODE_R}
                  y1={a.y + uy * NODE_R}
                  x2={b.x - ux * NODE_R}
                  y2={b.y - uy * NODE_R}
                  className="stroke-muted-foreground"
                  strokeWidth={1.5}
                  {...(edge.directed ? { markerEnd: `url(#${markerId})` } : {})}
                />
                {edge.weight !== null && (
                  <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">
                    {edge.weight}
                  </text>
                )}
              </g>
            )
          })}
          {graph.nodes.map((name) => {
            const p = position.get(name)
            if (!p) return null
            const marked = block.marked.includes(name)
            return (
              <g
                key={name}
                role="button"
                aria-label={`Node ${name}${marked ? ', marked' : ''}`}
                aria-pressed={marked}
                className="cursor-pointer"
                onClick={() => {
                  set((current) => ({
                    ...current,
                    marked: current.marked.includes(name) ? current.marked.filter((n) => n !== name) : [...current.marked, name],
                  }))
                }}
              >
                <circle cx={p.x} cy={p.y} r={NODE_R} className={marked ? 'fill-primary stroke-primary' : 'fill-background stroke-foreground/60'} strokeWidth={1.5} />
                <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" className={cn('font-mono text-[11px]', marked ? 'fill-primary-foreground' : 'fill-foreground')}>
                  {name.slice(0, 3)}
                </text>
              </g>
            )
          })}
        </svg>
      )}
      <p className="text-muted-foreground font-mono text-[10px]">A-B undirected · A-&gt;B directed · A-B:4 weight</p>
    </div>
  )
}

/* ----------------------------------------------------------------- grid -- */

function GridBody({ block, update }: { block: BlockOf<'grid'>; update: UpdateBlock }) {
  const set = narrow(block, update)
  const columns = block.cells[0]?.length ?? 0
  return (
    <div className="flex flex-col gap-2">
      <table className="border-collapse">
        <thead>
          <tr>
            <th />
            {Array.from({ length: columns }, (_, c) => (
              <th key={c} className="text-muted-foreground px-1 font-mono text-[10px] font-normal">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.cells.map((row, r) => (
            <tr key={r}>
              <th className="text-muted-foreground pr-1 font-mono text-[10px] font-normal">{r}</th>
              {row.map((value, c) => (
                <td key={c} className="p-0">
                  <input
                    aria-label={`Cell ${String(r)},${String(c)}`}
                    value={value}
                    onChange={(event) => {
                      const next = event.target.value
                      set(
                        (current) => ({
                          ...current,
                          cells: current.cells.map((cells, i) => (i === r ? cells.map((cell, j) => (j === c ? next : cell)) : cells)),
                        }),
                        `${block.id}:${String(r)}:${String(c)}`,
                      )
                    }}
                    className={cn(CELL, '-mt-px -ml-px block')}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-1">
        <button type="button" className={SMALL_BUTTON} onClick={() => { set((current) => ({ ...current, cells: [...current.cells, Array.from({ length: columns }, () => '')] })) }}>
          + row
        </button>
        <button type="button" className={SMALL_BUTTON} disabled={block.cells.length <= 1} onClick={() => { set((current) => ({ ...current, cells: current.cells.slice(0, -1) })) }}>
          − row
        </button>
        <button type="button" className={SMALL_BUTTON} onClick={() => { set((current) => ({ ...current, cells: current.cells.map((cells) => [...cells, '']) })) }}>
          + col
        </button>
        <button type="button" className={SMALL_BUTTON} disabled={columns <= 1} onClick={() => { set((current) => ({ ...current, cells: current.cells.map((cells) => cells.slice(0, -1)) })) }}>
          − col
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------ variable / note -- */

function VariableBody({ block, update }: { block: BlockOf<'variable'>; update: UpdateBlock }) {
  const set = narrow(block, update)
  return (
    <div className="flex items-center gap-1 font-mono text-sm">
      <input
        aria-label="Variable name"
        value={block.name}
        onChange={(event) => {
          const next = event.target.value
          set((current) => ({ ...current, name: next }), `${block.id}:name`)
        }}
        className={cn(CELL, 'w-20 text-left px-2')}
      />
      <span className="text-muted-foreground">=</span>
      <input
        aria-label="Variable value"
        value={block.value}
        onChange={(event) => {
          const next = event.target.value
          set((current) => ({ ...current, value: next }), `${block.id}:value`)
        }}
        className={cn(CELL, 'w-20 text-left px-2')}
      />
    </div>
  )
}

function NoteBody({ block, update }: { block: BlockOf<'note'>; update: UpdateBlock }) {
  const set = narrow(block, update)
  return (
    <textarea
      aria-label="Note"
      value={block.text}
      placeholder="Write anything…"
      rows={Math.max(3, block.text.split('\n').length)}
      onChange={(event) => {
        const next = event.target.value
        set((current) => ({ ...current, text: next }), `${block.id}:text`)
      }}
      className="bg-background/40 border-border w-56 resize-none border p-2 text-sm outline-none focus:border-primary"
    />
  )
}
