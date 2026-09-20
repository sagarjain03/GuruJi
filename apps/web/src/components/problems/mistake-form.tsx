'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  MISTAKE_CATEGORY_LABEL,
  MISTAKE_TEXT_MAX,
  type MistakeCategory,
} from '@guruji/types'
import { Button } from '@/components/ui/button'
import { ApiError, mistakeApi } from '@/lib/api'
import { cn } from '@/lib/utils'

const CATEGORIES = Object.keys(MISTAKE_CATEGORY_LABEL) as MistakeCategory[]

/**
 * Offered after a wrong answer, and never before one.
 *
 * The moment a submission fails is the only moment the reason is still in the
 * user's head. A journal you have to remember to open is a journal nobody
 * writes in, and an empty journal aggregates into nothing.
 */
export function MistakeForm({
  problemId,
  submissionId,
}: {
  problemId: string
  submissionId: string
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<MistakeCategory>('LOGIC')
  const [whatWentWrong, setWhatWentWrong] = useState('')
  const [correctIdea, setCorrectIdea] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      mistakeApi.create({
        problemId,
        submissionId,
        category,
        whatWentWrong: whatWentWrong.trim(),
        ...(correctIdea.trim().length === 0 ? {} : { correctIdea: correctIdea.trim() }),
      }),
    onSuccess: () => {
      // The aggregation on the journal page is now out of date. Marked stale
      // rather than refetched: the user is still on the problem page and does
      // not need the list fetched behind them.
      void queryClient.invalidateQueries({ queryKey: ['mistakes'], refetchType: 'none' })
      setOpen(false)
      setWhatWentWrong('')
      setCorrectIdea('')
    },
  })

  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setOpen(true)
        }}
      >
        Log what went wrong
      </Button>
    )
  }

  return (
    <form
      className="border-border flex flex-col gap-2 border p-3"
      onSubmit={(event) => {
        event.preventDefault()
        mutation.mutate()
      }}
    >
      <fieldset className="flex flex-wrap gap-1">
        <legend className="text-muted-foreground mb-1 font-mono text-[10px] tracking-[0.14em] uppercase">
          What kind of mistake
        </legend>
        {CATEGORIES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={category === option}
            onClick={() => {
              setCategory(option)
            }}
            className={cn(
              'border-border text-muted-foreground border px-2 py-1 text-[11px]',
              category === option && 'bg-primary text-primary-foreground border-primary',
            )}
          >
            {MISTAKE_CATEGORY_LABEL[option]}
          </button>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
          What went wrong
        </span>
        <textarea
          required
          maxLength={MISTAKE_TEXT_MAX}
          value={whatWentWrong}
          onChange={(event) => {
            setWhatWentWrong(event.target.value)
          }}
          placeholder="I assumed the array was sorted."
          className="border-border bg-background/40 placeholder:text-muted-foreground h-16 w-full resize-none border p-2 text-xs outline-none focus-visible:border-[var(--ring)]"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
          The right idea (optional)
        </span>
        <textarea
          maxLength={MISTAKE_TEXT_MAX}
          value={correctIdea}
          onChange={(event) => {
            setCorrectIdea(event.target.value)
          }}
          placeholder="Sort first, or use a hash map and drop the ordering assumption."
          className="border-border bg-background/40 placeholder:text-muted-foreground h-16 w-full resize-none border p-2 text-xs outline-none focus-visible:border-[var(--ring)]"
        />
      </label>

      {mutation.isError && (
        <p role="alert" className="text-destructive text-xs">
          {mutation.error instanceof ApiError
            ? mutation.error.message
            : 'Could not save that. Try again.'}
        </p>
      )}

      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={mutation.isPending || whatWentWrong.trim() === ''}>
          {mutation.isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          type="button"
          onClick={() => {
            setOpen(false)
          }}
        >
          Not now
        </Button>
      </div>
    </form>
  )
}
