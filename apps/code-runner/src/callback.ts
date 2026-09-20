import { RUNNER_SECRET_HEADER, type RunnerCallback } from '@guruji/types'
import type { RunnerEnv } from './config/env'

/** Long enough for a slow API, short enough that a wedged one is not a leak. */
const CALLBACK_TIMEOUT_MS = 10_000

export class CallbackError extends Error {}

/**
 * Hands the verdict back to the API, which is the only writer to the database.
 *
 * Deliberately not retried here. BullMQ owns retries: throwing puts the whole
 * job back with its attempt count and backoff intact, whereas a private retry
 * loop inside the handler would hold a worker slot while it spun and would
 * re-deliver the same result on top of BullMQ's own retry anyway.
 */
export async function postResult(env: RunnerEnv, payload: RunnerCallback): Promise<void> {
  const url = `${env.API_INTERNAL_URL.replace(/\/$/, '')}/${env.API_GLOBAL_PREFIX}/internal/submissions/callback`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [RUNNER_SECRET_HEADER]: env.CODE_RUNNER_SHARED_SECRET,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(CALLBACK_TIMEOUT_MS),
    })
  } catch (cause) {
    throw new CallbackError(`Callback to ${url} failed: ${String(cause)}`)
  }

  if (!response.ok) {
    throw new CallbackError(`Callback to ${url} returned ${String(response.status)}.`)
  }
}
