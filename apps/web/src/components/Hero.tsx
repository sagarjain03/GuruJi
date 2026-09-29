'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, useSyncExternalStore } from 'react'
import GradientButton from '@/components/ui/button-1'
import { ArrowRight, Globe, patterns } from './icons'
import './Hero.css'

// WebGL needs a browser — this never renders on the server. The chunk (three.js
// and the model) is only requested once `stage` says so, never on first paint.
const RobotScene = dynamic(() => import('./RobotScene'), { ssr: false })

type Stage = 'pending' | 'scene' | 'poster'

/**
 * Phones and reduced-motion get a still image and never download three.js.
 * Everyone else gets the live scene, started only after the page has loaded
 * and the main thread is idle, so it never competes with the copy or the CTA.
 */
const STILL_QUERIES = ['(max-width: 767px)', '(prefers-reduced-motion: reduce)']

function subscribeToStill(onChange: () => void): () => void {
  const lists = STILL_QUERIES.map((query) => window.matchMedia(query))
  for (const list of lists) list.addEventListener('change', onChange)
  return () => {
    for (const list of lists) list.removeEventListener('change', onChange)
  }
}

/** Null on the server, where the screen is unknown. */
function useStill(): boolean | null {
  return useSyncExternalStore(
    subscribeToStill,
    () => STILL_QUERIES.some((query) => window.matchMedia(query).matches),
    () => null,
  )
}

function useStage(): Stage {
  const still = useStill()
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (still !== false) return

    let idle = 0
    let timer = 0
    const start = () => {
      if (typeof window.requestIdleCallback === 'function') {
        idle = window.requestIdleCallback(() => setLoaded(true), { timeout: 2000 })
      } else {
        timer = window.setTimeout(() => setLoaded(true), 200)
      }
    }
    if (document.readyState === 'complete') start()
    else window.addEventListener('load', start, { once: true })

    return () => {
      window.removeEventListener('load', start)
      if (idle) window.cancelIdleCallback(idle)
      window.clearTimeout(timer)
    }
  }, [still])

  if (still === null) return 'pending'
  if (still) return 'poster'
  return loaded ? 'scene' : 'pending'
}

export default function Hero() {
  const [ready, setReady] = useState(false)
  const stage = useStage()

  return (
    <section className="hero">
      <div className="hero__media">
        {/* Behind the canvas: a silver sheen across the ground and a pool of
            light on the floor, which the robot's contact shadow darkens. */}
        <div className="hero__sheen" aria-hidden="true" />
        <div
          className={`hero__stage ${ready || stage === 'poster' ? 'is-ready' : ''}`}
          aria-hidden="true"
        >
          {stage === 'scene' && <RobotScene onReady={() => setReady(true)} />}
          {stage === 'poster' && (
            // eslint-disable-next-line @next/next/no-img-element -- a fixed, pre-sized still; next/image adds nothing here
            <img className="hero__poster" src="/robot-poster.webp" alt="" decoding="async" />
          )}
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
            Know What
            <br />
            to Practise
            <br />
            <em>Next</em>
          </h1>

          <p className="hero__sub">
            We measure what you actually understand and decide what you should practise next.
          </p>

          <div className="hero__cta">
            <GradientButton href="/register" width="200px" height="52px" className="hero__go">
              Start training
              <ArrowRight aria-hidden="true" />
            </GradientButton>
          </div>
        </div>
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
