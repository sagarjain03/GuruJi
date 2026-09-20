'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  Language,
  SubmissionDetail,
  SubmissionResultEvent,
  SubmissionStatus,
  SubmissionStatusEvent,
} from '@guruji/types'
import { ApiError, submissionApi } from '@/lib/api'
import { getSocket } from '@/lib/socket'

/**
 * The socket is the fast path, not the only path.
 *
 * A tab that was backgrounded, a dropped connection, or a verdict that landed
 * during a reconnect all end the same way: a spinner that never stops. So a
 * submission with no result after this long is fetched over HTTP instead.
 */
const FALLBACK_POLL_MS = 4000

export type RunKind = 'run' | 'submit'

export interface UseSubmission {
  /** Null until something has been run in this session. */
  submission: SubmissionDetail | null
  status: SubmissionStatus | null
  kind: RunKind | null
  isBusy: boolean
  error: string | null
  start: (kind: RunKind, language: Language, code: string) => void
}

export function useSubmission(problemId: string): UseSubmission {
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null)
  const [status, setStatus] = useState<SubmissionStatus | null>(null)
  const [kind, setKind] = useState<RunKind | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Read by the socket handlers, which must not be re-bound every time the id
  // changes — that would drop events arriving between teardown and re-subscribe.
  const currentId = useRef<string | null>(null)
  useEffect(() => {
    currentId.current = submissionId
  }, [submissionId])

  const start = useCallback(
    (nextKind: RunKind, language: Language, code: string) => {
      setError(null)
      setKind(nextKind)
      setSubmission(null)
      setStatus('QUEUED')

      void submissionApi
        .submit({
          problemId,
          language,
          code,
          isRun: nextKind === 'run',
          timeSpentMs: 0,
          hintsUsedAtSubmit: 0,
        })
        .then((accepted) => {
          setSubmissionId(accepted.id)
        })
        .catch((cause: unknown) => {
          // The rate limit is the one a user will actually hit, and "nothing
          // happened" is the worst possible response to it.
          setError(
            cause instanceof ApiError ? cause.message : 'Could not reach the server.',
          )
          setStatus(null)
          setKind(null)
        })
    },
    [problemId],
  )

  useEffect(() => {
    const socket = getSocket()

    const onStatus = (event: SubmissionStatusEvent): void => {
      if (event.submissionId === currentId.current) {
        setStatus(event.status)
      }
    }
    const onResult = (event: SubmissionResultEvent): void => {
      if (event.submissionId === currentId.current) {
        setSubmission(event.submission)
        setStatus(event.submission.status)
      }
    }

    socket.on('submission:status', onStatus)
    socket.on('submission:result', onResult)

    return () => {
      socket.off('submission:status', onStatus)
      socket.off('submission:result', onResult)
    }
  }, [])

  // The fallback. It only runs while a submission is outstanding, and it stops
  // as soon as one arrives by either route.
  useEffect(() => {
    if (submissionId === null || submission !== null) {
      return
    }

    const timer = setInterval(() => {
      void submissionApi
        .get(submissionId)
        .then((fetched) => {
          setStatus(fetched.status)
          if (fetched.status === 'COMPLETED' || fetched.status === 'FAILED') {
            setSubmission(fetched)
          }
        })
        .catch(() => {
          // A failed poll is not worth reporting: the next one is 4 seconds away.
        })
    }, FALLBACK_POLL_MS)

    return () => {
      clearInterval(timer)
    }
  }, [submissionId, submission])

  return {
    submission,
    status,
    kind,
    isBusy: status === 'QUEUED' || status === 'RUNNING',
    error,
    start,
  }
}
