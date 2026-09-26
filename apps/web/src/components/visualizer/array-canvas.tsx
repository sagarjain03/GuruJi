import type { AlgorithmStep, ArraySnapshot, Tag } from '@guruji/algorithms'
import { ACTIVE, Legend, TAG_STYLE } from './tags'

const BAR_HEIGHT = 180

export function ArrayCanvas({ step, state }: { step: AlgorithmStep; state: ArraySnapshot }) {
  const magnitude = Math.max(...state.values.map(Math.abs), 1)
  const active = new Set(step.indices ?? [])
  const pointersAt = new Map<number, string[]>()
  for (const [name, index] of Object.entries(state.pointers)) {
    pointersAt.set(index, [...(pointersAt.get(index) ?? []), name])
  }
  const dense = state.values.length > 24

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-64 items-end gap-1 overflow-x-auto p-2 sm:gap-2" aria-hidden="true">
        {state.values.map((value, index) => {
          const tag: Tag | undefined = state.tags[index]
          const focused = active.has(index)
          const color = focused ? ACTIVE.color : tag === undefined ? 'var(--muted-foreground)' : TAG_STYLE[tag].color
          return (
            <div key={index} className="flex min-w-3 flex-1 flex-col items-center gap-1">
              <span className="h-4 text-xs leading-4" style={{ color }}>
                {focused ? ACTIVE.glyph : tag === undefined ? '' : TAG_STYLE[tag].glyph}
              </span>
              {!dense && <span className="font-mono text-xs">{value}</span>}
              <div
                className="w-full transition-[height,background-color,opacity] duration-200 motion-reduce:transition-none"
                style={{
                  height: `${Math.max((Math.abs(value) / magnitude) * BAR_HEIGHT, 6)}px`,
                  backgroundColor: color,
                  opacity: focused || tag !== undefined ? (tag === 'removed' ? 0.35 : 1) : 0.45,
                  outline: focused ? `2px solid ${ACTIVE.color}` : undefined,
                  outlineOffset: 2,
                }}
              />
              <span className="text-muted-foreground font-mono text-[10px]">{index}</span>
              <span className="text-primary h-3 font-mono text-[10px] leading-3">{pointersAt.get(index)?.join(' ')}</span>
            </div>
          )
        })}
      </div>
      <Legend tags={Object.values(state.tags)} />
    </div>
  )
}
