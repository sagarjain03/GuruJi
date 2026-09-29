'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { loadBoard, saveBoard, type BoardState } from './model'

const HISTORY_CAP = 100
/** Changes under one key this close together are one undo step: a word typed, a drag. */
const COALESCE_MS = 700
const SAVE_DELAY_MS = 300

interface History {
  past: BoardState[]
  present: BoardState
  future: BoardState[]
}

/**
 * The board's state with undo, redo and saving.
 *
 * Whether a change merges into the previous undo step is decided *outside* the
 * state updater: React may run an updater twice in development, and a
 * decision that mutates a ref inside it would merge every change into the last.
 */
export function useBoard(slug: string) {
  const [history, setHistory] = useState<History>(() => ({ past: [], present: loadBoard(slug), future: [] }))
  const last = useRef<{ key: string; at: number } | null>(null)

  const change = useCallback((update: (board: BoardState) => BoardState, coalesceKey?: string) => {
    const now = Date.now()
    const merge = coalesceKey !== undefined && last.current?.key === coalesceKey && now - last.current.at < COALESCE_MS
    last.current = coalesceKey === undefined ? null : { key: coalesceKey, at: now }

    setHistory((current) => {
      const next = update(current.present)
      if (next === current.present) return current
      return {
        past: merge ? current.past : [...current.past, current.present].slice(-HISTORY_CAP),
        present: next,
        future: [],
      }
    })
  }, [])

  const undo = useCallback(() => {
    last.current = null
    setHistory((current) => {
      const previous = current.past.at(-1)
      if (previous === undefined) return current
      return { past: current.past.slice(0, -1), present: previous, future: [current.present, ...current.future] }
    })
  }, [])

  const redo = useCallback(() => {
    last.current = null
    setHistory((current) => {
      const [next, ...rest] = current.future
      if (next === undefined) return current
      return { past: [...current.past, current.present], present: next, future: rest }
    })
  }, [])

  // Save shortly after the last change, and once more on the way out so a
  // change made just before closing is not lost to the timer.
  const latest = useRef(history.present)
  useEffect(() => {
    latest.current = history.present
    const timer = setTimeout(() => {
      saveBoard(slug, history.present)
    }, SAVE_DELAY_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [slug, history.present])
  useEffect(
    () => () => {
      saveBoard(slug, latest.current)
    },
    [slug],
  )

  return {
    board: history.present,
    change,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  }
}
