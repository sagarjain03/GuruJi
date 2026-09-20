'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Draft, DraftsResponse, Language, StarterCode } from '@guruji/types'
import { draftApi } from '@/lib/api'

/** Long enough not to save on every keystroke, short enough to feel automatic. */
const AUTOSAVE_DELAY_MS = 1200

export type SaveStatus = 'clean' | 'pending' | 'saving' | 'saved' | 'error'

interface UseDrafts {
  code: string
  setCode: (code: string) => void
  status: SaveStatus
  isLoading: boolean
  /** Throws away the local edit and the saved draft, back to the starter code. */
  reset: () => void
}

/**
 * The code in the editor, and getting it to the server without losing any.
 *
 * The current code is *derived*, never copied into state on load:
 *
 *     local edit  ??  saved draft  ??  the problem's starter code
 *
 * Seeding state from the fetched draft instead would need an effect that fires
 * when the request lands, and that effect is the classic way to overwrite what
 * someone typed while the request was still in flight.
 */
export function useDrafts(
  slug: string,
  language: Language,
  starterCode: StarterCode,
): UseDrafts {
  const queryClient = useQueryClient()
  const [edits, setEdits] = useState<Partial<Record<Language, string>>>({})
  const [status, setStatus] = useState<SaveStatus>('clean')

  const query = useQuery({
    queryKey: ['drafts', slug],
    queryFn: () => draftApi.list(slug),
    staleTime: Infinity,
  })

  const saved = useMemo(() => {
    const map: Partial<Record<Language, string>> = {}
    for (const draft of query.data?.drafts ?? []) {
      map[draft.language] = draft.code
    }
    return map
  }, [query.data])

  const code = edits[language] ?? saved[language] ?? starterCode[language] ?? ''

  const mutation = useMutation({
    mutationFn: ({ language: lang, code: body }: { language: Language; code: string }) =>
      draftApi.save(slug, lang, body),
    onSuccess: (draft: Draft) => {
      // Written straight into the cache. Invalidating would refetch every
      // language's draft on every autosave, and the answer is already here.
      queryClient.setQueryData(['drafts', slug], (old: DraftsResponse | undefined) => {
        const others = (old?.drafts ?? []).filter((d) => d.language !== draft.language)
        return { drafts: [...others, draft] }
      })
      setStatus('saved')
    },
    onError: () => {
      setStatus('error')
    },
  })

  const setCode = useCallback(
    (next: string) => {
      setEdits((current) => ({ ...current, [language]: next }))
      setStatus('pending')
    },
    [language],
  )

  const save = useRef(mutation.mutate)
  useEffect(() => {
    save.current = mutation.mutate
  }, [mutation.mutate])

  // Latest values, readable from an effect that must not re-run when they
  // change. Written in effects because a ref may not be assigned during render.
  const editsRef = useRef(edits)
  useEffect(() => {
    editsRef.current = edits
  }, [edits])
  const savedRef = useRef(saved)
  useEffect(() => {
    savedRef.current = saved
  }, [saved])

  /**
   * Flush the language you are leaving.
   *
   * The autosave timer below is cancelled whenever `language` changes, so an
   * edit made less than the debounce ago would simply be dropped — type a line
   * of C++, switch to Python to check something, and the C++ is gone. Switching
   * saves it immediately instead of waiting.
   */
  const previousLanguage = useRef(language)
  useEffect(() => {
    const leaving = previousLanguage.current
    previousLanguage.current = language
    if (leaving === language) {
      return
    }

    const unsaved = editsRef.current[leaving]
    if (unsaved !== undefined && unsaved !== savedRef.current[leaving]) {
      save.current({ language: leaving, code: unsaved })
    }
  }, [language])

  const pending = edits[language]
  useEffect(() => {
    if (pending === undefined || pending === saved[language]) {
      return
    }

    const timer = setTimeout(() => {
      setStatus('saving')
      save.current({ language, code: pending })
    }, AUTOSAVE_DELAY_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [pending, language, saved])

  /**
   * A tab close does not wait for a 1.2 second timer, and a plain `fetch` is
   * cancelled along with the page. `keepalive` is what lets the browser finish
   * the request after the document is gone.
   */
  useEffect(() => {
    const flush = (): void => {
      const unsaved = edits[language]
      if (unsaved !== undefined && unsaved !== saved[language]) {
        void draftApi.save(slug, language, unsaved, true)
      }
    }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
    }
  }, [edits, language, saved, slug])

  const reset = useCallback(() => {
    const starter = starterCode[language] ?? ''
    setEdits((current) => ({ ...current, [language]: starter }))
    setStatus('pending')
  }, [language, starterCode])

  return {
    code,
    setCode,
    status: mutation.isPending ? 'saving' : status,
    isLoading: query.isPending,
    reset,
  }
}
