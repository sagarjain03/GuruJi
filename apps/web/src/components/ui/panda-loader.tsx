import { PANDA_FACE, PANDA_INK, PANDA_LIGHT, PANDA_SILHOUETTE } from '@/components/panda-mark'
import { cn } from '@/lib/utils'

/**
 * The brand panda, headphones on, nodding along while something loads.
 *
 * Only the face: it bobs twice per bar and tilts side to side, sound rings off
 * both ear cups on every beat, and a note drifts up now and then. The rings
 * sit inside the nodding group so they leave the cups wherever the head is.
 * Motion lives in app.css under `prefers-reduced-motion: no-preference`; with
 * reduced motion the panda just listens, still.
 */
export function PandaLoader({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn('panda-loader flex flex-col items-center gap-3', className)}>
      <svg viewBox="-48 -56 352 336" className="size-28 overflow-visible" aria-hidden="true">
        <ellipse className="panda-loader__shadow" cx={128} cy={252} rx={78} ry={9} fill="currentColor" opacity={0.18} />

        <g className="panda-loader__head">
          <Waves side="left" />
          <Waves side="right" />
          <path d={PANDA_SILHOUETTE} fill={PANDA_INK} />
          <path d={PANDA_FACE} fill={PANDA_LIGHT} />
        </g>

        <Note className="panda-loader__note panda-loader__note--left" x={22} y={20} />
        <Note className="panda-loader__note panda-loader__note--right" x={214} y={8} />
      </svg>
      <span className="text-muted-foreground text-sm">{label}</span>
    </div>
  )
}

/** Two rings off one ear cup; the outer one a beat-fraction behind the inner. */
function Waves({ side }: { side: 'left' | 'right' }) {
  // Ear cup centres, read off the mark: (20, 137) and (237, 137).
  const [cx, out] = side === 'left' ? [20, -1] : [237, 1]
  const arc = (reach: number, spread: number) =>
    `M${cx + out * reach} ${137 - spread} Q${cx + out * (reach + spread * 0.55)} 137 ${cx + out * reach} ${137 + spread}`
  return (
    <g
      className={`panda-loader__waves panda-loader__waves--${side}`}
      fill="none"
      stroke="var(--primary)"
      strokeWidth={7}
      strokeLinecap="round"
    >
      <path className="panda-loader__wave" d={arc(26, 22)} />
      <path className="panda-loader__wave panda-loader__wave--outer" d={arc(44, 34)} />
    </g>
  )
}

/** An eighth note, drawn rather than typed so it looks the same in every font. */
function Note({ x, y, className }: { x: number; y: number; className: string }) {
  return (
    <g className={className} fill="var(--primary)" stroke="var(--primary)">
      <g transform={`translate(${x} ${y})`}>
        <ellipse cx={0} cy={30} rx={11} ry={8} transform="rotate(-20 0 30)" stroke="none" />
        <path d="M9 28V-6q12 4 16 16" fill="none" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  )
}
