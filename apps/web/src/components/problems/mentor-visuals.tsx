import { AlertTriangle, Info, Lightbulb, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Pictures for the mentor's answers.
 *
 * The model answers in prose. These read that prose for the shapes it already
 * has — a big-O, a run of numbers, a sequence of steps — and draw them, so the
 * answer can be taken in at a glance before it is read. Anything that does not
 * parse falls back to the text as written: a picture is never a guess.
 */

const COMPLEXITY_CLASSES = ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n²)', 'O(2ⁿ)'] as const

/** Which class a big-O expression falls in, or null when it is not one we can place. */
export function complexityClass(text: string): number | null {
  const match = /O\(([^()]*(?:\([^()]*\)[^()]*)*)\)/.exec(text)
  if (!match) return null
  const body = (match[1] ?? '').toLowerCase().replace(/[\s·*]/g, '').replace('²', '^2')
  if (/^1$/.test(body)) return 0
  if (/!|\^n|2\^/.test(body)) return 5
  if (/\^[2-9]|^([a-z])\1$|^n[mk]$|^[mk]n$/.test(body)) return 4
  if (/log/.test(body)) return /^log[a-z]*$/.test(body) ? 1 : 3
  if (/^[a-z](\+[a-z])*$/.test(body)) return 2
  return null
}

/** Six cells from constant to exponential, the answer's own class lit. */
export function ComplexityScale({ label, value }: { label: string; value: string }) {
  const index = complexityClass(value)
  return (
    <div className="border-border bg-background border p-3">
      <MentorLabel>{label}</MentorLabel>
      {index !== null && (
        <div className="mt-2 grid grid-cols-6 gap-1" role="img" aria-label={`${label}: ${COMPLEXITY_CLASSES[index] ?? ''}`}>
          {COMPLEXITY_CLASSES.map((name, position) => (
            <div key={name} className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'h-2 w-full',
                  position === index ? SCALE_TONE[position] : position < index ? 'bg-muted-foreground/25' : 'bg-muted',
                )}
              />
              <span
                className={cn(
                  'font-mono text-[10px] whitespace-nowrap',
                  position === index ? 'text-foreground font-semibold' : 'text-muted-foreground/60',
                )}
              >
                {name}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="text-muted-foreground mt-2 text-xs leading-relaxed">{value}</p>
    </div>
  )
}

const SCALE_TONE = ['bg-emerald-400', 'bg-emerald-400', 'bg-lime-400', 'bg-amber-400', 'bg-orange-500', 'bg-red-500']

/** Splits prose into sentences, without breaking inside `O(n log n).` or `e.g.`. */
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z(`])/)
    .map((part) => part.trim())
    .filter(Boolean)
}

/** Numbered steps joined by a rail: an approach reads as a path, not a paragraph. */
export function StepFlow({ title, steps }: { title: string; steps: string[] }) {
  if (steps.length === 0) return null
  return (
    <div>
      <MentorLabel>{title}</MentorLabel>
      <ol className="mt-2 flex flex-col">
        {steps.map((step, index) => (
          <li key={index} className="relative flex gap-3 pb-3 last:pb-0">
            {index < steps.length - 1 && (
              <span aria-hidden="true" className="bg-primary/30 absolute top-6 bottom-0 left-[11px] w-px" />
            )}
            <span className="border-primary/50 bg-primary/10 text-primary grid size-6 shrink-0 place-items-center border font-mono text-[11px]">
              {index + 1}
            </span>
            <p className="pt-0.5 leading-relaxed">
              <RichText text={step} />
            </p>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** The one idea to carry away, set apart from everything that explains it. */
export function Callout({ title, text }: { title: string; text: string }) {
  return (
    <div className="border-primary bg-primary/5 border-l-2 p-3">
      <MentorLabel>
        <span className="flex items-center gap-1.5">
          <Lightbulb className="size-3" aria-hidden="true" /> {title}
        </span>
      </MentorLabel>
      <p className="mt-1 text-[15px] leading-relaxed">
        <RichText text={text} />
      </p>
    </div>
  )
}

/** A worked example on a card, with any run of numbers drawn as array cells. */
export function ExampleCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="border-border bg-background border p-3">
      <MentorLabel>{title}</MentorLabel>
      <div className="mt-2 flex flex-col gap-2 leading-relaxed">
        {sentences(text).map((sentence, index) => (
          <p key={index}>
            <RichText text={sentence} />
          </p>
        ))}
      </div>
    </div>
  )
}

type Severity = 'error' | 'warning' | 'info'

const SEVERITY = {
  error: { icon: XCircle, className: 'border-destructive/50 text-destructive' },
  warning: { icon: AlertTriangle, className: 'border-amber-500/50 text-amber-400' },
  info: { icon: Info, className: 'border-sky-500/50 text-sky-400' },
} satisfies Record<Severity, unknown>

/** One card per pitfall or issue, its icon saying how much it matters. */
export function WarningCards({
  title,
  items,
}: {
  title: string
  items: { text: string; severity?: Severity; line?: number }[]
}) {
  if (items.length === 0) return null
  return (
    <div>
      <MentorLabel>{title}</MentorLabel>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((item, index) => {
          const tone = SEVERITY[item.severity ?? 'warning']
          const Icon = tone.icon
          return (
            <li key={index} className={cn('bg-background flex gap-2 border-l-2 p-2.5', tone.className)}>
              <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p className="text-foreground leading-relaxed">
                {item.line !== undefined && (
                  <span className="bg-muted mr-1.5 px-1 font-mono text-xs">line {item.line}</span>
                )}
                <RichText text={item.text} />
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Which rung of the hint ladder each hint came from, out of the four. */
export function HintLadder({ reached, max }: { reached: number; max: number }) {
  return (
    <div className="flex items-center gap-2" role="img" aria-label={`Hint ${String(reached)} of ${String(max)}`}>
      {Array.from({ length: max }, (_, index) => (
        <span
          key={index}
          className={cn('h-1.5 flex-1', index < reached ? 'bg-primary' : 'bg-muted')}
        />
      ))}
      <span className="text-muted-foreground font-mono text-[10px] whitespace-nowrap uppercase">
        {reached}/{max}
      </span>
    </div>
  )
}

const NUMBER_RUN = /(-?\d+(?:\s*,\s*-?\d+|\s+-?\d+){3,})/

/**
 * Text with `inline code` set in mono and any run of four or more numbers
 * drawn as array cells — `9, 9, 5, 4, 4, 2, 1` is an array, so show one.
 */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/)
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          return (
            <code key={index} className="bg-muted px-1 font-mono text-[0.9em]">
              {part.slice(1, -1)}
            </code>
          )
        }
        return part.split(NUMBER_RUN).map((piece, inner) =>
          inner % 2 === 1 ? <ArrayCells key={`${String(index)}-${String(inner)}`} values={piece.split(/[\s,]+/)} /> : piece,
        )
      })}
    </>
  )
}

function ArrayCells({ values }: { values: string[] }) {
  return (
    <span className="mx-0.5 inline-flex flex-wrap align-middle" role="img" aria-label={values.join(', ')}>
      {values.map((value, index) => (
        <span key={index} className="-ml-px flex flex-col items-center first:ml-0">
          <span className="border-primary/40 bg-primary/10 min-w-7 border px-1.5 py-0.5 text-center font-mono text-xs">
            {value}
          </span>
          <span className="text-muted-foreground/60 font-mono text-[9px]">{index}</span>
        </span>
      ))}
    </span>
  )
}

export function MentorLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-muted-foreground font-mono text-[11px] sm:text-[10px] tracking-[0.14em] uppercase">{children}</h3>
  )
}
