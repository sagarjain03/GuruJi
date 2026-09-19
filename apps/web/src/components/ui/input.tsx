import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'border-input bg-card/40 placeholder:text-muted-foreground flex h-9 w-full min-w-0 rounded-none border px-3 py-1 text-sm transition-colors outline-none',
        'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        // aria-invalid is set by the form layer on a failed field — the ring is
        // not the only signal, the message below it is, but it helps.
        'aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
