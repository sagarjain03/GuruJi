import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/client/client'

// Every model, enum and input type the rest of the workspace needs.
export * from '../generated/client/client'

declare global {
  var __guruji_prisma__: PrismaClient | undefined
}

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
export function getPrisma(): PrismaClient {
  const client = globalThis.__guruji_prisma__ ?? createClient()
  if (process.env.NODE_ENV !== 'production') {
    globalThis.__guruji_prisma__ = client
  }
  return client
}

/**
 * The client, built on first use rather than on import.
 *
 * Eager construction would read DATABASE_URL while the importing module graph is
 * still being resolved — before Nest's ConfigModule has loaded `.env` — so the
 * API would crash on startup depending on nothing but import order.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getPrisma()
    const value = Reflect.get(client, property, receiver)
    return typeof value === 'function'
      ? (value as (...args: never[]) => unknown).bind(client)
      : value
  },
})
