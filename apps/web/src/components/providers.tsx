'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { ThemeProvider } from '@/components/theme-provider'

/**
 * `nonce` is threaded through to next-themes.
 *
 * It writes an inline script into the document to set the theme class before
 * first paint, which is how the page avoids flashing the wrong palette. That
 * script is not Next's, so Next does not stamp the request nonce onto it, and
 * the policy in `src/proxy.ts` refuses it — leaving the flash the script exists
 * to prevent. The layouts read the nonce from the request and hand it down.
 */
export function Providers({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  // Created in state, not at module scope: a module-level client would be shared
  // between users on the server and leak one person's cache into another's page.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider {...(nonce === undefined ? {} : { nonce })}>{children}</ThemeProvider>
    </QueryClientProvider>
  )
}
