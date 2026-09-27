import type { ComponentProps } from 'react'

/**
 * A plain <a> for links that cross between the landing and the app.
 *
 * The two halves are styled by different systems — the landing by
 * styles/globals.css, the app and auth pages by Tailwind in styles/app.css —
 * and Next never unloads a stylesheet on client-side navigation. A <Link> from
 * one half to the other leaves the first half's CSS in the page: the landing's
 * unlayered `* { margin: 0 }` and `a { color: inherit }` then beat Tailwind's
 * layered utilities, and the app renders with `mx-auto` and link colours
 * silently gone. A full page load is the only clean crossing.
 */
export function HardLink({ href, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a href={href} {...props} />
}
