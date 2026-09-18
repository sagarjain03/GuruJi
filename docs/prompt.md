# Fluxora — Landing Page Hero Rebuild Prompt

> One-shot prompt for an AI code generator (Claude Code, Cursor, v0, Bolt, etc.). Paste this entire file as a single prompt into an empty directory. It contains the exact, complete source of every file in the project — follow it literally and the result is pixel-for-pixel the original.

## What this project is

"Fluxora" is a tech/design-agency landing page in a warm ember palette — deep near-black ground (`#120400`) bleeding into molten orange and amber (`#ff3d00` → `#ff8a1f`) — built around a looping background video of a man wearing a glowing AR visor. The composition is a single hero section behind a transparent pill-navbar: a small "Hub support..." note over a hairline rule, a four-line display headline ("Technology / Crafted for All / Not *Machines*", with "Machines" set in italic **Instrument Serif** against an otherwise all-sans page), a lede, a flame-gradient "Get started" pill CTA with an arrow tile, a row of four overlapping tinted avatar dots reading "650+ Happy Clients / Live Support", and two glass stat cards ("150+ Projects delivered", "98% Client satisfaction"). On wide viewports (≥1120px) a second, near-invisible "ghost" analytics panel appears at low opacity to the right of the copy. The footer band carries a huge low-opacity "AIM" watermark on the left and a right-aligned "Our Partners" row of five inline SVG wordmarks (BookStore, zantic, Crona, Mercury, Wagon). The navbar itself is a logo-left / pill-nav-center / CTA-right layout that collapses to a burger + slide-down sheet under 940px.

All motion is CSS: the video cross-fades in via an `is-ready` class toggled from `onCanPlay`, and every hero block (`.hero__note`, `.hero__title`, `.hero__sub`, `.hero__cta`, `.hero__stats`, `.hero__foot`) runs the same `rise` keyframe on a staggered `animation-delay`, disabled under `prefers-reduced-motion: reduce`. There is no animation library — no Framer Motion, no GSAP.

## Reproduce this exactly

The goal is a **byte-identical rebuild**, not an interpretation. Every file below is the real, final source of a shipped project. Write each one out verbatim.

- **Do not "improve" anything.** Not the copy, not the colour values, not the spacing, not the class names, not the markup structure. Odd-looking values are measured against the footage and are deliberate.
- **Do not substitute libraries or approaches.** No Tailwind utility classes in place of the CSS files, no inline `style` props for layout, no CSS-in-JS, no icon package, no UI kit, no animation library. The dependency list below is complete and exact. (The four `<i style={{ '--a': ..., '--b': ... }} />` avatar dots and the `ghost__bars` inline heights in `Hero.jsx` are the only `style` usage in the project — both are per-item custom-property/data values, not layout, and must be kept exactly as written.)
- **Use the pinned versions in `package.json` as written** — do not run `npm install <pkg>@latest`, and do not let a scaffolder overwrite them with newer ones. A different React or Vite version is a different build.
- **Do not add files.** No extra components, no README, no test setup, no TypeScript, no `tailwind.config.js`. The complete file list is exactly what appears under **File:** below, plus the downloaded video asset.
- **Keep every accessibility attribute** — `aria-hidden`, `aria-label`, `aria-expanded`, the `<a className="skip-link">` skip-to-content link, and `main id="main"`. They are load-bearing, not decoration.
- **Keep the comments.** They record why specific values were chosen (e.g. the asymmetric scrim math in `Hero.css`, the autoplay-nudge in `Hero.jsx`) and are part of the source.
- If a scaffolding tool generates boilerplate (`App.css`, the Vite SVG logos, a starter `App.jsx`, an ESLint config), **delete it** rather than merging it in. This project lints with **oxlint**, not ESLint — do not add an ESLint config, and do not add `.oxlintrc.json` either; it plays no part in how the page looks or runs.

## Tech stack (required — do not substitute)

- Vite + React 19 (plain JavaScript, JSX — **not** TypeScript)
- No CSS framework — **real CSS in per-component stylesheets**: `src/styles/globals.css` for resets, tokens and the shared `.btn` system, `src/components/Navbar.css` and `src/components/Hero.css` each imported at the top of their own component. Design tokens live as CSS custom properties in `:root` in `globals.css`. This project does **not** use inline `style` props for layout and does **not** use a utility-CSS framework. Reproduce the CSS files as given; do not convert them.
- Inline SVG icons in `src/components/icons.jsx` — no icon library
- Google Fonts via `<link>` tags in `index.html`: **Inter Tight** (400/500/600/700, the display/UI face), **Inter** (400/500/600, body face), and **Instrument Serif** (italic only) for the single serif accent word
- No animation library — motion is plain CSS `@keyframes` and transitions

### package.json

```json
{
  "name": "ember",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "oxlint",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.2.8",
    "react-dom": "^19.2.8"
  },
  "devDependencies": {
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.4",
    "@vitejs/plugin-react": "^6.1.0",
    "oxlint": "^1.79.0",
    "vite": "^8.2.2"
  }
}
```

### vite.config.js

```js
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})
```

## Assets — download them, do not hotlink

This project needs 1 file that is not in the code: an ~11MB looping hero video. Download it into `public/` as the **first build step**, then reference it by its **local path** everywhere in the project:

- `public/hero-loop.mp4` ← https://pub-1e5b4001b36b47e28e6a2fb775966a79.r2.dev/prompt-assets/fluxora/hero-loop.mp4

```bash
mkdir -p public
curl -L -o public/hero-loop.mp4 "https://pub-1e5b4001b36b47e28e6a2fb775966a79.r2.dev/prompt-assets/fluxora/hero-loop.mp4"
```

**This download URL must not appear anywhere in the project you generate** — not in `index.html`, not in a component, not in CSS, not in a config file. It is the template library's own storage, not a CDN licensed to serve your site's traffic. A page that hotlinks it breaks the moment the asset is moved, and it bills your visitors' bandwidth to someone else. Download the file once, commit it with your project, and serve it from your own hosting like any other asset you own.

In the code, the reference stays local and root-relative — `src="/hero-loop.mp4"` in `Hero.jsx`, and `href="/hero-loop.mp4"` on the `<link rel="preload">` in `index.html` — exactly as written in the file contents below. Do not rewrite that path to an absolute URL.

`public/favicon.svg` is plain text (SVG markup) and is given in full below as an ordinary `## File:` section — do not treat it as a binary download, and do not substitute a placeholder favicon.

## Steps to build

1. Scaffold a new Vite React project named `fluxora` using the plain JavaScript template (`npm create vite@latest fluxora -- --template react`), then delete every file the scaffolder generated under `src/` and `public/` — none of it survives into the final project.
2. Write `package.json` exactly as given below and install with it, so the pinned versions are what actually land in `node_modules`.
3. Download the video asset into `public/` as described in **Assets** above — do this before the first run, so the hero has real footage immediately.
4. Write `index.html`, `src/styles/globals.css`, `src/main.jsx` and `src/App.jsx` with the exact contents below.
5. Write `src/components/Navbar.jsx`, `src/components/Navbar.css`, `src/components/Hero.jsx`, `src/components/Hero.css` and `src/components/icons.jsx` with the exact contents below.
6. Write `public/favicon.svg` with the exact SVG markup below.
7. Write `vite.config.js` with the exact contents below.
8. There is **no** separate `Footer`, `Stats`, or `Partners` component — the entire page is `Navbar` plus one `Hero` section, and the footer band, stat cards and ghost panel all live inside `Hero.jsx`.
9. Run `npm run dev` and confirm the video plays behind the copy, the four hero blocks stagger in on load, and the ghost analytics panel only appears at ≥1120px viewport width. Run `npm run build` and confirm it builds clean.


## File: `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#120400" />
    <title>Fluxora — Technology Crafted for All</title>
    <link rel="preload" as="video" href="/hero-loop.mp4" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Inter:wght@400;500;600&family=Instrument+Serif:ital@1&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

## File: `src/styles/globals.css`

```css
/* Fluxora — tokens sampled from the reference frame:
   deep ember black ground, molten orange horizon, warm-tinted glass. */
:root {
  --ground: #2a0b02;
  --ground-deep: #120400;
  --ink: #ffffff;
  --ink-soft: rgba(255, 255, 255, 0.72);
  --ink-faint: rgba(255, 255, 255, 0.46);
  --ink-ghost: rgba(255, 255, 255, 0.2);

  --flame: #ff3d00;
  --flame-lit: #ff8a1f;

  /* warm glass — a neutral grey tint reads pasted-on over this footage */
  --glass: rgba(56, 20, 6, 0.42);
  --glass-strong: rgba(40, 13, 3, 0.62);
  --hair: rgba(255, 255, 255, 0.14);
  --hair-soft: rgba(255, 255, 255, 0.08);

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --gutter: clamp(18px, 2.6vw, 44px);

  --font-display: 'Inter Tight', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-body: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-italic: 'Instrument Serif', Georgia, serif;
}

*,
*::before,
*::after { box-sizing: border-box; }

* { margin: 0; }

html { -webkit-text-size-adjust: 100%; }

body {
  min-height: 100svh;
  background: var(--ground-deep);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  overflow-x: hidden;
}

img, svg, video { display: block; max-width: 100%; }

button { font: inherit; color: inherit; border: 0; background: none; cursor: pointer; }

a { color: inherit; text-decoration: none; }

:focus-visible {
  outline: 2px solid var(--flame-lit);
  outline-offset: 3px;
  border-radius: 4px;
}

.skip-link {
  position: absolute;
  left: -9999px;
  top: 12px;
  z-index: 100;
  padding: 10px 16px;
  border-radius: 999px;
  background: #fff;
  color: #150500;
  font-size: 14px;
  font-weight: 600;
}
.skip-link:focus { left: 12px; }

/* Shared button system — pill geometry, matching the reference's fully-round CTAs. */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border-radius: 999px;
  font-family: var(--font-body);
  font-weight: 500;
  letter-spacing: -0.01em;
  white-space: nowrap;
  transition: transform 0.35s var(--ease-out), background-color 0.35s var(--ease-out),
    box-shadow 0.35s var(--ease-out), border-color 0.35s var(--ease-out);
}

.btn--light {
  padding: 0.72em 1.35em;
  background: #fff;
  color: #180600;
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.35);
}
.btn--light:hover { transform: translateY(-1px); background: #fff4ec; }

.btn--flame {
  padding: 0.5em 0.5em 0.5em 1.5em;
  background: linear-gradient(96deg, var(--flame) 0%, var(--flame-lit) 100%);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 14px 40px rgba(255, 61, 0, 0.38);
}
.btn--flame:hover { transform: translateY(-2px); box-shadow: 0 20px 52px rgba(255, 61, 0, 0.5); }

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
```

## File: `src/main.jsx`

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

## File: `src/App.jsx`

```jsx
import Navbar from './components/Navbar.jsx'
import Hero from './components/Hero.jsx'

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Navbar />
      <main id="main">
        <Hero />
      </main>
    </>
  )
}
```

## File: `src/components/Navbar.jsx`

```jsx
import { useEffect, useState } from 'react'
import { Chevron, Close, Logo, Menu } from './icons.jsx'
import './Navbar.css'

const links = [
  { label: 'Features', hasMenu: true },
  { label: 'How It Works' },
  { label: 'About' },
  { label: 'Product' },
  { label: 'Blogs' },
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
        <span>Fluxora</span>
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
        <a className="btn btn--light nav__cta" href="#main">Get Started</a>
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
          <a className="btn btn--flame nav__sheet-cta" href="#main" onClick={() => setOpen(false)}>
            Get Started
          </a>
        </div>
      )}
    </header>
  )
}
```

## File: `src/components/Navbar.css`

```css
/* Reference: logo hard left, links in a centred outlined capsule where each item
   carries its own soft chip, one white pill CTA hard right. Bar is transparent. */
.nav {
  position: absolute;
  inset: 0 0 auto;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: clamp(14px, 1.7vw, 22px) var(--gutter);
}

.nav__brand {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-family: var(--font-display);
  font-size: clamp(18px, 1.5vw, 22px);
  font-weight: 600;
  letter-spacing: -0.025em;
}

.nav__logo { width: 1.3em; height: 1.3em; }

.nav__pill {
  display: none;
  padding: 5px;
  border: 1px solid var(--hair);
  border-radius: 12px;
  background: rgba(28, 10, 2, 0.34);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.nav__pill ul {
  display: flex;
  align-items: center;
  gap: 3px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.nav__pill a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 13px;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 450;
  color: rgba(255, 255, 255, 0.82);
  background: rgba(255, 255, 255, 0.05);
  transition: background-color 0.3s var(--ease-out), color 0.3s var(--ease-out);
}
.nav__pill a:hover { background: rgba(255, 255, 255, 0.14); color: #fff; }

.nav__chev { width: 10px; height: 10px; opacity: 0.7; }

.nav__actions { display: flex; align-items: center; gap: 10px; }

.nav__cta { font-size: 13.5px; font-weight: 550; }

.nav__burger {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--hair);
  border-radius: 10px;
  background: rgba(28, 10, 2, 0.4);
  backdrop-filter: blur(10px);
}
.nav__burger svg { width: 20px; height: 20px; }

.nav__sheet {
  position: fixed;
  inset: 68px 12px auto;
  padding: 18px;
  border: 1px solid var(--hair);
  border-radius: 18px;
  background: rgba(18, 5, 0, 0.94);
  backdrop-filter: blur(20px);
}
.nav__sheet ul { margin: 0 0 14px; padding: 0; list-style: none; display: grid; gap: 2px; }
.nav__sheet a {
  display: block;
  padding: 12px 10px;
  border-radius: 10px;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.86);
}
.nav__sheet a:hover { background: rgba(255, 255, 255, 0.07); }
.nav__sheet-cta { width: 100%; justify-content: center; padding: 0.85em 1.4em; }

@media (min-width: 940px) {
  .nav__pill { display: block; }
  .nav__burger { display: none; }
}

@media (max-width: 480px) {
  .nav__cta { display: none; }
}
```

## File: `src/components/Hero.jsx`

```jsx
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Globe, partners } from './icons.jsx'
import './Hero.css'

const stats = [
  { value: '150+', label: 'Projects delivered' },
  { value: '98%', label: 'Client satisfaction' },
]

const bars = [34, 52, 44, 70, 88]

export default function Hero() {
  const videoRef = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Some browsers block autoplay until the element is explicitly nudged.
    const play = video.play()
    if (play?.catch) play.catch(() => {})

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.pause()
      setReady(true)
    }
  }, [])

  return (
    <section className="hero">
      <div className="hero__media">
        <video
          ref={videoRef}
          className={`hero__video ${ready ? 'is-ready' : ''}`}
          src="/hero-loop.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          onCanPlay={() => setReady(true)}
        />
        <div className="hero__scrim" aria-hidden="true" />
        <div className="hero__rules" aria-hidden="true">
          <span /><span /><span />
        </div>
      </div>

      <div className="hero__inner">
        <div className="hero__lead">
          <p className="hero__note">
            <Globe className="hero__note-icon" />
            <span>Hub support peoples from<br />all over the world</span>
          </p>

          <h1 className="hero__title">
            Technology<br />
            Crafted for All<br />
            Not <em>Machines</em>
          </h1>

          <p className="hero__sub">
            We create clear, intuitive, and accessible digital
            experiences shaped by real human behavior.
          </p>

          <div className="hero__cta">
            <a className="btn btn--flame hero__go" href="#main">
              Get started
              <span className="hero__go-dot" aria-hidden="true"><ArrowRight /></span>
            </a>

            <div className="hero__proof">
              <div className="hero__faces" aria-hidden="true">
                <i style={{ '--a': '#ff7a3d', '--b': '#ffb27a' }} />
                <i style={{ '--a': '#6f4bd8', '--b': '#a98cff' }} />
                <i style={{ '--a': '#1f9ea8', '--b': '#63d6df' }} />
                <i style={{ '--a': '#d8434b', '--b': '#ff8a8f' }} />
              </div>
              <span className="hero__proof-text">
                <strong>650+ Happy Clients</strong>
                Live Support
              </span>
            </div>
          </div>

          <ul className="hero__stats">
            {stats.map((stat) => (
              <li key={stat.label} className="stat">
                <span className="stat__mark" aria-hidden="true">*</span>
                <span className="stat__value">{stat.value}</span>
                <span className="stat__label">{stat.label}</span>
                <span className="stat__rule" aria-hidden="true" />
              </li>
            ))}
          </ul>
        </div>

        <aside className="hero__ghost" aria-hidden="true">
          <div className="ghost__row">
            <div className="ghost__bars">
              {bars.map((h, i) => (
                <span key={i} style={{ height: `${h}%` }} />
              ))}
            </div>
            <p className="ghost__kpi"><strong>+42%</strong>Experience<br />Performance</p>
          </div>
          <h2 className="ghost__title">Measure Real Impact</h2>
          <p className="ghost__copy">
            We track user response through meaningful metrics and
            refine every detail until the experience feels effortless.
          </p>
        </aside>
      </div>

      <div className="hero__foot">
        <span className="hero__watermark" aria-hidden="true">AIM</span>
        <div className="hero__partners">
          <span className="hero__partners-label">Our Partners</span>
          <ul>
            {partners.map((partner) => (
              <li key={partner.name}>
                {partner.mark}
                <span>{partner.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
```

## File: `src/components/Hero.css`

```css
/* Measured off the reference: headline caps ~40px on an 879px-wide shot →
   ~6.4vw at 0.9 line-height, copy column ~33ch, content anchored hard left and
   riding slightly high with the stat cards sitting below it. */
.hero {
  --scale: 1;     /* display type + vertical rhythm */
  --ui-scale: 1;  /* badge, buttons, small copy */

  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  min-height: 100svh;
  overflow: hidden;
  padding: calc(86px * var(--scale)) var(--gutter) calc(26px * var(--scale));
  background: linear-gradient(165deg, var(--ground) 0%, var(--ground-deep) 70%);
}

/* ---------- media ---------- */
.hero__media { position: absolute; inset: 0; z-index: -1; }

.hero__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 68% center;
  opacity: 0;
  transform: scale(1.04);
  transition: opacity 1.1s var(--ease-out), transform 2.4s var(--ease-out);
}
.hero__video.is-ready { opacity: 1; transform: scale(1); }

/* This footage is bright orange from the horizon rightwards and near-black in the
   upper left, so the scrim is asymmetric: a heavy left wash under the copy, a soft
   floor for the partner strip, and almost nothing over the subject. */
.hero__scrim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(96deg, rgba(10, 3, 0, 0.9) 0%, rgba(14, 4, 0, 0.66) 30%,
      rgba(20, 6, 0, 0.16) 52%, rgba(20, 6, 0, 0) 68%),
    linear-gradient(0deg, rgba(9, 2, 0, 0.78) 0%, rgba(9, 2, 0, 0.12) 28%, rgba(0, 0, 0, 0) 46%),
    linear-gradient(180deg, rgba(8, 2, 0, 0.5) 0%, rgba(0, 0, 0, 0) 22%);
}

.hero__rules {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: space-between;
  padding: 0 30%;
  pointer-events: none;
}
.hero__rules span { width: 1px; background: rgba(255, 255, 255, 0.055); }
.hero__rules span:nth-child(2) { margin-left: 14px; }

/* ---------- layout ---------- */
.hero__inner {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: center;
  gap: 40px;
}

.hero__lead { max-width: 640px; }

/* ---------- fine print ---------- */
.hero__note {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: calc(13px * var(--ui-scale));
  border-top: 1px solid var(--hair-soft);
  width: fit-content;
  max-width: 300px;
  font-size: calc(11.5px * var(--ui-scale));
  line-height: 1.45;
  letter-spacing: 0.005em;
  color: var(--ink-faint);
}
.hero__note-icon {
  width: calc(20px * var(--ui-scale));
  height: calc(20px * var(--ui-scale));
  flex: none;
}

/* ---------- headline ---------- */
.hero__title {
  margin-top: calc(24px * var(--scale));
  font-family: var(--font-display);
  font-size: calc(clamp(2.7rem, 6.4vw, 6.1rem) * var(--scale));
  font-weight: 600;
  line-height: 0.9;
  letter-spacing: -0.035em;
  text-shadow: 0 6px 40px rgba(0, 0, 0, 0.45);
}
.hero__title em {
  font-family: var(--font-italic);
  font-weight: 400;
  font-style: italic;
  letter-spacing: -0.005em;
}

.hero__sub {
  margin-top: calc(20px * var(--scale));
  max-width: calc(410px * var(--scale));
  font-size: calc(15px * var(--ui-scale));
  line-height: 1.58;
  color: var(--ink-soft);
}

/* ---------- CTA row ---------- */
.hero__cta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: calc(20px * var(--ui-scale));
  margin-top: calc(26px * var(--scale));
}

.hero__go { font-size: calc(15px * var(--ui-scale)); }

.hero__go-dot {
  display: grid;
  place-items: center;
  width: 2.55em;
  height: 2.55em;
  border-radius: 999px;
  background: #fff;
  color: #1a0600;
}
.hero__go-dot svg { width: 1.15em; height: 1.15em; }

.hero__proof { display: flex; align-items: center; gap: 10px; }

.hero__faces { display: flex; }
.hero__faces i {
  width: calc(28px * var(--ui-scale));
  height: calc(28px * var(--ui-scale));
  margin-left: -9px;
  border-radius: 999px;
  border: 2px solid rgba(22, 7, 0, 0.85);
  background: linear-gradient(140deg, var(--a), var(--b));
}
.hero__faces i:first-child { margin-left: 0; }

.hero__proof-text {
  display: grid;
  font-size: calc(10px * var(--ui-scale));
  line-height: 1.4;
  color: var(--ink-faint);
}
.hero__proof-text strong {
  font-size: calc(12px * var(--ui-scale));
  font-weight: 550;
  color: rgba(255, 255, 255, 0.9);
}

/* ---------- stat cards ---------- */
.hero__stats {
  display: flex;
  flex-wrap: wrap;
  gap: calc(14px * var(--scale));
  margin: calc(30px * var(--scale)) 0 0;
  padding: 0;
  list-style: none;
}

.stat {
  position: relative;
  display: grid;
  align-content: space-between;
  width: calc(200px * var(--scale));
  min-height: calc(132px * var(--scale));
  padding: calc(18px * var(--ui-scale));
  border: 1px solid var(--hair);
  border-radius: 16px;
  background: var(--glass);
  backdrop-filter: blur(16px) saturate(1.1);
  -webkit-backdrop-filter: blur(16px) saturate(1.1);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.09);
}
.stat:nth-child(2) {
  background: linear-gradient(150deg, rgba(120, 30, 4, 0.5), rgba(48, 14, 2, 0.5));
}

.stat__mark {
  position: absolute;
  top: calc(14px * var(--ui-scale));
  right: calc(16px * var(--ui-scale));
  font-size: calc(15px * var(--ui-scale));
  color: var(--ink-faint);
}

.stat__value {
  font-family: var(--font-display);
  font-size: calc(clamp(1.7rem, 2.4vw, 2.3rem) * var(--scale));
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.03em;
}

.stat__label {
  font-size: calc(11.5px * var(--ui-scale));
  color: var(--ink-faint);
}

.stat__rule {
  position: absolute;
  right: calc(16px * var(--ui-scale));
  bottom: calc(22px * var(--ui-scale));
  width: 14px;
  height: 1px;
  background: rgba(255, 255, 255, 0.28);
}

/* ---------- ghost analytics panel ---------- */
.hero__ghost {
  display: none;
  align-self: start;
  margin-top: calc(40px * var(--scale));
  max-width: 330px;
  color: rgba(255, 255, 255, 0.26);
}

.ghost__row { display: flex; align-items: flex-end; gap: 18px; }

.ghost__bars {
  display: flex;
  align-items: flex-end;
  gap: 5px;
  height: 74px;
}
.ghost__bars span {
  width: 9px;
  border-radius: 2px 2px 0 0;
  background: rgba(255, 255, 255, 0.5);
}

.ghost__kpi { font-size: 11px; line-height: 1.4; }
.ghost__kpi strong {
  display: block;
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.03em;
  color: rgba(255, 255, 255, 0.55);
}

.ghost__title {
  margin-top: 30px;
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 500;
  letter-spacing: -0.02em;
  color: rgba(255, 255, 255, 0.4);
}

.ghost__copy { margin-top: 8px; font-size: 12.5px; line-height: 1.6; }

/* ---------- footer band ---------- */
.hero__foot {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-top: calc(22px * var(--scale));
}

.hero__watermark {
  font-family: var(--font-display);
  font-size: clamp(3rem, 8vw, 7rem);
  font-weight: 700;
  line-height: 0.8;
  letter-spacing: -0.05em;
  color: rgba(255, 255, 255, 0.055);
  user-select: none;
}

.hero__partners { text-align: right; }

.hero__partners-label {
  display: block;
  margin-bottom: 14px;
  font-size: calc(11.5px * var(--ui-scale));
  color: var(--ink-faint);
}

.hero__partners ul {
  display: flex;
  align-items: center;
  gap: clamp(16px, 2.2vw, 32px);
  margin: 0;
  padding: 0;
  list-style: none;
}
.hero__partners li {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: calc(15px * var(--ui-scale));
  font-weight: 450;
  letter-spacing: -0.01em;
  color: rgba(255, 255, 255, 0.86);
}
.hero__partners li svg {
  width: calc(17px * var(--ui-scale));
  height: calc(17px * var(--ui-scale));
}

/* ---------- entrance ---------- */
.hero__note,
.hero__title,
.hero__sub,
.hero__cta,
.hero__stats,
.hero__foot {
  animation: rise 0.95s var(--ease-out) both;
}
.hero__title { animation-delay: 0.06s; }
.hero__sub { animation-delay: 0.14s; }
.hero__cta { animation-delay: 0.2s; }
.hero__stats { animation-delay: 0.28s; }
.hero__foot { animation-delay: 0.36s; }

@keyframes rise {
  from { opacity: 0; transform: translateY(22px); }
  to { opacity: 1; transform: none; }
}

/* ---------- responsive ---------- */
@media (min-width: 1120px) {
  .hero__inner {
    grid-template-columns: minmax(0, 1fr) minmax(0, 0.62fr);
    align-items: start;
  }
  .hero__ghost { display: block; justify-self: end; }
}

@media (max-width: 860px) {
  .hero { padding-top: 108px; }
  .hero__rules { display: none; }
  .hero__foot { flex-direction: column; align-items: flex-start; }
  .hero__partners { text-align: left; }
  .hero__partners ul { flex-wrap: wrap; }
  .hero__watermark { font-size: 3.4rem; }
}

@media (max-width: 560px) {
  .hero { --scale: 0.9; }
  .hero__title { letter-spacing: -0.03em; }
  .stat { flex: 1 1 140px; width: auto; }
  .hero__watermark { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .hero__video { opacity: 1; transform: none; }
  .hero__note,
  .hero__title,
  .hero__sub,
  .hero__cta,
  .hero__stats,
  .hero__foot { animation: none; }
}
```

## File: `src/components/icons.jsx`

```jsx
export const Logo = (props) => (
  <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" {...props}>
    <path d="M14 1.6 20.3 8 14 14.4 7.7 8 14 1.6Z" fill="#FF6A00" />
    <path d="M6.4 9.3 12.7 15.7 6.4 22.1 0.1 15.7 6.4 9.3Z" fill="#FF3D00" />
    <path d="M21.6 9.3 27.9 15.7 21.6 22.1 15.3 15.7 21.6 9.3Z" fill="#FF9A2E" />
  </svg>
)

export const Globe = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true" {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 3.7 5.7 3.7 9S14.5 18.4 12 21c-2.5-2.6-3.7-5.7-3.7-9S9.5 5.6 12 3Z" />
  </svg>
)

export const Chevron = (props) => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true" {...props}>
    <path d="m3 4.5 3 3 3-3" />
  </svg>
)

export const ArrowRight = (props) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M4 10h12M11 5l5 5-5 5" />
  </svg>
)

export const Menu = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" {...props}>
    <path d="M4 8h16M4 16h16" />
  </svg>
)

export const Close = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" {...props}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
)

/* Partner wordmarks — mark + text, drawn to sit on one baseline. */
export const partners = [
  {
    name: 'BookStore',
    mark: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M3 4.5A1.5 1.5 0 0 1 4.5 3H9v14H4.5A1.5 1.5 0 0 1 3 15.5v-11ZM17 4.5A1.5 1.5 0 0 0 15.5 3H11v14h4.5a1.5 1.5 0 0 0 1.5-1.5v-11Z" />
      </svg>
    ),
  },
  {
    name: 'zantic',
    mark: (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M2 3h16l-5.6 6.9L18 17H2l5.6-7.1L2 3Zm4.4 1.6 4 5 4-5h-8Z" />
      </svg>
    ),
  },
  {
    name: 'Crona',
    mark: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M10 2.5 17 10l-7 7.5L3 10l7-7.5Z" />
      </svg>
    ),
  },
  {
    name: 'Mercury',
    mark: (
      <svg viewBox="0 0 22 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 16V6l4.5 6L11 6l4.5 6L20 6v10" />
      </svg>
    ),
  },
  {
    name: 'Wagon',
    mark: (
      <svg viewBox="0 0 22 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 5l3.5 11L9 8l3.5 8L16 5" />
        <circle cx="19" cy="7" r="1.6" />
      </svg>
    ),
  },
]
```

## File: `public/favicon.svg`

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="46" fill="none" viewBox="0 0 48 46"><path fill="#863bff" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z" style="fill:#863bff;fill:color(display-p3 .5252 .23 1);fill-opacity:1"/><mask id="a" width="48" height="46" x="0" y="0" maskUnits="userSpaceOnUse" style="mask-type:alpha"><path fill="#000" d="M25.842 44.938c-.664.844-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.183c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.498 0-3.579-1.842-3.579H1.133c-.92 0-1.456-1.04-.92-1.787L9.91.473c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.578 1.842 3.578h11.377c.943 0 1.473 1.088.89 1.832L25.843 44.94z" style="fill:#000;fill-opacity:1"/></mask><g mask="url(#a)"><g filter="url(#b)"><ellipse cx="5.508" cy="14.704" fill="#ede6ff" rx="5.508" ry="14.704" style="fill:#ede6ff;fill:color(display-p3 .9275 .9033 1);fill-opacity:1" transform="matrix(.00324 1 1 -.00324 -4.47 31.516)"/></g><g filter="url(#c)"><ellipse cx="10.399" cy="29.851" fill="#ede6ff" rx="10.399" ry="29.851" style="fill:#ede6ff;fill:color(display-p3 .9275 .9033 1);fill-opacity:1" transform="matrix(.00324 1 1 -.00324 -39.328 7.883)"/></g><g filter="url(#d)"><ellipse cx="5.508" cy="30.487" fill="#7e14ff" rx="5.508" ry="30.487" style="fill:#7e14ff;fill:color(display-p3 .4922 .0767 1);fill-opacity:1" transform="rotate(89.814 -25.913 -14.639)scale(1 -1)"/></g><g filter="url(#e)"><ellipse cx="5.508" cy="30.599" fill="#7e14ff" rx="5.508" ry="30.599" style="fill:#7e14ff;fill:color(display-p3 .4922 .0767 1);fill-opacity:1" transform="rotate(89.814 -32.644 -3.334)scale(1 -1)"/></g><g filter="url(#f)"><ellipse cx="5.508" cy="30.599" fill="#7e14ff" rx="5.508" ry="30.599" style="fill:#7e14ff;fill:color(display-p3 .4922 .0767 1);fill-opacity:1" transform="matrix(.00324 1 1 -.00324 -34.34 30.47)"/></g><g filter="url(#g)"><ellipse cx="14.072" cy="22.078" fill="#ede6ff" rx="14.072" ry="22.078" style="fill:#ede6ff;fill:color(display-p3 .9275 .9033 1);fill-opacity:1" transform="rotate(93.35 24.506 48.493)scale(-1 1)"/></g><g filter="url(#h)"><ellipse cx="3.47" cy="21.501" fill="#7e14ff" rx="3.47" ry="21.501" style="fill:#7e14ff;fill:color(display-p3 .4922 .0767 1);fill-opacity:1" transform="rotate(89.009 28.708 47.59)scale(-1 1)"/></g><g filter="url(#i)"><ellipse cx="3.47" cy="21.501" fill="#7e14ff" rx="3.47" ry="21.501" style="fill:#7e14ff;fill:color(display-p3 .4922 .0767 1);fill-opacity:1" transform="rotate(89.009 28.708 47.59)scale(-1 1)"/></g><g filter="url(#j)"><ellipse cx=".387" cy="8.972" fill="#7e14ff" rx="4.407" ry="29.108" style="fill:#7e14ff;fill:color(display-p3 .4922 .0767 1);fill-opacity:1" transform="rotate(39.51 .387 8.972)"/></g><g filter="url(#k)"><ellipse cx="47.523" cy="-6.092" fill="#7e14ff" rx="4.407" ry="29.108" style="fill:#7e14ff;fill:color(display-p3 .4922 .0767 1);fill-opacity:1" transform="rotate(37.892 47.523 -6.092)"/></g><g filter="url(#l)"><ellipse cx="41.412" cy="6.333" fill="#47bfff" rx="5.971" ry="9.665" style="fill:#47bfff;fill:color(display-p3 .2799 .748 1);fill-opacity:1" transform="rotate(37.892 41.412 6.333)"/></g><g filter="url(#m)"><ellipse cx="-1.879" cy="38.332" fill="#7e14ff" rx="4.407" ry="29.108" style="fill:#7e14ff;fill:color(display-p3 .4922 .0767 1);fill-opacity:1" transform="rotate(37.892 -1.88 38.332)"/></g><g filter="url(#n)"><ellipse cx="-1.879" cy="38.332" fill="#7e14ff" rx="4.407" ry="29.108" style="fill:#7e14ff;fill:color(display-p3 .4922 .0767 1);fill-opacity:1" transform="rotate(37.892 -1.88 38.332)"/></g><g filter="url(#o)"><ellipse cx="35.651" cy="29.907" fill="#7e14ff" rx="4.407" ry="29.108" style="fill:#7e14ff;fill:color(display-p3 .4922 .0767 1);fill-opacity:1" transform="rotate(37.892 35.651 29.907)"/></g><g filter="url(#p)"><ellipse cx="38.418" cy="32.4" fill="#47bfff" rx="5.971" ry="15.297" style="fill:#47bfff;fill:color(display-p3 .2799 .748 1);fill-opacity:1" transform="rotate(37.892 38.418 32.4)"/></g></g><defs><filter id="b" width="60.045" height="41.654" x="-19.77" y="16.149" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="7.659"/></filter><filter id="c" width="90.34" height="51.437" x="-54.613" y="-7.533" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="7.659"/></filter><filter id="d" width="79.355" height="29.4" x="-49.64" y="2.03" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/></filter><filter id="e" width="79.579" height="29.4" x="-45.045" y="20.029" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/></filter><filter id="f" width="79.579" height="29.4" x="-43.513" y="21.178" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/></filter><filter id="g" width="74.749" height="58.852" x="15.756" y="-17.901" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="7.659"/></filter><filter id="h" width="61.377" height="25.362" x="23.548" y="2.284" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/></filter><filter id="i" width="61.377" height="25.362" x="23.548" y="2.284" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/></filter><filter id="j" width="56.045" height="63.649" x="-27.636" y="-22.853" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/></filter><filter id="k" width="54.814" height="64.646" x="20.116" y="-38.415" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/></filter><filter id="l" width="33.541" height="35.313" x="24.641" y="-11.323" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/></filter><filter id="m" width="54.814" height="64.646" x="-29.286" y="6.009" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/></filter><filter id="n" width="54.814" height="64.646" x="-29.286" y="6.009" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/></filter><filter id="o" width="54.814" height="64.646" x="8.244" y="-2.416" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/></filter><filter id="p" width="39.409" height="43.623" x="18.713" y="10.588" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/></filter></defs></svg>
```

## Design notes (context, not instructions to change anything)

- The brand name in the copy is **Fluxora** throughout — the navbar wordmark, the `<title>`, and the `aria-label`s all agree. Nothing about the source suggests a different working name; reproduce "Fluxora" everywhere it appears and nowhere else.
- Only the word **"Machines"** in the headline uses Instrument Serif italic (`<em>` inside `.hero__title`); every other character on the page is Inter / Inter Tight. This one-word serif swap is the design's single typographic gesture and should not be extended elsewhere.
- The four avatar dots in `.hero__proof` are flat two-stop gradient tints set via inline `--a`/`--b` custom properties, not photographs — there is no avatar image asset in this project.
- `ready` in `Hero.jsx` starts `false` and is flipped by `onCanPlay`; the `prefers-reduced-motion` branch pauses the video and forces `setReady(true)` immediately so a reduced-motion viewer is never left staring at a transparent `<video>`. Keep this exact logic.
- `.hero__ghost` is `display: none` below 1120px and only appears via the `@media (min-width: 1120px)` block, at a deliberately low, near-illegible opacity (`rgba(255,255,255,0.26)` and dimmer) — it's atmospheric texture, not a real feature panel with real copy to make legible.
- The stat cards' `150+` / `98%` and the `650+ Happy Clients` line are placeholder marketing figures baked into the markup, not data to fetch or verify.
- The navbar's own `Logo` (in `icons.jsx`) is drawn in the site's own flame colors (`#FF6A00`/`#FF3D00`/`#FF9A2E`). `public/favicon.svg`, by contrast, is an unrelated purple/blue abstract mark — reproduce it exactly as given regardless of the mismatch; it is the project's real, shipped favicon.
