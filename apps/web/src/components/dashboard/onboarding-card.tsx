'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { ExperienceLevel, Language } from '@guruji/types'
import { Button } from '@/components/ui/button'
import { ApiError, profileApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { EDITOR_LANGUAGES, LANGUAGE_LABEL } from '@/stores/editor-store'
import { useSessionStore } from '@/stores/session-store'

const LEVELS: { value: ExperienceLevel; label: string; hint: string }[] = [
  { value: 'BEGINNER', label: 'Just starting', hint: 'Arrays and loops still feel new' },
  { value: 'INTERMEDIATE', label: 'Comfortable', hint: 'Solved a few dozen, want structure' },
  { value: 'ADVANCED', label: 'Experienced', hint: 'Preparing for hard interviews' },
]

const GOALS = [15, 30, 45, 60, 90]

/**
 * Three questions, on the dashboard rather than a gate in front of it.
 *
 * A blocking onboarding screen is a wall between signing up and seeing whether
 * the product is any good. This sits at the top of the page until answered and
 * the product works around it until then — with roadmap-order suggestions that
 * say honestly that there is nothing to go on yet.
 *
 * Every answer changes something real. The timezone is not asked at all: the
 * browser knows it, and people do not know their IANA name.
 */
export function OnboardingCard() {
  const queryClient = useQueryClient()
  const profile = useSessionStore((state) => state.profile)
  const user = useSessionStore((state) => state.user)
  const setSession = useSessionStore((state) => state.setSession)

  const [level, setLevel] = useState<ExperienceLevel>(profile?.experienceLevel ?? 'BEGINNER')
  const [language, setLanguage] = useState<Language>(profile?.preferredLanguage ?? 'CPP')
  const [goal, setGoal] = useState(profile?.dailyGoalMinutes ?? 30)

  const save = useMutation({
    mutationFn: () =>
      profileApi.onboarding({
        experienceLevel: level,
        preferredLanguage: language,
        dailyGoalMinutes: goal,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    onSuccess: (updated) => {
      if (user !== null) {
        setSession(user, updated)
      }
      // Tolerance moved, so every suggestion computed before it is aimed wrong.
      void queryClient.invalidateQueries({ queryKey: ['recommendations'] })
    },
  })

  if (profile === null || profile.onboardingCompletedAt !== null) {
    return null
  }

  return (
    <section className="border-primary/40 border p-4">
      <h2 className="font-display text-base font-semibold">Three quick questions</h2>
      <p className="text-muted-foreground mt-1 text-xs">
        So the first problems are aimed at you, not at everyone.
      </p>

      <fieldset className="mt-4">
        <legend className="text-muted-foreground mb-2 font-mono text-[10px] tracking-[0.14em] uppercase">
          Where are you
        </legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {LEVELS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={level === option.value}
              onClick={() => {
                setLevel(option.value)
              }}
              className={cn(
                'border-border border p-2.5 text-left',
                level === option.value && 'border-primary bg-primary/10',
              )}
            >
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="text-muted-foreground block text-[11px]">{option.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-muted-foreground mb-2 font-mono text-[10px] tracking-[0.14em] uppercase">
          Language
        </legend>
        <div className="flex flex-wrap gap-1">
          {EDITOR_LANGUAGES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={language === option}
              onClick={() => {
                setLanguage(option)
              }}
              className={cn(
                'border-border text-muted-foreground border px-2.5 py-1 text-xs',
                language === option && 'bg-primary text-primary-foreground border-primary',
              )}
            >
              {LANGUAGE_LABEL[option]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-muted-foreground mb-2 font-mono text-[10px] tracking-[0.14em] uppercase">
          Minutes a day
        </legend>
        <div className="flex flex-wrap gap-1">
          {GOALS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={goal === option}
              onClick={() => {
                setGoal(option)
              }}
              className={cn(
                'border-border text-muted-foreground border px-2.5 py-1 font-mono text-xs',
                goal === option && 'bg-primary text-primary-foreground border-primary',
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </fieldset>

      {save.isError && (
        <p role="alert" className="text-destructive mt-3 text-xs">
          {save.error instanceof ApiError ? save.error.message : 'Could not save that.'}
        </p>
      )}

      <Button
        className="mt-4"
        disabled={save.isPending}
        onClick={() => {
          save.mutate()
        }}
      >
        {save.isPending ? 'Saving…' : 'Start training'}
      </Button>
    </section>
  )
}
