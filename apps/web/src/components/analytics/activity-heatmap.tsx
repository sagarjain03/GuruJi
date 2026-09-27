import type { ActivityDay } from '@guruji/types'
import { addDays, formatDay, formatMonth, parseDay } from './format'

const CELL = 11
const GAP = 3
const STEP = CELL + GAP
const LEFT = 28
const TOP = 16
const WEEKDAYS = ['Mon', '', 'Wed', '', 'Fri', '', '']

/**
 * Intensity follows problems *solved*; a day with attempts but no solve gets
 * the faintest shade, so trying still shows up without looking like success.
 */
function level(day: ActivityDay | undefined): number {
  if (day === undefined || day.attempted === 0) return 0
  if (day.solved === 0) return 1
  if (day.solved === 1) return 2
  if (day.solved <= 3) return 3
  return 4
}

const SHADE = [
  'var(--muted)',
  'color-mix(in oklab, var(--primary) 22%, var(--muted))',
  'color-mix(in oklab, var(--primary) 45%, var(--muted))',
  'color-mix(in oklab, var(--primary) 72%, var(--muted))',
  'var(--primary)',
]

const LEVEL_LABEL = ['no activity', 'attempted, none solved', '1 solved', '2–3 solved', '4+ solved']

/** Monday-first weeks as columns, GitHub-style, in UTC days. */
export function ActivityHeatmap({ from, to, days }: { from: string; to: string; days: ActivityDay[] }) {
  const byDate = new Map(days.map((day) => [day.date, day]))
  const firstMonday = addDays(from, -((parseDay(from).getUTCDay() + 6) % 7))

  const cells: { date: string; column: number; row: number; day: ActivityDay | undefined }[] = []
  for (let date = firstMonday, index = 0; date <= to; date = addDays(date, 1), index += 1) {
    if (date >= from) cells.push({ date, column: Math.floor(index / 7), row: index % 7, day: byDate.get(date) })
  }
  const columns = (cells.at(-1)?.column ?? 0) + 1

  const months: { column: number; label: string }[] = []
  for (const cell of cells) {
    if (cell.row === 0 && months.at(-1)?.label !== formatMonth(cell.date)) {
      // A month that only got a column or two at the start has no room for its
      // label; the next month's label takes its place instead of overlapping it.
      const previous = months.at(-1)
      if (previous !== undefined && cell.column - previous.column < 3) months.pop()
      months.push({ column: cell.column, label: formatMonth(cell.date) })
    }
  }

  const activeDays = days.filter((day) => day.attempted > 0).length
  const solved = days.reduce((total, day) => total + day.solved, 0)
  const summary = `${activeDays} active day${activeDays === 1 ? '' : 's'} and ${solved} solve${solved === 1 ? '' : 's'} between ${formatDay(from)} and ${formatDay(to)}.`

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <svg
          role="img"
          aria-label={summary}
          width={LEFT + columns * STEP}
          height={TOP + 7 * STEP}
          className="font-mono"
        >
          {months.map((month) => (
            <text key={`${month.column}-${month.label}`} x={LEFT + month.column * STEP} y={10} className="fill-muted-foreground text-[9px]">
              {month.label}
            </text>
          ))}
          {WEEKDAYS.map((label, row) => (
            <text key={row} x={0} y={TOP + row * STEP + CELL - 2} className="fill-muted-foreground text-[9px]">
              {label}
            </text>
          ))}
          {cells.map((cell) => {
            const shade = level(cell.day)
            return (
              <rect
                key={cell.date}
                data-date={cell.date}
                data-level={shade}
                x={LEFT + cell.column * STEP}
                y={TOP + cell.row * STEP}
                width={CELL}
                height={CELL}
                fill={SHADE[shade]}
              >
                <title>
                  {`${formatDay(cell.date)}: ${cell.day?.attempted ?? 0} attempted, ${cell.day?.solved ?? 0} solved`}
                </title>
              </rect>
            )
          })}
        </svg>
      </div>
      <p className="text-muted-foreground text-xs">{summary}</p>
      <ul className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px]" aria-label="Legend">
        {SHADE.map((fill, index) => (
          <li key={index} className="flex items-center gap-1">
            <svg width={CELL} height={CELL} aria-hidden="true">
              <rect width={CELL} height={CELL} fill={fill} />
            </svg>
            {LEVEL_LABEL[index]}
          </li>
        ))}
      </ul>
    </div>
  )
}
