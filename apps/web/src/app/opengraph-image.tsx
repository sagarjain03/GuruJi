import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { Mark } from './brand-mark'

export const alt = 'GuruJi'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * Link preview: the mark and the name in Space Grotesk on graphite, nothing
 * else. The font is a local .woff because ImageResponse cannot read the
 * next/font build output and does not accept woff2.
 */
export default async function OpenGraphImage() {
  const font = await readFile(join(process.cwd(), 'src/app/fonts/space-grotesk-latin-600.woff'))

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 36,
          background: '#0b0b0d',
          color: '#f2f2f4',
          fontFamily: 'Space Grotesk',
          fontSize: 112,
          letterSpacing: '-0.03em',
        }}
      >
        <Mark size={120} />
        <div style={{ display: 'flex' }}>GuruJi</div>
      </div>
    ),
    { ...size, fonts: [{ name: 'Space Grotesk', data: font, weight: 600, style: 'normal' }] },
  )
}
