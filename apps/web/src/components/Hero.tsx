'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { ArrowRight, Globe, patterns } from './icons'
import './Hero.css'

// WebGL needs a browser — this never renders on the server. Loading it lazily
// also keeps three.js out of the initial bundle, so the copy paints first.
const RobotScene = dynamic(() => import('./RobotScene'), { ssr: false })

const stats = [
  { value: '247+', label: 'Problems solved' },
  { value: '76%', label: 'Accuracy' },
]

const bars = [34, 52, 44, 70, 88]

export default function Hero() {
  const [ready, setReady] = useState(false)

  return (
    <section className="hero">
      <div className="hero__media">
        <div className={`hero__stage ${ready ? 'is-ready' : ''}`} aria-hidden="true">
          <RobotScene onReady={() => setReady(true)} />
        </div>
        <div className="hero__scrim" aria-hidden="true" />
        {/* Two rules, not the original three — the middle one ran straight down
            the figure's centre line. These flank it instead. */}
        <div className="hero__rules" aria-hidden="true">
          <span />
          <span />
        </div>
      </div>

      <div className="hero__inner">
        <div className="hero__lead">
          <p className="hero__note">
            <Globe className="hero__note-icon" />
            <span>
              Guided training for
              <br />
              developers everywhere
            </span>
          </p>

          <h1 className="hero__title">
            Train Your
            <br />
            DSA Skills
            <br />
            Like a <em>Pro</em>
          </h1>

          <p className="hero__sub">
            We measure what you actually understand and decide what you should practise next.
          </p>

          <div className="hero__cta">
            <a className="btn btn--accent hero__go" href="#main">
              Start training
              <span className="hero__go-dot" aria-hidden="true">
                <ArrowRight />
              </span>
            </a>

            <div className="hero__proof">
              <div className="hero__faces" aria-hidden="true">
                <i style={{ '--a': '#8b5cf6', '--b': '#c4b5fd' } as React.CSSProperties} />
                <i style={{ '--a': '#a78bfa', '--b': '#ddd6fe' } as React.CSSProperties} />
                <i style={{ '--a': '#6366f1', '--b': '#a5b4fc' } as React.CSSProperties} />
                <i style={{ '--a': '#4f46e5', '--b': '#818cf8' } as React.CSSProperties} />
              </div>
              <span className="hero__proof-text">
                <strong>10K+ Problems Practiced</strong>
                AI Guided Training
              </span>
            </div>
          </div>

          <ul className="hero__stats">
            {stats.map((stat) => (
              <li key={stat.label} className="stat">
                <span className="stat__mark" aria-hidden="true">
                  *
                </span>
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
            <p className="ghost__kpi">
              <strong>+42%</strong>Problem Solving
              <br />
              Performance
            </p>
          </div>
          <h2 className="ghost__title">Track Your Progress</h2>
          <p className="ghost__copy">
            We track every attempt through meaningful metrics and adapt the training path until the
            pattern feels effortless.
          </p>
        </aside>
      </div>

      <div className="hero__foot">
        <span className="hero__watermark" aria-hidden="true">
          GURU
        </span>
        <div className="hero__partners">
          <span className="hero__partners-label">Core Patterns</span>
          <ul>
            {patterns.map((pattern) => (
              <li key={pattern.name}>
                {pattern.mark}
                <span>{pattern.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
