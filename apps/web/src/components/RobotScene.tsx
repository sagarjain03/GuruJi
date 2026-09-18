'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, useGLTF } from '@react-three/drei'
import { Suspense, useEffect, useRef } from 'react'
import type { Group } from 'three'

const MODEL_URL = '/robot.glb'

const REST_YAW = -0.2
const MAX_PITCH = 0.26
const IDLE_AFTER_MS = 2600

/** Shared pointer/drag state. A ref, not React state — this updates every frame
 *  and every pointermove, and re-rendering the scene at that rate would be absurd. */
type Input = {
  hoverX: number
  hoverY: number
  dragYaw: number
  dragPitch: number
  spin: number
  dragging: boolean
  lastInputAt: number
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/**
 * Pointer handling lives on `window`, not on the canvas.
 *
 * The canvas sits at z-index -1 behind the copy, so it never receives a pointer
 * event of its own. Listening on the window means the whole hero is draggable
 * without putting the WebGL layer in front of the text — and a `closest()` check
 * bails out on links and buttons, so the CTA and nav keep working normally.
 *
 * Drag is mouse-only on purpose. Capturing touchmove would have to preventDefault
 * to rotate, which kills page scroll on the one device where the hero fills the
 * whole screen. Touch users keep the idle sway.
 */
function usePointerInput(input: React.RefObject<Input>) {
  useEffect(() => {
    const state = input.current
    if (!state) return

    const onMove = (e: PointerEvent) => {
      // -1..1 across the viewport, centre is 0.
      const nx = (e.clientX / window.innerWidth) * 2 - 1
      const ny = (e.clientY / window.innerHeight) * 2 - 1

      if (state.dragging) {
        const dx = nx - state.hoverX
        const dy = ny - state.hoverY
        state.dragYaw += dx * 2.4
        state.dragPitch = clamp(state.dragPitch + dy * 1.1, -MAX_PITCH, MAX_PITCH)
        state.spin = dx * 2.4
      }

      state.hoverX = nx
      state.hoverY = ny
      state.lastInputAt = performance.now()
    }

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      // Never swallow a click meant for the CTA, a nav link or the burger.
      if ((e.target as HTMLElement | null)?.closest('a, button, input, textarea')) return
      state.dragging = true
      state.spin = 0
      document.body.dataset.dragging = 'true'
    }

    const onUp = () => {
      if (!state.dragging) return
      state.dragging = false
      state.lastInputAt = performance.now()
      delete document.body.dataset.dragging
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('blur', onUp)

    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('blur', onUp)
      delete document.body.dataset.dragging
    }
  }, [input])
}

function Robot({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<Group>(null)
  const { scene } = useGLTF(MODEL_URL)

  const input = useRef<Input>({
    hoverX: 0,
    hoverY: 0,
    dragYaw: 0,
    dragPitch: 0,
    spin: 0,
    dragging: false,
    lastInputAt: 0,
  })

  usePointerInput(input)

  useFrame((state, delta) => {
    const g = group.current
    const io = input.current
    if (!g) return

    const t = state.clock.elapsedTime
    const idle = !io.dragging && performance.now() - io.lastInputAt > IDLE_AFTER_MS

    // Release inertia: the last drag velocity keeps feeding yaw and decays away,
    // so letting go coasts instead of stopping dead.
    if (!io.dragging && Math.abs(io.spin) > 0.0001) {
      io.dragYaw += io.spin * delta * 3
      io.spin *= Math.exp(-3.5 * delta)
    }

    // Idle sway only resumes once the pointer has been still for a moment —
    // otherwise it fights the user while they are aiming at something.
    const sway = idle && !reducedMotion ? Math.sin(t * 0.22) * 0.32 : 0

    const targetYaw = REST_YAW + io.dragYaw + io.hoverX * 0.45 + sway
    const targetPitch = clamp(io.dragPitch + io.hoverY * 0.14, -MAX_PITCH, MAX_PITCH)
    const targetY = -0.02 + (reducedMotion ? 0 : Math.sin(t * 0.5) * 0.015)

    // Frame-rate independent damping: the exponential means a 144Hz monitor and a
    // 60Hz laptop converge at the same real-world speed. A plain `* 0.1` lerp does not.
    const k = io.dragging ? 22 : 4.5
    const a = 1 - Math.exp(-k * delta)

    g.rotation.y += (targetYaw - g.rotation.y) * a
    g.rotation.x += (targetPitch - g.rotation.x) * a
    g.position.y += (targetY - g.position.y) * a
  })

  // The model is 1 unit tall on its own origin. At camera z=3.4 / fov 38° the
  // frustum is ~2.34 units high, so anything past ~2.0 crops the head.
  return (
    <group ref={group} position={[0, -0.02, 0]} rotation={[0, REST_YAW, 0]} scale={2}>
      <primitive object={scene} />
    </group>
  )
}

export default function RobotScene({ onReady }: { onReady: () => void }) {
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <Canvas
      camera={{ position: [0, 0, 3.4], fov: 38 }}
      // Capped DPR: at 2x scale this model fills the viewport, and rendering it at
      // a phone's native 3x costs far more than it shows.
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={onReady}
      style={{ background: 'transparent' }}
    >
      {/* Key light from the upper left, matching where the copy sits. */}
      <directionalLight position={[-3, 2.5, 2]} intensity={2.1} color="#ffffff" />
      {/* Violet rim from behind-right — the one place the accent touches the art. */}
      <directionalLight position={[3.5, 1, -2]} intensity={3.4} color="#8b5cf6" />
      {/* Cool fill so the shadow side reads graphite rather than black. */}
      <directionalLight position={[2, -1.5, 1.5]} intensity={0.5} color="#6366f1" />
      <ambientLight intensity={0.35} />

      <Suspense fallback={null}>
        <Robot reducedMotion={reducedMotion} />
        {/* Studio HDRI drives the metal. Without it a metallic material has
            nothing to reflect and renders as flat black. */}
        <Environment preset="studio" environmentIntensity={0.42} />
      </Suspense>
    </Canvas>
  )
}

useGLTF.preload(MODEL_URL)
