const TAGS = ['Guided roadmap', 'Spaced revision', 'Mistake journal']

const STATS = [
  { value: '450+', label: 'curated problems' },
  { value: '9', label: 'topic tracks' },
  { value: '0', label: 'guesswork' },
]

/**
 * The showcase half of the auth screen. Decorative and desktop-only — on a
 * phone it would push the form below the fold, which is the one thing the
 * screen exists to show.
 */
export function AuthPanel() {
  return (
    <aside className="relative hidden overflow-hidden lg:block" aria-hidden="true">
      {/* A mesh of soft radial blooms rather than a single linear wash, so the
          panel reads as lit from several points instead of tilted. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: 'oklch(0.18 0.03 285)',
          backgroundImage: [
            'radial-gradient(60% 55% at 78% 12%, oklch(0.42 0.13 300 / 0.85), transparent 70%)',
            'radial-gradient(55% 50% at 20% 35%, oklch(0.38 0.11 265 / 0.8), transparent 72%)',
            'radial-gradient(70% 60% at 30% 95%, oklch(0.74 0.09 120 / 0.35), transparent 68%)',
            'radial-gradient(45% 40% at 90% 78%, oklch(0.55 0.08 40 / 0.35), transparent 70%)',
          ].join(','),
        }}
      />

      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage: 'radial-gradient(70% 70% at 50% 40%, black, transparent)',
          WebkitMaskImage: 'radial-gradient(70% 70% at 50% 40%, black, transparent)',
        }}
      />

      <div className="relative flex h-full flex-col justify-end gap-3 p-10">
        <div className="flex flex-wrap gap-2">
          {TAGS.map((tag) => (
            <span
              key={tag}
              className="rounded-none border border-white/15 bg-black/35 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="rounded-none border border-white/10 bg-black/35 p-6 backdrop-blur-md">
          <p className="font-display text-xl leading-snug font-semibold text-white">
            Practice is not the hard part. Knowing what to practise next is.
          </p>
          <p className="mt-2 text-sm text-white/70">
            GuruJi watches where you slip, then puts that back in front of you at the moment you
            were about to forget it.
          </p>

          <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-white/10 pt-4">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd className="font-mono text-lg font-semibold text-white">{stat.value}</dd>
                <p className="mt-0.5 text-xs text-white/55">{stat.label}</p>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </aside>
  )
}
