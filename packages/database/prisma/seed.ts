import path from 'node:path'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/client/client'
import { seedAll } from './seed/run'

// Same reason as prisma.config.ts: one .env at the repo root, and Prisma 7 no
// longer loads it implicitly. `pnpm seed` runs with this package as cwd.
process.loadEnvFile(path.resolve(process.cwd(), '../../.env'))

/**
 * The seed entrypoint. The work itself lives in `seed/run.ts` so the idempotency
 * test can call it directly rather than shelling out to this script.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

seedAll(prisma)
  .then((counts) => {
    console.warn(
      `Seeded: ${counts.topics} topics, ${counts.patterns} patterns, ` +
        `${counts.roadmapNodes} roadmap nodes, ${counts.problems} problems, ` +
        `${counts.testCases} test cases, ${counts.hints} hints.`,
    )
  })
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    void prisma.$disconnect()
  })
