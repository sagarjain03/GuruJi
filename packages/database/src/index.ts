import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/client/client'

// Every model, enum and input type the rest of the workspace needs.
export * from '../generated/client/client'

declare global {
  var __guruji_prisma__: PrismaClient | undefined
}

// DATABASE_URL is read when this module loads, so whatever imports it must have
// the environment in place first — `node --env-file=.env` or an equivalent.
function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set — the database client cannot be created.')
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

/**
 * One client for the whole process.
 *
 * Without the global cache, every hot reload in development constructs a new
 * client and opens a new connection pool, and Postgres runs out of connections
 * long before anyone notices why.
 */
export const prisma: PrismaClient = globalThis.__guruji_prisma__ ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__guruji_prisma__ = prisma
}
