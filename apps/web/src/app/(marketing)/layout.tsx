import '@/styles/marketing-tailwind.css'
import '@/styles/globals.css'

/**
 * The landing half. Plain per-component CSS, no Tailwind reset — the page was
 * built to a fixed visual specification whose measured values are the design.
 *
 * The 3D model is deliberately not preloaded: Hero starts it only after the
 * page is interactive, and phones never fetch it at all.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return children
}
