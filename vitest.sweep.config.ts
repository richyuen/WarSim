import { defineConfig } from 'vitest/config';

// Long headless sweeps (PLAN 1.24 AT: 10-year runs on 3 seeds). They run as their own stage of
// `npm run check`, after the unit tests, so their CPU load cannot disturb timing-sensitive tests.
export default defineConfig({
  test: {
    include: ['tests/sweep/**/*.test.ts'],
    environment: 'node',
    testTimeout: 900_000,
  },
});
