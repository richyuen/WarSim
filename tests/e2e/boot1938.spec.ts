import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { earthAsset } from '../helpers/earth';

// PLAN 1.9a: the app boots the 1938 world in the sim worker (`?scenario=1938`). The worker's
// state hash equals a Node build from the same assets, and the map view renders it.

test('the 1938 scenario boots in the worker == Node and renders', async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => window.__warsim?.hud.worker.value !== null, null, { timeout: 60_000 });

  const node = new Sim({
    scenario: '1938',
    seed: 1938,
    assets: {
      admin1Geometry: new Uint8Array(earthAsset('admin1-geometry')),
      admin1Meta: new Uint8Array(earthAsset('admin1-meta')),
      terrain: new Uint8Array(earthAsset('terrain', SIZE_1938.w)),
    },
  });
  const worker = await page.evaluate(() => window.__warsim!.sim.hash());
  expect(worker.hash).toBe(node.hash());
  await expect(page.getByTestId('date-label')).toHaveText(/1 January 1938/);

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.9a') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.waitForTimeout(500); // let the first frames draw
  await page.screenshot({ path: path.join(out, 'app-1938-boot.png') });
  expect(errors).toEqual([]);
});
