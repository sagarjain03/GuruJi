import { HardLink } from '@/components/hard-link'
import { Logo } from './icons'
import './Footer.css'

/** Only pages that exist. Every one is outside the landing, hence full loads. */
const links = [
  { label: 'Problems', href: '/problems' },
  { label: 'Visualizer', href: '/visualizer' },
  { label: 'Sign in', href: '/login' },
  { label: 'Create account', href: '/register' },
]

export default function Footer() {
  // Rendered per request (the root layout is force-dynamic), so this is always
  // the current year, never the one the page was built in.
  const year = new Date().getUTCFullYear()

  return (
    <footer className="footer">
      <p className="footer__brand">
        <Logo className="footer__logo" />
        <span>&copy; {year} GuruJi</span>
      </p>
      <nav aria-label="Footer">
        <ul className="footer__links">
          {links.map((link) => (
            <li key={link.href}>
              <HardLink href={link.href}>{link.label}</HardLink>
            </li>
          ))}
        </ul>
      </nav>
    </footer>
  )
}
