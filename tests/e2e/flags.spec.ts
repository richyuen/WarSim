import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/bench/benchApi';

// PLAN 1.6: the flag atlas builds in the browser from data and the grid is reviewed.
// The screenshot goes to docs/evidence/1.6/ when EVIDENCE=1, else to the test output folder.

test('flag atlas builds in the browser and the 1938 flag grid renders', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto('/bench.html?b=F');
  await page.waitForFunction(() => window.__bench !== undefined);
  const r = (await page.evaluate(() => window.__bench!.run())) as { flags: number; atlas: [number, number]; buildMs: number };
  console.log(`flag atlas: ${r.flags} flags, ${r.atlas.join('×')} px, built in ${r.buildMs.toFixed(0)} ms`);
  expect(r.flags).toBe(103);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.6') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const shot = await page.screenshot({ path: path.join(out, 'flag-grid-1938.png') });
  expect(shot.byteLength).toBeGreaterThan(40_000); // flat colours compress well; a blank page is ~5 KB
  expect(errors).toEqual([]);
});
