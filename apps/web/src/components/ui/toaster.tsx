'use client'

import { Toaster as Sonner } from 'sonner'

/**
 * Sonner, dressed like react-hot-toast: a floating rounded card at the top,
 * soft shadow, and a coloured icon that carries the kind of message. The card
 * itself stays in the app's tokens so it reads correctly in both themes.
 * Mounted once in the app layout.
 */
export function Toaster() {
  return (
    <Sonner
      position="top-center"
      gap={10}
      toastOptions={{
        unstyled: true,
        duration: 3500,
        classNames: {
          toast:
            'bg-card text-card-foreground border-border flex w-full items-center gap-3 rounded-xl border px-4 py-3 font-sans text-sm shadow-[0_8px_30px_rgb(0,0,0,0.18)]',
          title: 'font-medium',
          description: 'text-muted-foreground text-xs',
          icon: 'shrink-0 [&>svg]:size-5',
          success: '[&_[data-icon]]:text-easy',
          error: '[&_[data-icon]]:text-destructive',
          warning: '[&_[data-icon]]:text-medium',
          info: '[&_[data-icon]]:text-primary',
          actionButton:
            'bg-primary text-primary-foreground ml-auto shrink-0 rounded-md px-2.5 py-1 text-xs font-medium',
          cancelButton:
            'text-muted-foreground hover:text-foreground shrink-0 rounded-md px-2 py-1 text-xs',
        },
      }}
    />
  )
}
