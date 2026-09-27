'use client'

import { useEffect } from 'react'

/**
 * The app's backdrop: a faint dot field, a soft spotlight that follows the
 * pointer, and the dots under it lit a little brighter.
 *
 * One pointer listener, writes batched to one per frame, and only CSS custom
 * properties change — nothing re-renders. Touch devices get the static dots
 * only (see app.css).
 */
export function AmbientBackground() {
  useEffect(() => {
    const root = document.documentElement
    let frame = 0
    let last: PointerEvent | null = null

    const apply = () => {
      frame = 0
      if (!last) return
      root.style.setProperty('--cursor-x', `${String(last.clientX)}px`)
      root.style.setProperty('--cursor-y', `${String(last.clientY)}px`)
      root.style.setProperty('--cursor-on', '1')
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      last = e
      if (!frame) frame = requestAnimationFrame(apply)
    }
    const onLeave = () => root.style.setProperty('--cursor-on', '0')

    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      root.style.removeProperty('--cursor-on')
    }
  }, [])

  return (
    <div aria-hidden="true" className="ambient">
      <div className="ambient__dots" />
      <div className="ambient__lit" />
      <div className="ambient__glow" />
    </div>
  )
}
