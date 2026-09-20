import type { NextConfig } from 'next'

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'
const API_HOST = new URL(API_ORIGIN).origin

/**
 * The Content-Security-Policy promised by docs/security.md.
 *
 * **`script-src` has no `unsafe-eval`.** That is the whole reason Monaco is
 * loaded from our own bundle with only its Monarch grammars and none of its
 * language services — see `src/components/editor/monaco-setup.ts`. A CSP that
 * permits `unsafe-eval` because one library is easier that way is not a CSP.
 *
 * `unsafe-inline` remains on `style-src` only: Next injects inline styles for
 * its font and image optimisation, and removing that needs a nonce plumbed
 * through the document, which belongs with the Phase 12 security pass.
 *
 * In development the policy is relaxed for the dev overlay and HMR, which need
 * eval and a websocket. Shipping the relaxed one would defeat the point, so it
 * is keyed off NODE_ENV rather than a flag anyone could leave on.
 */
const isDev = process.env.NODE_ENV === 'development'

const csp = [
  "default-src 'self'",
  isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Monaco's worker is built by Turbopack and served from our own origin.
  "worker-src 'self' blob:",
  `connect-src 'self' ${API_HOST}${isDev ? ' ws: wss:' : ''}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },
}

export default nextConfig
