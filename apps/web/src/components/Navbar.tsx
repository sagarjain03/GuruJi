'use client'

import { useEffect, useState } from 'react'
import { Chevron, Close, Logo, Menu } from './icons'
import './Navbar.css'

const links = [
  { label: 'Learn', hasMenu: true },
  { label: 'Practice' },
  { label: 'Visualizer' },
  { label: 'Progress' },
  { label: 'AI Mentor' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <header className="nav">
      <a className="nav__brand" href="#main">
        <Logo className="nav__logo" />
        <span>GuruJi</span>
      </a>

      <nav className="nav__pill" aria-label="Primary">
        <ul>
          {links.map((link) => (
            <li key={link.label}>
              <a href="#main">
                {link.label}
                {link.hasMenu && <Chevron className="nav__chev" />}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="nav__actions">
        <a className="btn btn--light nav__cta" href="#main">Start Training</a>
        <button
          className="nav__burger"
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <Close /> : <Menu />}
        </button>
      </div>

      {open && (
        <div className="nav__sheet">
          <ul>
            {links.map((link) => (
              <li key={link.label}>
                <a href="#main" onClick={() => setOpen(false)}>{link.label}</a>
              </li>
            ))}
          </ul>
          <a className="btn btn--accent nav__sheet-cta" href="#main" onClick={() => setOpen(false)}>
            Start Training
          </a>
        </div>
      )}
    </header>
  )
}
