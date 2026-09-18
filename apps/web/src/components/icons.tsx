import type { ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

export const Logo = (props: IconProps) => (
  <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" {...props}>
    <path d="M14 1.6 20.3 8 14 14.4 7.7 8 14 1.6Z" fill="#A78BFA" />
    <path d="M6.4 9.3 12.7 15.7 6.4 22.1 0.1 15.7 6.4 9.3Z" fill="#7C3AED" />
    <path d="M21.6 9.3 27.9 15.7 21.6 22.1 15.3 15.7 21.6 9.3Z" fill="#6366F1" />
  </svg>
)

export const Globe = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true" {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 3.7 5.7 3.7 9S14.5 18.4 12 21c-2.5-2.6-3.7-5.7-3.7-9S9.5 5.6 12 3Z" />
  </svg>
)

export const Chevron = (props: IconProps) => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true" {...props}>
    <path d="m3 4.5 3 3 3-3" />
  </svg>
)

export const ArrowRight = (props: IconProps) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M4 10h12M11 5l5 5-5 5" />
  </svg>
)

export const Menu = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" {...props}>
    <path d="M4 8h16M4 16h16" />
  </svg>
)

export const Close = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" {...props}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
)

/* Core pattern wordmarks — mark + text, drawn to sit on one baseline. */
export const patterns: Array<{ name: string; mark: ReactNode }> = [
  {
    name: 'Arrays',
    mark: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M3 4.5A1.5 1.5 0 0 1 4.5 3H9v14H4.5A1.5 1.5 0 0 1 3 15.5v-11ZM17 4.5A1.5 1.5 0 0 0 15.5 3H11v14h4.5a1.5 1.5 0 0 0 1.5-1.5v-11Z" />
      </svg>
    ),
  },
  {
    name: 'Graphs',
    mark: (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M2 3h16l-5.6 6.9L18 17H2l5.6-7.1L2 3Zm4.4 1.6 4 5 4-5h-8Z" />
      </svg>
    ),
  },
  {
    name: 'Trees',
    mark: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M10 2.5 17 10l-7 7.5L3 10l7-7.5Z" />
      </svg>
    ),
  },
  {
    name: 'DP',
    mark: (
      <svg viewBox="0 0 22 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 16V6l4.5 6L11 6l4.5 6L20 6v10" />
      </svg>
    ),
  },
  {
    name: 'Greedy',
    mark: (
      <svg viewBox="0 0 22 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 5l3.5 11L9 8l3.5 8L16 5" />
        <circle cx="19" cy="7" r="1.6" />
      </svg>
    ),
  },
]
