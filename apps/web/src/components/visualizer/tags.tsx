import { TAG_LABEL, type Tag } from '@guruji/algorithms'

/**
 * Every status has a glyph as well as a colour. A red/green-only highlight is
 * unreadable for a real fraction of people, so the glyph carries the meaning
 * and the colour only reinforces it.
 */
export const TAG_STYLE: Record<Tag, { color: string; glyph: string }> = {
  visited: { color: 'var(--mastery-proficient)', glyph: '○' },
  settled: { color: 'var(--mastery-strong)', glyph: '✓' },
  found: { color: 'var(--difficulty-medium)', glyph: '★' },
  pivot: { color: 'var(--difficulty-hard)', glyph: '◆' },
  queued: { color: 'var(--mastery-developing)', glyph: '◷' },
  removed: { color: 'var(--mastery-none)', glyph: '✕' },
}

export const ACTIVE = { color: 'var(--primary)', glyph: '▲', label: 'in focus' }

export function Legend({ tags, extra = [] }: { tags: Iterable<Tag>; extra?: { glyph: string; label: string; color: string }[] }) {
  const entries = [
    ACTIVE,
    ...[...new Set(tags)].map((tag) => ({ ...TAG_STYLE[tag], label: TAG_LABEL[tag] })),
    ...extra,
  ]
  return (
    <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px]" aria-label="Legend">
      {entries.map((entry) => (
        <li key={entry.label} className="flex items-center gap-1.5">
          <span aria-hidden="true" style={{ color: entry.color }}>
            {entry.glyph}
          </span>
          {entry.label}
        </li>
      ))}
    </ul>
  )
}
