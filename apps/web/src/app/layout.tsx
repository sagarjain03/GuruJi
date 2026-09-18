import type { Metadata, Viewport } from 'next'

/**
 * The root layout deliberately imports no stylesheet.
 *
 * The two route groups are styled by different systems — `(marketing)` uses the
 * landing page's own plain CSS, `(app)` uses Tailwind. Importing either one here
 * would load it on every route, which would put Tailwind's preflight on top of
 * the landing page's reset. Each group's layout imports its own. See
 * docs/architecture.md §13.
 *
 * Fonts stay here because both halves use them and one request is cheaper than two.
 */

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Inter:wght@400;500;600&family=Instrument+Serif:ital@1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
