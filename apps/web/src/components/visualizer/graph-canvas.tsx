import type { AlgorithmStep, EdgeState, GraphSnapshot } from '@guruji/algorithms'
import { ACTIVE, Legend, TAG_STYLE } from './tags'

const SIZE = 420
const RADIUS = 18

/** Edge status is carried by dash pattern and width, not just colour. */
const EDGE_STYLE: Record<EdgeState, { stroke: string; width: number; dash?: string }> = {
  idle: { stroke: 'var(--muted-foreground)', width: 1.25 },
  active: { stroke: 'var(--primary)', width: 3, dash: '6 4' },
  used: { stroke: 'var(--mastery-strong)', width: 3.5 },
  rejected: { stroke: 'var(--destructive)', width: 1.5, dash: '2 4' },
}

/** Nodes evenly on a circle, first node at the top. Deterministic across steps. */
function layout(nodes: string[]): Map<string, { x: number; y: number }> {
  const centre = SIZE / 2
  const ring = nodes.length === 1 ? 0 : centre - RADIUS - 28
  return new Map(
    nodes.map((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length - Math.PI / 2
      return [node, { x: centre + ring * Math.cos(angle), y: centre + ring * Math.sin(angle) }]
    }),
  )
}

export function GraphCanvas({ step, state }: { step: AlgorithmStep; state: GraphSnapshot }) {
  const active = new Set(step.nodeIds ?? [])
  const at = layout(state.nodes)

  return (
    <div className="flex flex-col gap-3">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto h-auto w-full max-w-[480px]" aria-hidden="true">
        <defs>
          <marker id="graph-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
          </marker>
        </defs>

        {state.edges.map((edge, index) => {
          const from = at.get(edge.from)
          const to = at.get(edge.to)
          if (from === undefined || to === undefined) return null
          const length = Math.hypot(to.x - from.x, to.y - from.y) || 1
          const ux = (to.x - from.x) / length
          const uy = (to.y - from.y) / length
          const style = EDGE_STYLE[edge.state]
          const midX = (from.x + to.x) / 2
          const midY = (from.y + to.y) / 2
          return (
            <g key={`${edge.from}-${edge.to}-${index}`}>
              <line
                x1={from.x + ux * RADIUS}
                y1={from.y + uy * RADIUS}
                x2={to.x - ux * (RADIUS + 2)}
                y2={to.y - uy * (RADIUS + 2)}
                stroke={style.stroke}
                strokeWidth={style.width}
                strokeDasharray={style.dash}
                markerEnd={state.directed ? 'url(#graph-arrow)' : undefined}
                className="transition-[stroke,stroke-width] duration-200 motion-reduce:transition-none"
              />
              {(edge.weight !== undefined || edge.state === 'rejected') && (
                <g transform={`translate(${midX}, ${midY})`}>
                  <rect x={-12} y={-9} width={24} height={16} fill="var(--card)" />
                  <text y={3} textAnchor="middle" className="font-mono text-[10px]" fill={style.stroke}>
                    {edge.state === 'rejected' ? '✕' : ''}
                    {edge.weight ?? ''}
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {state.nodes.map((node) => {
          const point = at.get(node)
          if (point === undefined) return null
          const tag = state.tags[node]
          const focused = active.has(node)
          const color = focused ? ACTIVE.color : tag === undefined ? 'var(--border)' : TAG_STYLE[tag].color
          const label = state.labels[node]
          return (
            <g key={node} transform={`translate(${point.x}, ${point.y})`}>
              <circle
                r={RADIUS}
                fill={focused ? 'color-mix(in oklab, var(--primary) 22%, var(--card))' : 'var(--card)'}
                stroke={color}
                strokeWidth={focused ? 3 : 1.75}
                className="transition-[stroke,fill] duration-200 motion-reduce:transition-none"
              />
              <text y={4} textAnchor="middle" className="fill-foreground font-mono text-xs font-semibold">
                {node}
              </text>
              <text x={RADIUS} y={-RADIUS + 2} fontSize={11} fill={color}>
                {focused ? ACTIVE.glyph : tag === undefined ? '' : TAG_STYLE[tag].glyph}
              </text>
              {label !== undefined && (
                <text y={RADIUS + 13} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">
                  {label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <Legend
        tags={Object.values(state.tags)}
        extra={[
          { glyph: '━', label: 'edge used', color: EDGE_STYLE.used.stroke },
          { glyph: '╍', label: 'edge in focus', color: EDGE_STYLE.active.stroke },
          { glyph: '✕', label: 'edge rejected', color: EDGE_STYLE.rejected.stroke },
        ]}
      />
    </div>
  )
}
