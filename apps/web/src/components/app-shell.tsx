'use client'

import {
  BarChart3,
  BookOpen,
  Bot,
  Dumbbell,
  LayoutDashboard,
  Map,
  Menu,
  NotebookPen,
  RotateCcw,
  Swords,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'
import { cn } from '@/lib/utils'

// Routes arrive phase by phase. Anything not built yet stays visible but inert:
// `typedRoutes` refuses a Link to a page that does not exist, and a link that
// 404s is worse than one that is plainly not ready.
const NAV = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard, ready: true },
  { href: '/roadmap', label: 'Roadmap', Icon: Map, ready: false },
  { href: '/problems', label: 'Problems', Icon: BookOpen, ready: false },
  { href: '/revision', label: 'Revision', Icon: RotateCcw, ready: false },
  { href: '/mistakes', label: 'Mistakes', Icon: NotebookPen, ready: false },
  { href: '/visualizer', label: 'Visualizer', Icon: Dumbbell, ready: false },
  { href: '/mentor', label: 'AI Mentor', Icon: Bot, ready: false },
  { href: '/analytics', label: 'Analytics', Icon: BarChart3, ready: false },
  { href: '/contest', label: 'Contest', Icon: Swords, ready: false },
] as const

const NAV_ITEM = 'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors'

// `exactOptionalPropertyTypes` is on, so an optional handler cannot be passed
// straight through to a DOM prop. A no-op default keeps the type honest.
function NavList({ onNavigate = () => {} }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const { href, label, Icon } = item
        const active = pathname === href || pathname.startsWith(`${href}/`)
        const body = (
          <>
            <Icon className="size-4 shrink-0" />
            {label}
          </>
        )

        if (!item.ready) {
          return (
            <span
              key={href}
              aria-disabled="true"
              title="Not built yet"
              className={cn(NAV_ITEM, 'text-muted-foreground/40 cursor-not-allowed')}
            >
              {body}
            </span>
          )
        }

        return (
          <Link
            key={href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              NAV_ITEM,
              active
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/60',
            )}
          >
            {body}
          </Link>
        )
      })}
    </nav>
  )
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2">
      <svg viewBox="0 0 28 28" className="size-5" fill="none" aria-hidden="true">
        <path d="M14 1.6 20.3 8 14 14.4 7.7 8 14 1.6Z" fill="#A78BFA" />
        <path d="M6.4 9.3 12.7 15.7 6.4 22.1 0.1 15.7 6.4 9.3Z" fill="#7C3AED" />
        <path d="M21.6 9.3 27.9 15.7 21.6 22.1 15.3 15.7 21.6 9.3Z" fill="#6366F1" />
      </svg>
      <span className="font-display text-base font-semibold tracking-tight">GuruJi</span>
    </Link>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // A drawer that survives navigation leaves the user staring at the menu they
  // just used. Close it whenever the route changes — adjusted during render
  // rather than in an effect, which would cost an extra render pass.
  const [lastPath, setLastPath] = useState(pathname)
  if (lastPath !== pathname) {
    setLastPath(pathname)
    setOpen(false)
  }

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex min-h-svh">
      <a
        href="#content"
        className="bg-primary text-primary-foreground sr-only rounded-md px-4 py-2 text-sm font-medium focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="bg-sidebar border-sidebar-border hidden w-60 shrink-0 flex-col border-r lg:flex">
        <div className="flex h-14 items-center px-5">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <NavList />
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div className="bg-sidebar border-sidebar-border absolute inset-y-0 left-0 flex w-64 flex-col border-r">
            <div className="flex h-14 items-center justify-between px-5">
              <Brand />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2">
              <NavList onNavigate={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-background/80 sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 backdrop-blur-md lg:px-6">
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className="text-muted-foreground hover:text-foreground lg:hidden"
          >
            <Menu className="size-5" />
          </button>
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
          </div>
        </header>

        <main id="content" className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
