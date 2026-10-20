import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 7.36b (critic run 10, R10-B3, `c10h_8217_air_hover.png`): on day 10 of Germany's war on
// Poland (seed 8217) the air map hatched one German zone from London to Kiev, the hover "held by
// Germany" at each. Since ADR-560 the land's air zones are 300,000 km² (1.5 M before): the hover
// reads what each place's air holds, and two or more of the four read another than Germany.

const { w: W, h: H } = SIZE_1938;
const id = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;

test('day 10 of Germany–Poland: the air map reads London, Paris, Warsaw and Kiev apart', async ({ page }, info) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?scenario=1938&paused=1&seed=8217');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/7.36') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.evaluate(({ a, d }) => window.__warsim!.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: id('GER'), d: id('POL') });
  await page.evaluate(() => window.__warsim!.sim.step(24 * 10 + 1));
  await page.waitForFunction(() => window.__warsim!.view!.lastTick >= 24 * 10 + 1 && window.__warsim!.view!.airHolder.some((h) => h !== 0), null, { timeout: 60_000 });
  await page.evaluate(() => window.__warsim!.hud.setMapMode('airControl'));
  await expect(page.getByTestId('map-legend')).toHaveAttribute('data-mode', 'airControl');
  const cities: [string, number, number][] = [['London', -0.13, 51.51], ['Paris', 2.35, 48.86], ['Warsaw', 21.01, 52.23], ['Kiev', 30.52, 50.45]];
  const read: string[] = [];
  for (const [, lon, lat] of cities) {
    const [x, y] = cellOf(lon, lat, W, H);
    await page.evaluate(([x, y]) => window.__warsim!.view!.hoverAir(x, y), [x + 0.5, y + 0.5] as const);
    const hover = page.getByTestId('air-hover');
    await expect(hover).toHaveText(/^This air zone: /);
    read.push((await hover.textContent()) ?? '');
  }
  process.stderr.write(`day 10: ${cities.map(([n], i) => `${n} "${read[i]}"`).join('; ')}\n`);
  expect(read.filter((t) => t !== 'This air zone: held by Germany').length, read.join(' | ')).toBeGreaterThanOrEqual(2);
  // Europe as the critic saw it, for the eye.
  const [cx, cy] = cellOf(14, 52, W, H);
  await page.evaluate(([cx, cy]) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx, cy, scale: 2.2 });
    v.draw();
  }, [cx, cy] as const);
  await page.screenshot({ path: path.join(out, 'airMap-8217-day10.png') });
});
