import '@/styles/globals.css'

/**
 * The landing half. Plain per-component CSS, no Tailwind — the page was built to
 * a fixed visual specification whose measured values are the design.
 *
 * The 5.8 MB model preload lives here rather than in the root layout so that app
 * routes, which never render it, do not pay for it.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preload" as="fetch" href="/robot.glb" crossOrigin="anonymous" />
      {children}
    </>
  )
}
