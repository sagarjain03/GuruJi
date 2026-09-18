import path from 'node:path'
import { defineConfig, env } from 'prisma/config'

// One .env at the repo root. Prisma 7 no longer loads it implicitly, and the
// CLI always runs with this package as the working directory.
process.loadEnvFile(path.resolve(process.cwd(), '../../.env'))

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
})
