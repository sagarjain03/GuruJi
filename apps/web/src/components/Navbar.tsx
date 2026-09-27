'use client'

import Link from 'next/link'
import { HardLink } from '@/components/hard-link'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Close, Logo, Menu } from './icons'
import './Navbar.css'

const links = [
  { label: 'Practice', href: '/problems' },
  { label: 'Visualizer', href: '/visualizer' },
  { label: 'Progress', href: '/analytics' },
] as const

/** Shown, but inert — the same treatment as the app shell's unbuilt routes. */
const SOON = ['AI Mentor']

const FOCUSABLE = 'a[href], button:not([disabled])'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const burger = useRef<HTMLButtonElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  // Sheet focus: first link on open, back to the burger on close, Escape
  // closes, and Tab cycles between the burger and the sheet while it is open.
  useEffect(() => {
    if (!open) {
      if (wasOpen.current) burger.current?.focus()
      wasOpen.current = false
      return
    }
    wasOpen.current = true
    sheet.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        return
      }
      if (e.key !== 'Tab' || !sheet.current || !burger.current) return
      const items = [burger.current, ...sheet.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const toTop = (e: React.MouseEvent) => {
    if (window.location.pathname !== '/') return
    e.preventDefault()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
  }

  return (
    <header className="nav">
      <Link className="nav__brand" href="/" onClick={toTop}>
        <Logo className="nav__logo" />
        <span>GuruJi</span>
      </Link>

      <nav className="nav__pill" aria-label="Primary">
        <ul>
          {links.map((link) => (
            <li key={link.href}>
              <HardLink href={link.href}>{link.label}</HardLink>
            </li>
          ))}
          {SOON.map((label) => (
            <li key={label}>
              <span className="nav__soon" aria-disabled="true">
                {label}
                <span className="nav__soon-tag">soon</span>
              </span>
            </li>
          ))}
        </ul>
      </nav>

      <div className="nav__actions">
        <HardLink className="nav__signin" href="/login">
          Sign in
        </HardLink>
        <Button asChild className="nav__cta">
          <HardLink href="/register">Start Training</HardLink>
        </Button>
        <button
          ref={burger}
          className="nav__burger"
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="nav-sheet"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <Close /> : <Menu />}
        </button>
      </div>

      {open && (
        <div ref={sheet} id="nav-sheet" className="nav__sheet">
          <ul>
            {links.map((link) => (
              <li key={link.href}>
                <HardLink href={link.href} onClick={() => setOpen(false)}>
                  {link.label}
                </HardLink>
              </li>
            ))}
            {SOON.map((label) => (
              <li key={label}>
                <span className="nav__soon" aria-disabled="true">
                  {label}
                  <span className="nav__soon-tag">soon</span>
                </span>
              </li>
            ))}
            <li>
              <HardLink href="/login" onClick={() => setOpen(false)}>
                Sign in
              </HardLink>
            </li>
          </ul>
          <Button asChild size="lg" className="w-full">
            <HardLink href="/register" onClick={() => setOpen(false)}>
              Start Training
            </HardLink>
          </Button>
        </div>
      )}
    </header>
  )
}
