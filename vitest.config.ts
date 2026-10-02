import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // Constructing ESLint with typescript-eslint takes a few seconds on a cold cache, and since
    // the strategic, operational and economic AIs (PLAN 1.24–1.26) multi-day 1938 simulations
    // can approach 30 s under the parallel worker pool; 90 s keeps them from flaking.
    testTimeout: 90_000,
  },
});
