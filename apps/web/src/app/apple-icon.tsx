import { ImageResponse } from 'next/og'
import { Mark } from './brand-mark'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

/** Home-screen icon: the diamond-triad mark on the graphite ground. iOS rounds the corners itself. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0b0d',
        }}
      >
        <Mark size={112} />
      </div>
    ),
    size,
  )
}
