import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['prisma/**/*.spec.ts'],
    // Seeding the whole content bank twice is not a fast test.
    testTimeout: 120_000,
    setupFiles: ['./test/load-env.ts'],
  },
})
