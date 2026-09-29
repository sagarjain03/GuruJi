import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface DataRow {
  label: string
  values: string[]
}

/**
 * A titled chart with its three other states — loading, failed, empty — and
 * the same numbers as a table behind a disclosure. The table is what makes a
 * chart readable without sight, and it is also the honest answer to "what
 * exactly is that bar".
 */
export function ChartPanel({
  title,
  description,
  isLoading,
  isError,
  isEmpty,
  emptyMessage,
  columns,
  rows,
  className,
  children,
}: {
  title: string
  description: string
  isLoading: boolean
  isError: boolean
  isEmpty: boolean
  emptyMessage: string
  columns: string[]
  rows: DataRow[]
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn('surface border-border bg-card/70 flex min-w-0 flex-col gap-3 border p-5', className)}>
      <header>
        <h2 className="font-display text-base font-semibold tracking-tight">{title}</h2>
        <p className="text-muted-foreground mt-1 text-xs">{description}</p>
      </header>

      {isLoading ? (
        <Skeleton className="h-56 w-full" />
      ) : isError ? (
        <p role="alert" className="text-destructive text-sm">
          Could not load this chart. Refresh to try again.
        </p>
      ) : isEmpty ? (
        <p className="text-muted-foreground flex h-32 items-center justify-center border border-dashed text-center text-sm">
          {emptyMessage}
        </p>
      ) : (
        <>
          {children}
          <details className="text-xs">
            <summary className="text-muted-foreground hover:text-foreground cursor-pointer font-mono text-[11px] sm:text-[10px] tracking-[0.14em] uppercase">
              Show data
            </summary>
            <div className="mt-2 max-h-64 overflow-auto">
              <table className="w-full border-collapse font-mono text-[11px]">
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <th key={column} scope="col" className="text-muted-foreground border-b py-1 pr-3 text-left font-normal">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.label}>
                      <th scope="row" className="border-border/50 border-b py-1 pr-3 text-left font-normal">
                        {row.label}
                      </th>
                      {row.values.map((value, index) => (
                        <td key={index} className="border-border/50 border-b py-1 pr-3">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  )
}
