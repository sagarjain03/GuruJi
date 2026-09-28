'use client'

import type { AchievementTier } from '@guruji/types'
import {
  Brain,
  Compass,
  Flame,
  Languages,
  NotebookPen,
  Puzzle,
  RotateCcw,
  ShieldCheck,
  Skull,
  Sparkles,
  Timer,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * A struck metal token: an octagon, like a machinist's stamp, rather than the
 * round medal every other product ships. The rim is eight bevelled facets lit
 * from the top left, the face is the tier's metal, the glyph is engraved into
 * it, and notches under the glyph count the tier — so the tier reads without
 * colour. Locked, it is dark gunmetal with the progress run around its rim.
 */

const ICONS: Record<string, LucideIcon> = {
  zap: Zap,
  brain: Brain,
  puzzle: Puzzle,
  compass: Compass,
  flame: Flame,
  skull: Skull,
  shield: ShieldCheck,
  rotate: RotateCcw,
  notebook: NotebookPen,
  timer: Timer,
  sparkles: Sparkles,
  languages: Languages,
}

export const TIER_LABEL: Record<AchievementTier, string> = {
  BRONZE: 'Bronze',
  SILVER: 'Silver',
  GOLD: 'Gold',
  PLATINUM: 'Platinum',
}

const TIER_RANK: Record<AchievementTier, number> = { BRONZE: 1, SILVER: 2, GOLD: 3, PLATINUM: 4 }

interface Metal {
  /** Face gradient, dark to light. */
  face: [string, string, string]
  /** Rim facet colour lit and in shadow. */
  lit: string
  shade: string
  /** The engraving: the cut, and the light catching its lower edge. */
  cut: string
  catch: string
}

const METALS: Record<AchievementTier | 'LOCKED', Metal> = {
  BRONZE: { face: ['#5c3517', '#b0703a', '#e9b37a'], lit: '#f0c08a', shade: '#4a2a12', cut: '#4a2a12', catch: '#f6cf9f' },
  SILVER: { face: ['#6b7078', '#c3c8cf', '#f4f6f8'], lit: '#ffffff', shade: '#5a5f67', cut: '#4b5058', catch: '#ffffff' },
  GOLD: { face: ['#7a520c', '#d9a431', '#ffe79a'], lit: '#fff0b8', shade: '#654307', cut: '#5e3e05', catch: '#fff6cf' },
  // Cool, faintly violet: the one metal that borrows the product's own colour.
  PLATINUM: { face: ['#5b6478', '#b9c3d9', '#f1f0ff'], lit: '#ffffff', shade: '#4a5266', cut: '#3d4459', catch: '#ece6ff' },
  LOCKED: { face: ['#15151a', '#1f1f26', '#2a2a33'], lit: '#34343f', shade: '#0c0c10', cut: '#0d0d11', catch: '#3a3a46' },
}

const CENTRE = 50
/** An octagon with flat top and bottom, points from angle 22.5° in 45° steps. */
function octagon(radius: number): [number, number][] {
  return Array.from({ length: 8 }, (_, index) => {
    const angle = ((22.5 + index * 45) * Math.PI) / 180
    return [CENTRE + radius * Math.cos(angle), CENTRE + radius * Math.sin(angle)]
  })
}
const points = (corners: [number, number][]) => corners.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')

const OUTER = octagon(48)
const INNER = octagon(39)
/** Light from the top left: a facet facing that way is lit, facing away is in shade. */
const LIGHT = (225 * Math.PI) / 180

export function Medallion({
  icon,
  tier,
  progress = null,
  size = 96,
  celebrate = false,
  className,
}: {
  icon: string
  /** Earned tier, or null for locked. */
  tier: AchievementTier | null
  /** 0..1 toward the next tier, drawn around a locked rim. */
  progress?: number | null
  size?: number
  /** Plays the one-time strike and shine; reduced motion shows the finished state. */
  celebrate?: boolean
  className?: string
}) {
  const id = useId().replace(/:/g, '')
  const metal = METALS[tier ?? 'LOCKED']
  const Glyph = ICONS[icon] ?? Sparkles
  const rank = tier === null ? 0 : TIER_RANK[tier]

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      className={cn('medallion shrink-0 overflow-visible', celebrate && 'medallion-celebrate', className)}
    >
      <defs>
        <linearGradient id={`${id}-face`} x1="0.15" y1="0.1" x2="0.85" y2="0.95">
          <stop offset="0" stopColor={metal.face[2]} />
          <stop offset="0.45" stopColor={metal.face[1]} />
          <stop offset="1" stopColor={metal.face[0]} />
        </linearGradient>
        {/* Brushed finish: faint horizontal grain across the face. */}
        <pattern id={`${id}-grain`} width="4" height="1.6" patternUnits="userSpaceOnUse">
          <rect width="4" height="0.5" fill="#fff" opacity={tier === null ? 0.02 : 0.09} />
        </pattern>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <polygon points={points(OUTER)} />
        </clipPath>
      </defs>

      {/* A soft shadow under the token, so it sits on the page rather than in it. */}
      <polygon points={points(OUTER)} transform="translate(0 2.5)" fill="#000" opacity="0.35" />

      {/* Rim: eight facets, each shaded by which way it faces. */}
      {OUTER.map((corner, index) => {
        const next = OUTER[(index + 1) % 8] as [number, number]
        const inner = INNER[index] as [number, number]
        const innerNext = INNER[(index + 1) % 8] as [number, number]
        const facing = ((22.5 + index * 45 + 22.5) * Math.PI) / 180
        const light = (Math.cos(facing - LIGHT) + 1) / 2
        return (
          <polygon
            key={index}
            points={points([corner, next, innerNext, inner])}
            fill={light > 0.5 ? metal.lit : metal.shade}
            opacity={0.55 + Math.abs(light - 0.5)}
          />
        )
      })}

      {/* Face. */}
      <polygon points={points(INNER)} fill={`url(#${id}-face)`} />
      <polygon points={points(INNER)} fill={`url(#${id}-grain)`} />
      {/* The machined edge where rim meets face. */}
      <polygon points={points(INNER)} fill="none" stroke={metal.shade} strokeWidth="0.8" opacity="0.8" />

      {/* Specular highlight, top left. */}
      {tier !== null && (
        <ellipse cx="36" cy="30" rx="20" ry="9" transform="rotate(-35 36 30)" fill="#fff" opacity="0.22" clipPath={`url(#${id}-clip)`} />
      )}

      {/* Engraved glyph: the light catches the lower lip of the cut. */}
      <Glyph x="31" y="27.5" width="38" height="38" stroke={metal.catch} strokeWidth={2.2} opacity={tier === null ? 0.35 : 0.9} />
      <Glyph x="31" y="26.5" width="38" height="38" stroke={metal.cut} strokeWidth={2.2} opacity={tier === null ? 0.9 : 1} />

      {/* Tier notches: one to four, so the tier is readable without colour. */}
      {rank > 0 && (
        <g>
          {Array.from({ length: rank }, (_, index) => {
            const width = 4.5
            const gap = 2.5
            const start = CENTRE - (rank * width + (rank - 1) * gap) / 2
            return (
              <rect key={index} x={start + index * (width + gap)} y="72" width={width} height="2.2" fill={metal.cut} opacity="0.85" />
            )
          })}
        </g>
      )}

      {/* Locked: progress run around the rim in the product's violet. */}
      {tier === null && progress !== null && progress > 0 && (
        <polygon
          points={points(OUTER)}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.4"
          strokeLinejoin="miter"
          pathLength={100}
          strokeDasharray={`${Math.min(progress, 1) * 100} 100`}
        />
      )}

      {/* The one-time shine sweep, clipped to the token. */}
      {celebrate && (
        <g clipPath={`url(#${id}-clip)`}>
          <g className="medallion-shine">
            <rect x="-60" y="-10" width="40" height="120" fill={`url(#${id}-shine)`} transform="rotate(20 50 50)" />
          </g>
        </g>
      )}
    </svg>
  )
}
