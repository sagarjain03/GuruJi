import path from 'node:path'

// The suites boot the real application, which reads the same .env the dev server does.
process.loadEnvFile(path.resolve(__dirname, '../../../.env'))
process.env.NODE_ENV = 'test'
// Request logs would bury the assertion output.
process.env.LOG_LEVEL = 'fatal'
