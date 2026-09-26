import type { AlgorithmStep, TreeNode, TreeSnapshot } from '@guruji/algorithms'
import { ACTIVE, Legend, TAG_STYLE } from './tags'

const GAP = 44
const LEVEL = 72
const RADIUS = 17
const MARGIN = 32

/** In-order position gives x, depth gives y: no two nodes can overlap. */
function layout(state: TreeSnapshot): Map<string, { x: number; y: number }> {
  const byId = new Map<string, TreeNode>(state.nodes.map((node) => [node.id, node]))
  const placed = new Map<string, { x: number; y: number }>()
  let column = 0
  const walk = (id: string | null, depth: number): void => {
    if (id === null) return
    const node = byId.get(id)
    if (node === undefined) return
    walk(node.left, depth + 1)
    placed.set(id, { x: MARGIN + column * GAP, y: MARGIN + depth * LEVEL })
    column += 1
    walk(node.right, depth + 1)
  }
  walk(state.root, 0)
  return placed
}

export function TreeCanvas({ step, state }: { step: AlgorithmStep; state: TreeSnapshot }) {
  const active = new Set(step.nodeIds ?? [])
  const at = layout(state)
  const points = [...at.values()]
  const width = Math.max(...points.map((point) => point.x), 0) + MARGIN
  const height = Math.max(...points.map((point) => point.y), 0) + MARGIN + 8

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="mx-auto h-auto w-full" style={{ maxWidth: width * 1.6, minWidth: Math.min(width, 560) }} aria-hidden="true">
          {state.nodes.flatMap((node) =>
            [node.left, node.right].map((child) => {
              const from = at.get(node.id)
              const to = child === null ? undefined : at.get(child)
              if (from === undefined || to === undefined) return null
              return <line key={`${node.id}-${child}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="var(--border)" strokeWidth={1.5} />
            }),
          )}
          {state.nodes.map((node) => {
            const point = at.get(node.id)
            if (point === undefined) return null
            const tag = state.tags[node.id]
            const focused = active.has(node.id)
            const color = focused ? ACTIVE.color : tag === undefined ? 'var(--border)' : TAG_STYLE[tag].color
            return (
              <g key={node.id} transform={`translate(${point.x}, ${point.y})`}>
                <circle
                  r={RADIUS}
                  fill={focused ? 'color-mix(in oklab, var(--primary) 22%, var(--card))' : 'var(--card)'}
                  stroke={color}
                  strokeWidth={focused ? 3 : 1.5}
                  className="transition-[stroke,fill] duration-200 motion-reduce:transition-none"
                />
                <text y={4} textAnchor="middle" className="fill-foreground font-mono text-xs">
                  {node.value}
                </text>
                <text x={RADIUS + 2} y={-RADIUS + 4} fontSize={11} fill={color}>
                  {focused ? ACTIVE.glyph : tag === undefined ? '' : TAG_STYLE[tag].glyph}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <Legend tags={Object.values(state.tags)} />
    </div>
  )
}
