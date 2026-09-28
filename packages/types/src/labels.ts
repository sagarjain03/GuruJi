import type { MistakeCategory } from './mistake'
import type { RecommendationKind } from './recommendation'
import type { RevisionOutcome, RevisionState } from './revision'

/**
 * Display labels and plain constants — the only runtime values the web app
 * needs from this package outside its auth forms.
 *
 * Kept in a file that imports nothing at runtime (the imports above are
 * type-only and vanish on build) and exported on its own path,
 * `@guruji/types/labels`. The package builds to CommonJS, which a bundler
 * cannot tree-shake: importing one label from the main entry pulled every
 * schema, and all of zod, into the dashboard, analytics and contest pages —
 * about 500 KB. The schema files re-export these, so server code is unchanged.
 */

export const MISTAKE_CATEGORY_LABEL: Record<MistakeCategory, string> = {
  LOGIC: 'Logic',
  SYNTAX: 'Syntax',
  EDGE_CASE: 'Edge case',
  COMPLEXITY: 'Too slow',
  IMPLEMENTATION: 'Implementation',
  MISREAD_PROBLEM: 'Misread the problem',
  WRONG_PATTERN: 'Wrong approach',
  OFF_BY_ONE: 'Off by one',
  OVERFLOW: 'Overflow',
}

export const MISTAKE_TEXT_MAX = 4000

export const RECOMMENDATION_KIND_LABEL: Record<RecommendationKind, string> = {
  REVISION: 'Revise',
  WEAK_TOPIC: 'Shore up a weak area',
  NEW_PATTERN: 'Learn a new technique',
  NEW_PROBLEM: 'Keep moving',
  MOCK_CHALLENGE: 'Test yourself under time',
}

export const REVISION_OUTCOME_LABEL: Record<RevisionOutcome, string> = {
  SOLVED_EASILY: 'Came back easily',
  SOLVED_WITH_EFFORT: 'Got there with effort',
  STRUGGLED: 'Struggled through it',
  FAILED: 'Could not do it',
}

export const REVISION_STATE_LABEL: Record<RevisionState, string> = {
  LEARNING: 'Learning',
  REVIEWING: 'Reviewing',
  MASTERED: 'Mastered',
  LAPSED: 'Lapsed',
}
