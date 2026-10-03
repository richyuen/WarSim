import { availableParallelism } from 'node:os';
import { defineConfig, devices } from '@playwright/test';

// E2E runs against the production build (`vite preview`) so tests see what ships.
const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  // Pages render with SwiftShader (CPU); more parallel workers starve each other into timeouts.
  // Half the cores, at most 4: on a 4-core machine 4 workers timed three UI specs out in every
  // gate run (2026-10-03, PLAN 1.42f), and 2 do not.
  workers: Math.max(1, Math.min(4, Math.floor(availableParallelism() / 2))),
  // Assertion polls wait up to 15 s (default 5 s): pages share the CPU with SwiftShader rendering
  // in the other workers (5–30× the solo time, see `perf` below). Assertions are unchanged; only
  // how long a poll may wait. Raised in PLAN 1.37a when an external process held 2.5 cores and
  // UI-command polls missed the 5 s window run after run while passing alone.
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /\.perf\.spec\.ts$/ },
    // Timing-budget specs run only after the parallel suite has finished, so SwiftShader pages in
    // other workers cannot starve them (contention measured at 5–30× the solo time).
    { name: 'perf', use: { ...devices['Desktop Chrome'] }, testMatch: /\.perf\.spec\.ts$/, dependencies: ['chromium'] },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
