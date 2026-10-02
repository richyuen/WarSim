import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // Constructing ESLint with typescript-eslint takes a few seconds on a cold cache.
    testTimeout: 30_000,
  },
});
