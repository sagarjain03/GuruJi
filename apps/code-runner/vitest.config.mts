import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    // The adversarial suite starts real containers: a C++ compile-time memory
    // bomb alone is allowed 20 seconds, and the concurrency row runs 100 jobs.
    testTimeout: 900_000,
    hookTimeout: 120_000,
    // Containers are the shared resource. Two files racing for 256 MB each on a
    // 4 GB dev host is how this suite becomes flaky for reasons that are not bugs.
    fileParallelism: false,
    setupFiles: ['./test/load-env.ts'],
  },
})
