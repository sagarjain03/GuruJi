import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata = { title: 'Dashboard' }

/**
 * Phase 1 dashboard.
 *
 * There is no database and no auth yet, so there is nothing true to show. Rather
 * than render invented mastery bars and a fake streak — which the product spec
 * rules out, and which would make the design look finished while the engines
 * behind it do not exist — this renders the real empty state those panels will
 * use once Phase 5 fills them.
 */
export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Today&apos;s Training</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          What you should practise next, and why.
        </p>
      </header>

      <Card className="from-primary/12 mb-6 bg-gradient-to-br to-transparent">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <h2 className="font-display text-lg font-semibold">Train now</h2>
            <p className="text-muted-foreground mt-1 max-w-md text-sm">
              Picks your single most useful next activity — revision, a weak topic, a new pattern or
              a timed challenge.
            </p>
          </div>
          <Button size="lg" disabled>
            Train now
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Revision due</CardTitle>
            <CardDescription>Problems ready to be recalled.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Nothing scheduled — solve a problem and it enters the revision queue.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mastery</CardTitle>
            <CardDescription>Per topic, 0&ndash;100.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-2 w-20" />
                <Skeleton className="h-2 flex-1" />
              </div>
            ))}
            <p className="text-muted-foreground pt-1 text-xs">
              Computed from real submissions. Nothing to show yet.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Design system</CardTitle>
            <CardDescription>Phase 1a check.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="easy">Easy</Badge>
              <Badge variant="medium">Medium</Badge>
              <Badge variant="hard">Hard</Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm">Primary</Button>
              <Button size="sm" variant="secondary">
                Secondary
              </Button>
              <Button size="sm" variant="outline">
                Outline
              </Button>
              <Button size="sm" variant="ghost">
                Ghost
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
