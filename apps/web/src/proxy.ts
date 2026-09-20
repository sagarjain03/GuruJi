import { NextResponse, type NextRequest } from 'next/server'

const REFRESH_COOKIE = 'guruji_refresh'

const PROTECTED = ['/dashboard', '/roadmap', '/problems', '/revision', '/mistakes']
const AUTH_PAGES = ['/login', '/register']

const API_ORIGIN = new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api').origin
/** The same host over `ws:`. A scheme is part of a CSP source, so `http:` does not cover it. */
const API_WS_ORIGIN = API_ORIGIN.replace(/^http/, 'ws')

const isDev = process.env.NODE_ENV === 'development'

/**
 * The Content-Security-Policy promised by docs/security.md.
 *
 * **`script-src` has no `unsafe-eval`.** That is the whole reason Monaco is
 * loaded from our own bundle with only its Monarch grammars and none of its
 * language services — see `src/components/editor/monaco-setup.ts`. A CSP that
 * permits `unsafe-eval` because one library is easier that way is not a CSP.
 *
 * It carries a per-request nonce, which is why it is built here and not in
 * `next.config.ts`. A flat `script-src 'self'` **breaks the production build
 * completely**: Next emits inline bootstrap scripts, the browser refuses every
 * one of them, hydration never runs, and React tears the page down with error
 * #412 — an empty `<main>` on every route. Development did not show it, because
 * the development policy carried `unsafe-inline` to keep the dev overlay
 * working, so the only build anyone tested in a browser was the one that
 * happened to be relaxed. Found by the Phase 4 browser suite.
 *
 * Next reads the nonce out of the `Content-Security-Policy` header on the
 * *request* and stamps it onto its own script tags, so the header is set on the
 * forwarded request as well as on the response.
 *
 * `unsafe-inline` remains on `style-src`: Next injects inline styles for its
 * font and image optimisation. Removing that needs the nonce plumbed through
 * every style tag, which belongs with the Phase 12 security pass.
 */
function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    /*
     * The nonce covers Next's inline bootstrap; `'self'` covers the chunks it
     * pulls in.
     *
     * Deliberately **without** `'strict-dynamic'`, which the usual recipe
     * includes. It turns off host-based allowlisting, and Turbopack does not
     * put the nonce on the chunk `<script>` tags it emits — so the bootstrap
     * runs, every chunk it asks for is refused, and the page is as dead as it
     * was with no nonce at all. Confirmed in the browser, not assumed.
     *
     * What is left still says: nothing inline without today's nonce, nothing
     * from another origin, and no `eval` outside development.
     */
    /*
     * `wasm-unsafe-eval` is not `unsafe-eval`, and the difference is the point.
     *
     * The landing page's 3D scene decodes its model through a WebAssembly
     * decoder, and `WebAssembly.instantiate` counts as compilation under
     * `script-src`. The narrow keyword permits exactly that and still refuses
     * `eval()` of a string — which is the promise `docs/security.md` actually
     * makes, and the reason Monaco ships without its language services.
     */
    `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // Monaco's worker is built by Turbopack and served from our own origin.
    "worker-src 'self' blob:",
    /*
     * Three sources, and **no third-party origin at all**.
     *
     * `'self'` and the API origin are the product. The API's WebSocket is
     * listed by scheme as well, because a scheme is part of a CSP source and
     * `http://` does not cover `ws://`.
     *
     * `blob:` is the 3D model loader fetching textures it decoded itself back
     * out of object URLs — data the page made, not a request to anywhere.
     *
     * There was briefly a CDN host here, for the lighting map that drei's
     * `Environment preset` fetches at runtime. Allowing it meant the first page
     * anyone sees depended on a host we do not control, and the first attempt
     * allowed the wrong one anyway — the preset redirects. Chasing hosts one
     * redirect at a time is how an allowlist stops meaning anything, so the
     * file is served from `public/hdri/` instead and the entry is gone.
     */
    `connect-src 'self' ${API_ORIGIN} ${API_WS_ORIGIN} blob:${isDev ? ' ws: wss:' : ''}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

/**
 * A cheap first pass on auth, and the only place the CSP can be built.
 *
 * Next 16 renamed this convention from `middleware` to `proxy`.
 *
 * The cookie is httpOnly, so this can see that one exists but never whether the
 * token inside it is still valid. Its job is to save a signed-out visitor the
 * round trip of loading the dashboard shell before being bounced. `SessionGate`
 * does the check that actually decides.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSession = request.cookies.has(REFRESH_COOKIE)

  // Redirects carry no document, so they need no policy.
  if (!hasSession && PROTECTED.some((route) => pathname.startsWith(route))) {
    const login = new URL('/login', request.url)
    login.searchParams.set('next', pathname)
    return NextResponse.redirect(login)
  }

  if (hasSession && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // One per request. Reusing a nonce across requests is the same as not having
  // one — an injected script only has to quote the value it saw last time.
  const nonce = btoa(crypto.randomUUID())
  const csp = contentSecurityPolicy(nonce)

  const headers = new Headers(request.headers)
  headers.set('x-nonce', nonce)
  headers.set('content-security-policy', csp)

  const response = NextResponse.next({ request: { headers } })
  response.headers.set('content-security-policy', csp)
  return response
}

/**
 * Every document route, not just the guarded ones.
 *
 * The matcher used to list the handful of paths the redirects care about, which
 * was correct while this only did redirects. Now it also carries the CSP, and a
 * page outside the list would be served with no policy at all.
 *
 * Static assets are excluded: they are not documents, nothing executes in them,
 * and running the edge function for every chunk is pure overhead.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
