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
import { UserMenu } from '@/components/user-menu'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/stores/session-store'

// Routes arrive phase by phase. Anything not built yet stays visible but inert:
// `typedRoutes` refuses a Link to a page that does not exist, and a link that
// 404s is worse than one that is plainly not ready.
const NAV = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard, ready: true },
  { href: '/roadmap', label: 'Roadmap', Icon: Map, ready: true },
  { href: '/problems', label: 'Problems', Icon: BookOpen, ready: true },
  { href: '/revision', label: 'Revision', Icon: RotateCcw, ready: false },
  { href: '/mistakes', label: 'Mistakes', Icon: NotebookPen, ready: false },
  { href: '/visualizer', label: 'Visualizer', Icon: Dumbbell, ready: false },
  { href: '/mentor', label: 'AI Mentor', Icon: Bot, ready: false },
  { href: '/analytics', label: 'Analytics', Icon: BarChart3, ready: false },
  { href: '/contest', label: 'Contest', Icon: Swords, ready: false },
] as const

/** The floating icon rail. Desktop only — a 64px column is unusable on a phone. */
function IconRail() {
  const pathname = usePathname()
  const profile = useSessionStore((state) => state.profile)

  return (
    <aside className="hidden shrink-0 overflow-y-auto py-4 pl-4 lg:block">
      <nav
        aria-label="Main"
        className="border-border/60 bg-card/70 sticky top-4 flex flex-col items-center gap-1 rounded-none border p-2 backdrop-blur-xl"
      >
        {NAV.map((item) => {
          const { href, label, Icon } = item
          const active = pathname === href || pathname.startsWith(`${href}/`)

          if (!item.ready) {
            return (
              <span
                key={href}
                aria-disabled="true"
                title={`${label} — not built yet`}
                className="text-muted-foreground/25 grid size-10 cursor-not-allowed place-items-center rounded-none"
              >
                <Icon className="size-[18px]" />
                <span className="sr-only">{label} (not built yet)</span>
              </span>
            )
          }

          return (
            <Link
              key={href}
              href={item.href}
              title={label}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'grid size-10 place-items-center rounded-none transition-all',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon className="size-[18px]" />
              <span className="sr-only">{label}</span>
            </Link>
          )
        })}

        {profile && (
          <>
            <span className="bg-border my-1 h-px w-6" aria-hidden="true" />
            <span
              title={profile.displayName}
              className="bg-primary text-primary-foreground grid size-10 place-items-center font-mono text-xs font-semibold"
            >
              {initials(profile.displayName)}
            </span>
          </>
        )}
      </nav>
    </aside>
  )
}

/** The mobile drawer keeps the labelled list — icons alone are a guessing game. */
function DrawerNav({ onNavigate }: { onNavigate: () => void }) {
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
        const base = 'flex items-center gap-3 rounded-none px-3 py-2.5 text-sm transition-colors'

        if (!item.ready) {
          return (
            <span
              key={href}
              aria-disabled="true"
              className={cn(base, 'text-muted-foreground/35 cursor-not-allowed')}
            >
              {body}
              <span className="border-border/70 text-muted-foreground/60 ml-auto rounded-none border px-2 py-0.5 text-[10px]">
                soon
              </span>
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
              base,
              active
                ? 'bg-primary text-primary-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
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
    <div className="relative flex h-svh overflow-hidden">
      {/* A engineering-drawing grid rather than a coloured wash. Hairlines at
          64px, faded out towards the bottom so the page has a top edge without
          a gradient doing the work. Colour is reserved for things you can act
          on — nothing decorative is tinted. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.55]"
        style={{
          backgroundImage:
            'linear-gradient(to right, var(--grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'linear-gradient(to bottom, black, transparent 65%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black, transparent 65%)',
        }}
      />

      <a
        href="#content"
        className="bg-primary text-primary-foreground sr-only rounded-none px-4 py-2 text-sm font-medium focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>

      <IconRail />

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <div className="bg-sidebar border-sidebar-border absolute inset-y-0 left-0 flex w-72 flex-col border-r p-4">
            <div className="mb-4 flex h-10 items-center justify-between">
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
            <div className="flex-1 overflow-y-auto">
              <DrawerNav onNavigate={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 px-4 lg:px-6">
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className="text-muted-foreground hover:text-foreground lg:hidden"
          >
            <Menu className="size-5" />
          </button>
          <Brand />
          <div className="ml-auto flex items-center gap-3">
            <UserMenu />
            <ThemeToggle />
          </div>
        </header>

        <main id="content" className="min-w-0 flex-1 overflow-y-auto px-4 pb-6 lg:px-6">
          {children}
        </main>
      </div>
    </div>
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
}
