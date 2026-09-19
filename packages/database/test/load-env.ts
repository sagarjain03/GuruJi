import path from 'node:path'

// The suite talks to the real Postgres, same as the seed script does.
process.loadEnvFile(path.resolve(__dirname, '../../../.env'))
