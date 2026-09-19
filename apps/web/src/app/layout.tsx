import type { Metadata, Viewport } from 'next'
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono, Space_Grotesk } from 'next/font/google'

/**
 * The root layout deliberately imports no stylesheet.
 *
 * The two route groups are styled by different systems — `(marketing)` uses the
 * landing page's own plain CSS, `(app)` uses Tailwind. Importing either one here
 * would load it on every route, which would put Tailwind's preflight on top of
 * the landing page's reset. Each group's layout imports its own. See
 * docs/architecture.md §13.
 *
 * Fonts are loaded through `next/font`, which self-hosts them at build time.
 * A `<link>` to Google's CDN would block the first paint on a third-party
 * round trip and would need an exception in the content security policy.
 */

// Headlines and numbers. A grotesk with square terminals and an unusual `g` —
// enough character to not read as the default SaaS typeface.
const display = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display-src',
  display: 'swap',
})

// Body copy. Deliberately quieter than the display face: a distinctive headline
// over a neutral body is the pairing that reads as designed rather than busy.
const body = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans-src',
  display: 'swap',
})

// Code, and any number the eye has to compare down a column.
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono-src',
  display: 'swap',
})

// The landing page's one italic accent.
const serif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['italic'],
  variable: '--font-italic-src',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'GuruJi — Train Your DSA Skills',
    template: '%s · GuruJi',
  },
  description:
    'GuruJi measures what you actually understand and decides what you should practise next.',
  icons: { icon: '/favicon.svg' },
}

export const viewport: Viewport = {
  themeColor: '#050506',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${mono.variable} ${serif.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
