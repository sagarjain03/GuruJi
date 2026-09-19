import { NextResponse, type NextRequest } from 'next/server'

const REFRESH_COOKIE = 'guruji_refresh'

const PROTECTED = ['/dashboard', '/roadmap', '/problems', '/revision', '/mistakes']
const AUTH_PAGES = ['/login', '/register']

/**
 * A cheap first pass, not the security boundary.
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

  if (!hasSession && PROTECTED.some((route) => pathname.startsWith(route))) {
    const login = new URL('/login', request.url)
    login.searchParams.set('next', pathname)
    return NextResponse.redirect(login)
  }

  if (hasSession && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/roadmap/:path*', '/problems/:path*', '/login', '/register'],
}
