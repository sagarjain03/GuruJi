import Image from 'next/image'
import { Logo, patterns } from '@/components/icons'

/**
 * The showcase half of the auth screen: a full-bleed illustration with the
 * diamond mark, one line of product copy and the Core Patterns strip laid over
 * it. A gradient in the page's own background colour rises from the bottom so
 * the copy stays readable in either theme. Static on purpose. Desktop-only —
 * on a phone it would push the form below the fold, and because the panel is
 * `display: none` there, the lazily loaded image is never fetched.
 */
export function IllustrationPanel() {
  return (
    <aside
      aria-hidden="true"
      className="border-border bg-background relative hidden h-full overflow-hidden border-l md:block"
    >
      <Image src="/image.png" alt="" fill sizes="50vw" className="object-cover object-center" />
      <div className="from-background via-background/70 absolute inset-0 bg-gradient-to-t via-35% to-transparent to-65%" />

      <div className="relative flex h-full flex-col justify-between p-10">
        <Logo className="size-10 text-white drop-shadow" />

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
