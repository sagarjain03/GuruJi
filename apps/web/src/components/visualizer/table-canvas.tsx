import type { AlgorithmStep, TableSnapshot } from '@guruji/algorithms'
import { ACTIVE, Legend } from './tags'

const READ = { glyph: '◂', label: 'read by the cell in focus', color: 'var(--mastery-proficient)' }

/**
 * The cell being written is filled and marked ▲; the cells it reads are
 * outlined and marked ◂. That pair is the dependency the recurrence encodes.
 */
export function TableCanvas({ step, state }: { step: AlgorithmStep; state: TableSnapshot }) {
  const [target, ...reads] = step.cells ?? []
  const isTarget = (row: number, column: number) => target?.[0] === row && target[1] === column
  const isRead = (row: number, column: number) => reads.some(([r, c]) => r === row && c === column)

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto" aria-hidden="true">
        <table className="mx-auto border-collapse font-mono text-xs">
          <thead>
            <tr>
              <th className="p-1" />
              {state.columnLabels.map((label, column) => (
                <th key={column} className="text-muted-foreground min-w-9 p-1 text-center text-[10px] font-normal">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.cells.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th className="text-muted-foreground p-1 pr-2 text-right text-[10px] font-normal whitespace-nowrap">
                  {state.rowLabels[rowIndex]}
                </th>
                {row.map((cell, column) => {
                  const written = isTarget(rowIndex, column)
                  const read = isRead(rowIndex, column)
                  return (
                    <td
                      key={column}
                      className="border-border relative h-9 min-w-9 border text-center transition-colors duration-200 motion-reduce:transition-none"
                      style={{
                        backgroundColor: written ? 'color-mix(in oklab, var(--primary) 30%, transparent)' : undefined,
                        outline: written ? `2px solid ${ACTIVE.color}` : read ? `2px dashed ${READ.color}` : undefined,
                        outlineOffset: -2,
                      }}
                    >
                      {cell ?? ''}
                      {(written || read) && (
                        <span className="absolute top-0 right-0.5 text-[9px] leading-3" style={{ color: written ? ACTIVE.color : READ.color }}>
                          {written ? ACTIVE.glyph : READ.glyph}
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Legend tags={[]} extra={[READ]} />
    </div>
  )
}
