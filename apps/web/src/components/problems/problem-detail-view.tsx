'use client'

import { useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { DifficultyBadge, ErrorState, LoadingState } from '@/components/content/states'
import { Markdown } from '@/components/markdown'
import { ApiError, contentApi } from '@/lib/api'

export function ProblemDetailView({ slug }: { slug: string }) {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['problem', slug],
    queryFn: () => contentApi.problem(slug),
    // A 404 is an answer, not a transport failure. Retrying it just delays the
    // message by a couple of seconds.
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 1,
  })

  if (isPending) {
    return <LoadingState label="Loading the problem…" />
  }

  if (isError) {
    const missing = error instanceof ApiError && error.status === 404
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState
          message={missing ? 'That problem does not exist.' : 'The problem could not be loaded.'}
          {...(missing
            ? {}
            : {
                onRetry: () => {
                  void refetch()
                },
              })}
        />
      </div>
    )
  }

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link
        href="/problems"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.14em] uppercase"
      >
        <ChevronLeft className="size-3" />
        All problems
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{data.title}</h1>
          <DifficultyBadge difficulty={data.difficulty} />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[...data.topics, ...data.patterns].map((tag) => (
            <span
              key={tag.slug}
              className="border-border/60 text-muted-foreground border px-2 py-0.5 font-mono text-[10px]"
            >
              {tag.name}
            </span>
          ))}
        </div>

        <dl className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] tracking-[0.12em] uppercase">
          <Meta label="Time limit" value={`${data.timeLimitMs} ms`} />
          <Meta label="Memory" value={`${data.memoryLimitMb} MB`} />
          <Meta label="Estimated" value={`${data.estimatedMinutes} min`} />
          <Meta
            label="Acceptance"
            value={
              data.acceptanceRate === null ? 'no data' : `${Math.round(data.acceptanceRate * 100)}%`
            }
          />
          <Meta label="Hints" value={String(data.hintCount)} />
        </dl>
      </header>

      <Section title="Statement">
        <Markdown content={data.statement} />
      </Section>

      <Section title="Constraints">
        <Markdown content={data.constraints} />
      </Section>

      <Section title="Examples">
        <div className="flex flex-col gap-3">
          {data.examples.map((example, index) => (
            <div key={index} className="border-border bg-card/70 border p-4">
              <p className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
                Example {index + 1}
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <Block label="Input" value={example.input} />
                <Block label="Output" value={example.output} />
              </div>
              {example.explanation !== null && (
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                  {example.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Sample test cases">
        <div className="flex flex-col gap-3">
          {data.sampleTestCases.map((testCase) => (
            <div
              key={testCase.id}
              className="border-border bg-card/70 grid gap-3 border p-4 sm:grid-cols-2"
            >
              <Block label="Input" value={testCase.input} />
              <Block label="Expected" value={testCase.expectedOutput} />
            </div>
          ))}
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          These are the cases you can see. Submissions are graded against more.
        </p>
      </Section>

      <p className="border-border text-muted-foreground border border-dashed p-4 text-xs">
        The editor, the hint ladder and Run/Submit arrive in Phases 3 and 4. Until the runner exists
        there is nothing honest to put here, so there is nothing here.
      </p>
    </article>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-muted-foreground font-mono text-[10px] tracking-[0.18em] uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <dt>{label}</dt>
      <dd className="text-foreground/80">{value}</dd>
    </div>
  )
}

function Block({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
        {label}
      </p>
      <pre className="bg-muted mt-1 overflow-x-auto p-2 font-mono text-xs whitespace-pre-wrap">
        {value}
      </pre>
    </div>
  )
}
