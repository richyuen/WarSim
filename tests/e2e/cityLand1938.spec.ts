import { expect, test } from '@playwright/test';
import type {} from '../../src/app/testApi';

// PLAN 7.4g1 (ADR-460): at the 1938 start 140 cities stood on a water pixel of the fine mask, and
// at T2 and T3 their dots were in the drawn sea (Gibraltar, Kalemie, Geneva, Amoy, Buffalo,
// Cochin). The page draws each at the nearest point of sure land: none of the layer's cities is on
// a water pixel of the mask the page has.

test('no city is drawn on a water pixel of the fine mask', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  // The coast is the page's once the mask came: a city on sure land is on a land pixel.
  await page.waitForFunction(() => window.__warsim!.view!.maskBit(0, 0) !== undefined && (window.__warsim!.view! as unknown as { coast: unknown }).coast !== null, null, { timeout: 60_000 });
  const r = await page.evaluate(() => {
    const v = window.__warsim!.view!;
    const layer = v.cityLabels as unknown as { cities: { name: string; x: number; y: number }[] };
    const k = (v as unknown as { coast: { k: number } }).coast.k;
    const wet = layer.cities.filter((c) => !v.maskBit(Math.floor(c.x * k), Math.floor(c.y * k)));
    return { n: layer.cities.length, wet: wet.map((c) => c.name).slice(0, 10), count: wet.length };
  });
  console.log(`cities ${r.n}, on a water pixel ${r.count}: ${r.wet.join(', ')}`);
  expect(r.n).toBeGreaterThan(5000);
  expect(r.count, 'cities drawn on a water pixel').toBe(0);
});
