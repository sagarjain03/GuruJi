'use client'

import { Toaster as Sonner } from 'sonner'

/**
 * Sonner, unstyled and dressed in the app's own tokens: square, card ground,
 * hairline border, no shadow, body font. Mounted once in the app layout.
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'bg-card text-card-foreground border-border flex w-full items-center gap-2 rounded-none border px-4 py-3 font-sans text-sm shadow-none',
          description: 'text-muted-foreground text-xs',
        },
      }}
    />
  )
}
