'use client'

import { useState } from 'react'
import type { Mastery, MasteryComponent } from '@guruji/types'
import { cn } from '@/lib/utils'

/**
 * What each component is, in words the user can act on.
 *
 * Not the variable names. "patternCoverage 0.2" is a fact about our schema;
 * "you have solved one technique out of five here" is a thing to go and change.
 */
const COMPONENT_LABEL: Record<MasteryComponent['name'], string> = {
  accuracy: 'Right first time',
  retention: 'Still remembered later',
  difficultyPerformance: 'Difficulty cleared',
  patternCoverage: 'Techniques covered',
  speed: 'Solved in good time',
  hintDependency: 'Leaned on hints',
}

const COMPONENT_HELP: Record<MasteryComponent['name'], string> = {
  accuracy: 'Solved on the first graded attempt, out of everything attempted.',
  retention: 'Revisions passed. Revision starts in a later phase, so there is nothing here yet.',
  difficultyPerformance: 'Weighted towards harder problems — ten easy solves are not four hard ones.',
  patternCoverage: 'Distinct techniques solved, out of what this topic offers.',
  speed: 'Time taken against the time the problem was expected to take.',
  hintDependency: 'This one subtracts. Being walked to an answer is evidence of a gap.',
}

/**
 * A score, and the reason for it one click away.
 *
 * "Why is my Graphs score 40?" has to have an answer. A score nobody can take
 * apart is indistinguishable from one that was made up, and it gets treated
 * as one.
 */
export function MasteryBar({
  name,
  mastery,
  meta,
}: {
  name: string
  mastery: Mastery
  meta?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-border border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value)
        }}
        className="hover:bg-accent/40 flex w-full items-center gap-3 p-2.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-medium">{name}</span>
            <span className="text-muted-foreground shrink-0 font-mono text-[10px] tracking-[0.14em] uppercase">
              {/* The band, not the number alone — a decimal place would imply a
                  precision the model does not have. */}
              {mastery.lowData ? 'Low data' : mastery.band}
            </span>
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            <div
              role="progressbar"
              aria-valuenow={mastery.score}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${name} mastery`}
              className="bg-muted h-1.5 flex-1"
            >
              <div
                className={cn('h-full', mastery.lowData ? 'bg-muted-foreground/50' : 'bg-primary')}
                style={{ width: `${String(mastery.score)}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right font-mono text-xs">{mastery.score}</span>
          </div>

          {meta !== undefined && (
            <p className="text-muted-foreground mt-1 font-mono text-[10px]">{meta}</p>
          )}
        </div>
      </button>

      {open && <Breakdown mastery={mastery} />}
    </div>
  )
}

function Breakdown({ mastery }: { mastery: Mastery }) {
  return (
    <div className="border-border bg-muted/30 border-t p-2.5">
      {mastery.lowData && (
        <p className="text-muted-foreground mb-2 text-xs">
          {/* Confidence damping, said plainly. One lucky solve is not mastery,
              and a suspiciously confident bar would claim it was. */}
          Not enough attempts yet for this score to mean much — it is held down on purpose until
          there are about five.
        </p>
      )}

      <ul className="flex flex-col gap-1.5">
        {mastery.components.map((component) => (
          <li key={component.name}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs">{COMPONENT_LABEL[component.name]}</span>
              <span
                className={cn(
                  'shrink-0 font-mono text-[10px]',
                  component.value === null && 'text-muted-foreground',
                  component.name === 'hintDependency' &&
                    component.value !== null &&
                    component.value > 0 &&
                    'text-hard',
                )}
              >
                {/* Null is not zero. "Nobody has asked you yet" and "you failed
                    this" must not look the same. */}
                {component.value === null
                  ? 'not measured'
                  : `${String(Math.round(component.value * 100))}%`}
              </span>
            </div>
            <p className="text-muted-foreground text-[11px] leading-snug">
              {COMPONENT_HELP[component.name]}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
