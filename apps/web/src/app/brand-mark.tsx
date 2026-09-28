import { PANDA_FACE, PANDA_INK, PANDA_LIGHT, PANDA_SILHOUETTE, PANDA_VIEWBOX } from '@/components/panda-mark'

/**
 * The panda mark for generated images (apple-icon, opengraph-image). Same
 * paths as `Logo` in components/icons.tsx; its colours are already fixed,
 * which is what ImageResponse needs — it has no stylesheet or `currentColor`.
 */
export function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox={PANDA_VIEWBOX}>
      <path d={PANDA_SILHOUETTE} fill={PANDA_INK} fillRule="evenodd" />
      <path d={PANDA_FACE} fill={PANDA_LIGHT} fillRule="evenodd" />
    </svg>
  )
}
