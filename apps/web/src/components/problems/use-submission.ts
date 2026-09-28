'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type {
  Language,
  SubmissionDetail,
  SubmissionResultEvent,
  SubmissionStatus,
  SubmissionStatusEvent,
} from '@guruji/types'
import { ApiError, contestApi, submissionApi } from '@/lib/api'
import { getSocket } from '@/lib/socket'
import { VERDICT_LABEL } from '@/components/problems/result-panel'

/**
 * The socket is the fast path, not the only path.
 *
 * A tab that was backgrounded, a dropped connection, or a verdict that landed
 * during a reconnect all end the same way: a spinner that never stops. So a
 * submission with no result after this long is fetched over HTTP instead.
 */
const FALLBACK_POLL_MS = 4000

export type RunKind = 'run' | 'submit'

/**
 * One toast per verdict. The socket and the fallback poll can both deliver the
 * same result, so the submission id doubles as the toast id — a second arrival
 * replaces the first instead of stacking.
 */
function announce(submission: SubmissionDetail): void {
  const verdict = submission.verdict ?? 'INTERNAL_ERROR'
  const label = VERDICT_LABEL[verdict]
  const title = submission.isRun ? `Run: ${label}` : label
  if (verdict === 'ACCEPTED') {
    toast.success(title, { id: submission.id })
  } else if (verdict === 'INTERNAL_ERROR') {
    toast.warning(title, { id: submission.id })
  } else {
    toast.error(title, { id: submission.id })
  }
}

export interface UseSubmission {
  /** Null until something has been run in this session. */
  submission: SubmissionDetail | null
  status: SubmissionStatus | null
  kind: RunKind | null
  isBusy: boolean
  error: string | null
  start: (kind: RunKind, language: Language, code: string) => void
}

/**
 * @param contestId set while a mock contest is running: Submit then goes through
 * the contest, which records it against the clock. Run is never part of a
 * contest and keeps going to `/submissions`.
 */
export function useSubmission(problemId: string, contestId: string | null = null): UseSubmission {
  const queryClient = useQueryClient()
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

      const request =
        nextKind === 'submit' && contestId !== null
          ? contestApi.submit(contestId, { problemId, language, code, timeSpentMs: 0 })
          : submissionApi.submit({
              problemId,
              language,
              code,
              isRun: nextKind === 'run',
              timeSpentMs: 0,
              hintsUsedAtSubmit: 0,
            })

      void request
        .then((accepted) => {
          setSubmissionId(accepted.id)
          // The contest's problem states just changed; the cached view is stale.
          if (nextKind === 'submit' && contestId !== null) {
            void queryClient.invalidateQueries({ queryKey: ['contest'] })
          }
        })
        .catch((cause: unknown) => {
          // The rate limit is the one a user will actually hit, and "nothing
          // happened" is the worst possible response to it.
          const message = cause instanceof ApiError ? cause.message : 'Could not reach the server.'
          setError(message)
          toast.error(message)
          setStatus(null)
          setKind(null)
        })
    },
    [problemId, contestId, queryClient],
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
        announce(event.submission)
        // A verdict can move a contest problem from attempted to solved.
        void queryClient.invalidateQueries({ queryKey: ['contest'] })
        // A graded verdict may cross a badge tier; a sample run never does.
        if (!event.submission.isRun) void queryClient.invalidateQueries({ queryKey: ['achievements'] })
      }
    }

    socket.on('submission:status', onStatus)
    socket.on('submission:result', onResult)

    return () => {
      socket.off('submission:status', onStatus)
      socket.off('submission:result', onResult)
    }
  }, [queryClient])

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
            announce(fetched)
            void queryClient.invalidateQueries({ queryKey: ['contest'] })
            if (!fetched.isRun) void queryClient.invalidateQueries({ queryKey: ['achievements'] })
          }
        })
        .catch(() => {
          // A failed poll is not worth reporting: the next one is 4 seconds away.
        })
    }, FALLBACK_POLL_MS)

    return () => {
      clearInterval(timer)
    }
  }, [submissionId, submission, queryClient])

  return {
    submission,
    status,
    kind,
    isBusy: status === 'QUEUED' || status === 'RUNNING',
    error,
    start,
  }
}
