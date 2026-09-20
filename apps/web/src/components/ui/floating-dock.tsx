'use client'

import type { LucideIcon } from 'lucide-react'
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from 'motion/react'
import Link from 'next/link'
import { createContext, useContext, useRef, useState } from 'react'
import { GlowingEffect } from '@/components/ui/glowing-effect'
import { cn } from '@/lib/utils'

/**
 * Resting and magnified tile size, in px.
 *
 * `max` is `base` plus twice the rail's padding, so a magnified tile grows out
 * to exactly the rail's inner edges and never past them.
 */
const SIZE = { base: 40, max: 56 }
const ICON = { base: 18, max: 24 }
/** Distance from a tile's centre, in px, at which magnification has died out. */
const FALLOFF = 110

/**
 * Pointer position shared with every tile. `Infinity` means "no pointer here",
 * which lands outside every tile's falloff and so resolves to the resting size.
 */
const PointerY = createContext<MotionValue<number> | null>(null)

/**
 * A vertical magnifying dock, macOS style.
 *
 * Tiles grow towards the pointer, but only downwards through the rail — the
 * rail's own width never changes. An earlier version let the tiles widen in
 * flow, which widened the rail, which reflowed the entire page on every mouse
 * move. Magnification is decoration; it must not be able to move the document.
 */
export function FloatingDock({ children, className, ...props }: React.ComponentProps<'nav'>) {
  const pointerY = useMotionValue(Number.POSITIVE_INFINITY)

  return (
    <PointerY.Provider value={pointerY}>
      <nav
        {...props}
        onPointerMove={(e) => pointerY.set(e.clientY)}
        onPointerLeave={() => pointerY.set(Number.POSITIVE_INFINITY)}
        className={cn(
          'border-border/60 bg-card/70 relative flex w-14 flex-col items-center gap-1 rounded-full border p-2 backdrop-blur-xl',
          className,
        )}
      >
        <GlowingEffect disabled={false} glow spread={38} proximity={72} inactiveZone={0.01} />
        {children}
      </nav>
    </PointerY.Provider>
  )
}

/**
 * Generic over the route, exactly as `Link` is.
 *
 * `typedRoutes` makes `Link`'s `href` a generic that infers the literal route.
 * Pinning it to `ComponentProps<typeof Link>` collapses that to
 * `RouteImpl<unknown>`, and then no real route is assignable — the failure only
 * shows up once the nav has more than one live destination, which is exactly
 * when it is least expected. The type parameter lets the inference flow through
 * instead of being thrown away, so a link to a page that does not exist stays a
 * compile error.
 */
interface DockItemProps<TRoute> {
  label: string
  Icon?: LucideIcon | undefined
  /** Rendered instead of `Icon` — used for the avatar tile. */
  children?: React.ReactNode | undefined
  href?: React.ComponentProps<typeof Link<TRoute>>['href'] | undefined
  active?: boolean | undefined
  /** Shown, but inert: the route exists in the design and not yet in the app. */
  disabled?: boolean | undefined
}

export function DockItem<TRoute>({
  label,
  Icon,
  children,
  href,
  active,
  disabled,
}: DockItemProps<TRoute>) {
  const pointerY = useContext(PointerY)
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)

  const fallback = useMotionValue(Number.POSITIVE_INFINITY)
  const distance = useTransform(pointerY ?? fallback, (y) => {
    const bounds = ref.current?.getBoundingClientRect()
    if (!bounds) return Number.POSITIVE_INFINITY
    return y - bounds.top - bounds.height / 2
  })

  const spring = { mass: 0.1, stiffness: 150, damping: 12 }
  const size = useSpring(
    useTransform(distance, [-FALLOFF, 0, FALLOFF], [SIZE.base, SIZE.max, SIZE.base]),
    spring,
  )
  const iconSize = useSpring(
    useTransform(distance, [-FALLOFF, 0, FALLOFF], [ICON.base, ICON.max, ICON.base]),
    spring,
  )

  // Reduced motion gets the labels and the colour changes, but nothing moves.
  const tile = reduced ? { width: SIZE.base, height: SIZE.base } : { width: size, height: size }
  const glyph = reduced
    ? { width: ICON.base, height: ICON.base }
    : { width: iconSize, height: iconSize }
  const slot = reduced ? { height: SIZE.base } : { height: size }

  const face = cn(
    'grid size-full place-items-center rounded-full transition-colors',
    disabled
      ? 'text-muted-foreground/25 cursor-not-allowed'
      : href
        ? active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        : 'bg-primary text-primary-foreground',
  )

  const body = (
    <>
      <motion.span style={glyph} className="grid place-items-center">
        {Icon ? <Icon className="size-full" /> : children}
      </motion.span>
      <span className="sr-only">{disabled ? `${label} (not built yet)` : label}</span>
    </>
  )

  return (
    // The slot holds the row's width at the resting size and only its height
    // follows the pointer, so the ripple stays inside the rail.
    <motion.div
      ref={ref}
      style={slot}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      className="relative w-10 shrink-0"
    >
      <motion.div
        style={tile}
        aria-disabled={disabled ? 'true' : undefined}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
      >
        {disabled || !href ? (
          <span className={face}>{body}</span>
        ) : (
          <Link href={href} aria-current={active ? 'page' : undefined} className={face}>
            {body}
          </Link>
        )}
      </motion.div>

      <AnimatePresence>
        {hovered && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            className="border-border/60 bg-popover text-popover-foreground pointer-events-none absolute top-1/2 left-full z-20 ml-5 -translate-y-1/2 rounded-full border px-3 py-1 text-xs whitespace-nowrap"
          >
            {label}
            {disabled && <span className="text-muted-foreground"> — soon</span>}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
