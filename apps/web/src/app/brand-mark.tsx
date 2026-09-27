/**
 * The diamond-triad mark for generated images (apple-icon, opengraph-image).
 * Same paths as `Logo` in components/icons.tsx, with fixed colours because
 * ImageResponse has no stylesheet or `currentColor` context.
 */
export function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28">
      <path d="M14 1.6 20.3 8 14 14.4 7.7 8 14 1.6Z" fill="#f2f2f4" />
      <path d="M6.4 9.3 12.7 15.7 6.4 22.1 0.1 15.7 6.4 9.3Z" fill="#f2f2f4" fillOpacity={0.6} />
      <path d="M21.6 9.3 27.9 15.7 21.6 22.1 15.3 15.7 21.6 9.3Z" fill="#f2f2f4" fillOpacity={0.35} />
    </svg>
  )
}
