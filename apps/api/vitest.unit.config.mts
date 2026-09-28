import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

/**
 * Pure unit tests only — the spec files under src, no database, no Redis, no
 * setup file. The default config boots against the real services for the e2e
 * suites; the engines' pure logic should not have to wait on Docker to run.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
})
