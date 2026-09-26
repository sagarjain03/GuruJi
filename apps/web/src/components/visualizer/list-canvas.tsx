import type { AlgorithmStep, ListSnapshot } from '@guruji/algorithms'
import { ACTIVE, Legend, TAG_STYLE } from './tags'

const SPACING = 100
const BOX_WIDTH = 64
const VALUE_WIDTH = 40
const BOX_HEIGHT = 36
const TOP = 56
const MARGIN = 24

export function ListCanvas({ step, state }: { step: AlgorithmStep; state: ListSnapshot }) {
  const active = new Set(step.nodeIds ?? [])
  const position = new Map(state.nodes.map((node, index) => [node.id, index]))
  const x = (index: number) => MARGIN + index * SPACING
  const width = Math.max(state.nodes.length, 1) * SPACING + MARGIN
  const pointers = { head: state.head, ...state.pointers }
  const labelsAt = new Map<string, string[]>()
  for (const [name, id] of Object.entries(pointers)) {
    if (id !== null && id !== undefined) labelsAt.set(id, [...new Set([...(labelsAt.get(id) ?? []), name])])
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} 170`} className="h-auto w-full" style={{ minWidth: Math.min(width, 640) }} aria-hidden="true">
          <defs>
            <marker id="list-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
            </marker>
          </defs>

          {state.nodes.map((node) => {
            const from = position.get(node.id)
            const to = node.next === null ? undefined : position.get(node.next)
            if (from === undefined || to === undefined) return null
            const startX = x(from) + VALUE_WIDTH + (BOX_WIDTH - VALUE_WIDTH) / 2
            const y = TOP + BOX_HEIGHT / 2
            const path =
              to === from + 1
                ? `M ${startX} ${y} L ${x(to) - 4} ${y}`
                : (() => {
                    const depth = 24 + Math.abs(to - from) * 10
                    const endX = x(to) + BOX_WIDTH / 2
                    const bottom = TOP + BOX_HEIGHT
                    return `M ${startX} ${bottom} C ${startX} ${bottom + depth}, ${endX} ${bottom + depth}, ${endX} ${bottom + 4}`
                  })()
            return (
              <path
                key={`${node.id}-${node.next}`}
                d={path}
                fill="none"
                stroke="currentColor"
                strokeWidth={active.has(node.id) ? 2.5 : 1.5}
                className="text-muted-foreground"
                markerEnd="url(#list-arrow)"
              />
            )
          })}

          {state.nodes.map((node, index) => {
            const tag = state.tags[node.id]
            const focused = active.has(node.id)
            const stroke = focused ? ACTIVE.color : tag === undefined ? 'var(--border)' : TAG_STYLE[tag].color
            return (
              <g
                key={node.id}
                className="transition-transform duration-300 motion-reduce:transition-none"
                style={{ transform: `translate(${x(index)}px, ${TOP}px)` }}
                opacity={tag === 'removed' ? 0.45 : 1}
              >
                <text x={BOX_WIDTH / 2} y={-26} textAnchor="middle" className="fill-primary font-mono text-[10px]">
                  {labelsAt.get(node.id)?.join(' ')}
                </text>
                <text x={BOX_WIDTH / 2} y={-8} textAnchor="middle" fontSize={12} fill={stroke}>
                  {focused ? ACTIVE.glyph : tag === undefined ? '' : TAG_STYLE[tag].glyph}
                </text>
                <rect width={BOX_WIDTH} height={BOX_HEIGHT} fill="var(--card)" stroke={stroke} strokeWidth={focused ? 2.5 : 1.5} />
                <line x1={VALUE_WIDTH} x2={VALUE_WIDTH} y1={0} y2={BOX_HEIGHT} stroke="var(--border)" />
                <text x={VALUE_WIDTH / 2} y={BOX_HEIGHT / 2 + 4} textAnchor="middle" className="fill-foreground font-mono text-xs">
                  {node.value}
                </text>
                {node.next === null && (
                  <text x={VALUE_WIDTH + (BOX_WIDTH - VALUE_WIDTH) / 2} y={BOX_HEIGHT / 2 + 4} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">
                    ∅
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
      <Legend tags={Object.values(state.tags)} extra={[{ glyph: '∅', label: 'null link', color: 'var(--muted-foreground)' }]} />
    </div>
  )
}
