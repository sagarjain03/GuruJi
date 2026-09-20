'use client'

import type { SubmissionDetail, SubmissionResult, SubmissionStatus, Verdict } from '@guruji/types'
import { cn } from '@/lib/utils'

/**
 * Every verdict says what it means in words.
 *
 * Colour is a second channel here, never the only one — "green box" is not a
 * message to someone who cannot see it, and `TIME_LIMIT_EXCEEDED` in red is not
 * self-explanatory to someone meeting it for the first time.
 */
const VERDICT_LABEL: Record<Verdict, string> = {
  ACCEPTED: 'Accepted',
  WRONG_ANSWER: 'Wrong answer',
  TIME_LIMIT_EXCEEDED: 'Time limit exceeded',
  MEMORY_LIMIT_EXCEEDED: 'Memory limit exceeded',
  RUNTIME_ERROR: 'Runtime error',
  COMPILE_ERROR: 'Compile error',
  INTERNAL_ERROR: 'Our problem, not yours',
}

const VERDICT_HINT: Record<Verdict, string> = {
  ACCEPTED: 'Every test case passed inside the limits.',
  WRONG_ANSWER: 'It ran cleanly, but the output did not match.',
  TIME_LIMIT_EXCEEDED: 'It was still running when the clock ran out.',
  MEMORY_LIMIT_EXCEEDED: 'It asked for more memory than the limit allows.',
  RUNTIME_ERROR: 'It stopped part way through — the message below says where.',
  COMPILE_ERROR: 'It did not build. The compiler output is below.',
  INTERNAL_ERROR: 'Something broke on our side. This does not count against you.',
}

const VERDICT_TONE: Record<Verdict, string> = {
  ACCEPTED: 'border-easy/40 bg-easy/10 text-easy',
  WRONG_ANSWER: 'border-hard/40 bg-hard/10 text-hard',
  TIME_LIMIT_EXCEEDED: 'border-medium/40 bg-medium/10 text-medium',
  MEMORY_LIMIT_EXCEEDED: 'border-medium/40 bg-medium/10 text-medium',
  RUNTIME_ERROR: 'border-hard/40 bg-hard/10 text-hard',
  COMPILE_ERROR: 'border-hard/40 bg-hard/10 text-hard',
  INTERNAL_ERROR: 'border-border bg-muted text-muted-foreground',
}

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  QUEUED: 'Queued…',
  RUNNING: 'Running…',
  COMPLETED: 'Done',
  FAILED: 'Failed',
}

export function ResultPanel({
  submission,
  status,
}: {
  submission: SubmissionDetail | null
  status: SubmissionStatus | null
}) {
  if (submission === null) {
    return (
      <p role="status" className="text-muted-foreground font-mono text-xs">
        {status === null ? 'Nothing run yet.' : STATUS_LABEL[status]}
      </p>
    )
  }

  const verdict = submission.verdict ?? 'INTERNAL_ERROR'

  return (
    <div className="flex flex-col gap-3">
      <div className={cn('border p-3', VERDICT_TONE[verdict])}>
        <p className="font-mono text-xs tracking-[0.14em] uppercase">{VERDICT_LABEL[verdict]}</p>
        <p className="mt-1 text-xs opacity-80">{VERDICT_HINT[verdict]}</p>
      </div>

      <dl className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px]">
        <Stat label="Passed" value={`${String(submission.passedCount)} / ${String(submission.totalCount)}`} />
        {submission.runtimeMs !== null && (
          <Stat label="Slowest case" value={`${String(submission.runtimeMs)} ms`} />
        )}
        {submission.memoryKb !== null && (
          <Stat label="Memory" value={`${String(submission.memoryKb)} KB`} />
        )}
        <Stat label="Graded" value={submission.isRun ? 'samples only' : 'all cases'} />
      </dl>

      {submission.compileOutput !== null && submission.compileOutput.length > 0 && (
        <div>
          <p className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
            Compiler output
          </p>
          <pre className="bg-muted mt-1 max-h-40 overflow-auto p-2 font-mono text-xs whitespace-pre-wrap">
            {submission.compileOutput}
          </pre>
        </div>
      )}

      <ol className="flex flex-col gap-2">
        {submission.results.map((result) => (
          <TestResult key={result.index} result={result} />
        ))}
      </ol>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="tracking-[0.12em] uppercase">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  )
}

/**
 * A hidden case shows whether it passed and how long it took, and no more.
 *
 * Its input, its expected output and the program's answer to it are each most
 * of the way to reconstructing the secret input — the server does not send
 * them, and this is the shape that reflects it.
 */
function TestResult({ result }: { result: SubmissionResult }) {
  return (
    <li className="border-border border p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'font-mono text-[10px] tracking-[0.14em] uppercase',
            result.passed ? 'text-easy' : 'text-hard',
          )}
        >
          {result.passed ? 'Pass' : 'Fail'}
        </span>
        <span className="text-muted-foreground font-mono text-[10px] tracking-[0.12em] uppercase">
          Case {String(result.index + 1)}
          {result.isSample ? ' · sample' : ' · hidden'}
        </span>
        {result.runtimeMs !== null && (
          <span className="text-muted-foreground ml-auto font-mono text-[10px]">
            {String(result.runtimeMs)} ms
          </span>
        )}
      </div>

      {result.errorMessage !== undefined && (
        <pre className="bg-muted mt-2 max-h-32 overflow-auto p-2 font-mono text-xs whitespace-pre-wrap">
          {result.errorMessage}
        </pre>
      )}

      {result.isSample && !result.passed && (
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <Pane label="Input" value={result.input ?? ''} />
          <Pane label="Expected" value={result.expectedOutput ?? ''} />
          <Pane label="Got" value={result.actualOutput ?? ''} />
        </div>
      )}
    </li>
  )
}

function Pane({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
        {label}
      </p>
      <pre className="bg-muted mt-1 max-h-28 overflow-auto p-2 font-mono text-xs whitespace-pre-wrap">
        {value}
      </pre>
    </div>
  )
}
