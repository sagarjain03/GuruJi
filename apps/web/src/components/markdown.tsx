'use client'

import ReactMarkdown from 'react-markdown'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { cn } from '@/lib/utils'

/**
 * Allow-list, not a block-list.
 *
 * Problem statements are authored content, and from Phase 8 some of them are
 * model-generated. Either way the renderer must be safe against a statement that
 * contains markup, so the schema names what may appear rather than trying to
 * enumerate what may not — a block-list is only ever as good as its last update.
 *
 * `rehype-sanitize`'s default schema is already an allow-list; this narrows it
 * further to the tags a statement actually needs, and drops anchors entirely —
 * nothing in the problem bank links out.
 */
const SCHEMA = {
  ...defaultSchema,
  tagNames: [
    'p',
    'br',
    'strong',
    'em',
    'code',
    'pre',
    'ul',
    'ol',
    'li',
    'blockquote',
    'h2',
    'h3',
    'h4',
    'hr',
  ],
  attributes: {
    // No `className` on arbitrary nodes either: the styling is ours, from the
    // stylesheet below, and injected classes are a way to move things on screen.
    code: [],
    pre: [],
  },
}

/** Renders a problem statement. The prose styling lives here, once. */
export function Markdown({ content, className }: { content: string; className?: string }) {
  return (
    <div
      className={cn(
        'text-foreground/90 space-y-3 text-sm leading-relaxed',
        '[&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]',
        '[&_pre]:bg-muted [&_pre]:overflow-x-auto [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0',
        '[&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5',
        '[&_strong]:text-foreground [&_strong]:font-semibold',
        '[&_h2]:font-display [&_h3]:font-display [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold',
        className,
      )}
    >
      <ReactMarkdown rehypePlugins={[[rehypeSanitize, SCHEMA]]}>{content}</ReactMarkdown>
    </div>
  )
}
