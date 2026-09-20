import path from 'node:path'

// `languages.ts` and `judge.ts` read their image names and compile budget at
// module load, so the environment has to exist before the first import.
process.loadEnvFile(path.resolve(__dirname, '../../../.env'))
process.env.NODE_ENV = 'test'
process.env.LOG_LEVEL = 'fatal'
