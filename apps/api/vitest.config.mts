import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    // The e2e suites talk to the real Postgres and Redis, and Argon2 is slow by design.
    testTimeout: 30_000,
    setupFiles: ['./test/load-env.ts'],
  },
  plugins: [
    // esbuild cannot emit decorator metadata, which is how Nest resolves
    // constructor injection. SWC can.
    swc.vite({ module: { type: 'es6' } }),
  ],
})
