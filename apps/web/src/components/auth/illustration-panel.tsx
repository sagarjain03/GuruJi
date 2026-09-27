import { Logo, patterns } from '@/components/icons'

/**
 * The showcase half of the auth screen, built only from existing brand pieces:
 * the dot field, the diamond mark, one line of product copy and the Core
 * Patterns strip. Static on purpose. Desktop-only — on a phone it would push
 * the form below the fold.
 */
export function IllustrationPanel() {
  return (
    <aside
      aria-hidden="true"
      className="border-border bg-background relative hidden h-full overflow-hidden border-l md:block"
    >
      <div className="auth-dots absolute inset-0" />

      <div className="relative flex h-full flex-col justify-between p-10">
        <Logo className="text-foreground size-10" />

        <div>
          <p className="font-display max-w-md text-2xl leading-snug font-semibold">
            Practice is not the hard part. Knowing what to practise next is.
          </p>
          <p className="text-muted-foreground mt-3 max-w-md text-sm leading-relaxed">
            GuruJi watches where you slip, then puts that back in front of you at the moment you
            were about to forget it.
          </p>

          <ul className="border-border text-muted-foreground mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t pt-5 text-sm">
            {patterns.map((pattern) => (
              <li key={pattern.name} className="flex items-center gap-2">
                <span className="size-4 [&>svg]:size-full">{pattern.mark}</span>
                {pattern.name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  )
}
