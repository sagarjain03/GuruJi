import type { NextConfig } from 'next'

/**
 * The headers that are the same for every request.
 *
 * `Content-Security-Policy` is deliberately **not** among them. It carries a
 * per-request nonce, so it is built in `src/proxy.ts` where a request exists.
 * A static policy here was what broke the production build: see the note in
 * that file.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },
}

export default nextConfig
