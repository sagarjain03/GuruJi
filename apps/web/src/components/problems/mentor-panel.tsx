'use client'

import { useMutation } from '@tanstack/react-query'
import { Lightbulb, Loader2, MessageCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { aiApi, type MentorAnalysis, type MentorExplanation } from '@/lib/api'
import { Button } from '@/components/ui/button'

const MAX_HINT_LEVEL = 4

export function MentorPanel({ problemSlug, code }: { problemSlug: string; code: string }) {
  const storageKey = `guruji:mentor-level:${problemSlug}`
  const [level, setLevel] = useState(1)
  const [message, setMessage] = useState('')
  const [explanation, setExplanation] = useState<MentorExplanation | null>(null)
  const [analysis, setAnalysis] = useState<MentorAnalysis | null>(null)

  useEffect(() => {
    const saved = Number(window.localStorage.getItem(storageKey))
    if (Number.isInteger(saved) && saved >= 1 && saved <= MAX_HINT_LEVEL) {
      setLevel(saved)
    }
  }, [storageKey])

  const hint = useMutation({
    mutationFn: () => aiApi.hint({ problemSlug, level, ...(message ? { message } : {}) }),
    onSuccess: () => {
      window.localStorage.setItem(storageKey, String(Math.min(level + 1, MAX_HINT_LEVEL)))
      setLevel((current) => Math.min(current + 1, MAX_HINT_LEVEL))
    },
  })

  const explain = useMutation({
    mutationFn: () => aiApi.explain({ problemSlug, ...(message ? { question: message } : {}) }),
    onSuccess: setExplanation,
  })

  const analyze = useMutation({
    mutationFn: () => aiApi.analyzeCode({ problemSlug, code }),
    onSuccess: setAnalysis,
  })

  return (
    <section className="border-primary/30 bg-primary/5 flex flex-col gap-3 border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] uppercase">
            <Lightbulb className="size-3.5" /> Mentor
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">Ask for a nudge. The answer stays yours.</p>
        </div>
        <span className="text-muted-foreground font-mono text-[10px] uppercase">Level {level}</span>
      </div>

      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="What part feels stuck?"
        rows={2}
        className="border-border bg-background focus:ring-primary/40 w-full resize-y border p-2 text-sm outline-none focus:ring-2"
      />

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => hint.mutate()} disabled={hint.isPending}>
          {hint.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Lightbulb className="size-3.5" />}
          Get hint
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => explain.mutate()} disabled={explain.isPending}>
          {explain.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <MessageCircle className="size-3.5" />}
          Explain concept
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => analyze.mutate()} disabled={analyze.isPending || code.length === 0}>
          {analyze.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <MessageCircle className="size-3.5" />}
          Analyze code
        </Button>
      </div>

      {hint.data && <div className="border-border bg-background border p-3 text-sm leading-relaxed">{hint.data.hint}</div>}
      {hint.isError && <p className="text-destructive text-xs">The mentor is unavailable right now.</p>}
      {analysis && (
        <div className="border-border bg-background flex flex-col gap-3 border p-3 text-sm">
          <MentorSection title="Correctness" value={analysis.correctness} />
          <MentorSection title="Complexity" value={`${analysis.timeComplexity} time, ${analysis.spaceComplexity} space`} />
          <MentorSection title="Issues" value={analysis.issues.map((issue) => issue.description).join(' ')} />
          <MentorSection title="Suggestions" value={analysis.suggestions.join(' ')} />
        </div>
      )}
      {explanation && (
        <div className="border-border bg-background flex flex-col gap-3 border p-3 text-sm">
          <MentorSection title="Intuition" value={explanation.intuition} />
          <MentorSection title="Example" value={explanation.example} />
          <MentorSection title="Implementation" value={explanation.implementation} />
          <MentorSection title="Complexity" value={explanation.complexity} />
          <MentorSection title="Common mistakes" value={explanation.commonMistakes.join(' ')} />
        </div>
      )}
    </section>
  )
}

function MentorSection({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <h3 className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">{title}</h3>
      <p className="mt-1 leading-relaxed">{value}</p>
    </div>
  )
}