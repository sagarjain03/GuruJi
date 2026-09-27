'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

/**
 * Thin Recharts wrappers in the app's own tokens. Colours come from CSS
 * variables so light and dark themes need nothing here; series are also told
 * apart by position, label and dash pattern, never by colour alone.
 */

const AXIS = { stroke: 'var(--muted-foreground)', fontSize: 11 }
const GRID = { stroke: 'var(--border)', strokeDasharray: '3 3' }
const TOOLTIP = {
  contentStyle: {
    background: 'var(--popover)',
    border: '1px solid var(--border)',
    borderRadius: 0,
    fontSize: 12,
    color: 'var(--popover-foreground)',
  },
  cursor: { fill: 'color-mix(in oklab, var(--primary) 10%, transparent)' },
}

/** Rows are plain records: Recharts reads them by key, and so do the data tables. */
type Row = Record<string, unknown>

export interface Series {
  key: string
  name: string
  color: string
  dashed?: boolean
}

/** Horizontal bars: one row per category, long labels on the left. */
export function HorizontalBars({
  data,
  labelKey,
  series,
  max,
  format = String,
}: {
  data: Row[]
  labelKey: string
  series: Series[]
  max?: number
  format?: (value: number) => string
}) {
  const height = Math.max(160, data.length * (series.length > 1 ? 34 : 26) + 48)
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid {...GRID} horizontal={false} />
          {/* Every value charted here is a count, a score or a whole percentage. */}
          <XAxis type="number" domain={[0, max ?? 'auto']} allowDecimals={false} tickFormatter={format} {...AXIS} />
          <YAxis type="category" dataKey={labelKey} width={128} interval={0} {...AXIS} />
          <Tooltip {...TOOLTIP} formatter={(value) => format(Number(value))} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {series.map((item) => (
            <Bar key={item.key} dataKey={item.key} name={item.name} fill={item.color} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Vertical grouped bars for a handful of categories. */
export function ColumnBars({ data, labelKey, series }: { data: Row[]; labelKey: string; series: Series[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
          <CartesianGrid {...GRID} vertical={false} />
          <XAxis dataKey={labelKey} {...AXIS} />
          <YAxis allowDecimals={false} {...AXIS} />
          <Tooltip {...TOOLTIP} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {series.map((item) => (
            <Bar key={item.key} dataKey={item.key} name={item.name} fill={item.color} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** A line per series over time. Gaps (null) stay gaps: no data is not zero. */
export function TrendLines({
  data,
  labelKey,
  series,
  domain,
  format = String,
  formatLabel = String,
}: {
  data: Row[]
  labelKey: string
  series: Series[]
  domain?: [number, number]
  format?: (value: number) => string
  formatLabel?: (label: string) => string
}) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey={labelKey} tickFormatter={(value) => formatLabel(String(value))} minTickGap={24} {...AXIS} />
          <YAxis domain={domain ?? ['auto', 'auto']} tickFormatter={format} {...AXIS} />
          <Tooltip
            {...TOOLTIP}
            labelFormatter={(label) => formatLabel(String(label))}
            formatter={(value) => format(Number(value))}
          />
          {series.map((item) => (
            <Line
              key={item.key}
              dataKey={item.key}
              name={item.name}
              stroke={item.color}
              strokeWidth={2}
              {...(item.dashed === true ? { strokeDasharray: '6 4' } : {})}
              dot={{ r: 3 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
