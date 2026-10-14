import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { AIR_CONTESTED_COLOR, AIR_HELD_TINT, mix } from '../../src/shared/mapModes';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 5.7c: the air-superiority map mode. An air zone held is hatched in its holder's colour,
// one contested striped, one no one flies over the ground of the mode: the land a light neutral,
// the sea faded. Germany at war with Poland (seed 1), its second day.
//
// PLAN 5.10 (the critic's R5-B1): the ground was the political colours faded, and a zone held
// tinted over it: Germany's air over Germany was grey on grey, and the legend named no nation.
// Now a held zone differs from one no one holds over the same nation's land, the legend lists the
// holders and the zone under the cursor is named.

const { w: W, h: H } = SIZE_1938;
const id = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;
const rgb = (c: number): number[] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const dist = (a: number[], b: number[]): number => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
const hexOf = (p: number[]): number => (p[0]! << 16) | (p[1]! << 8) | p[2]!;
const FADE = 0xc7c7bf; // vec3(0.78, 0.78, 0.75)
const GROUND = 0xccccc2; // vec3(0.80, 0.80, 0.76): the land of the mode

async function pixelAt(page: Page, x: number, y: number, scale = 3): Promise<number[]> {
  return (await rowAt(page, x, y, scale, 1))[0]!;
}
/** `n` pixels of a row from the middle of the view over (x, y), in device px. */
async function rowAt(page: Page, x: number, y: number, scale = 3, n = 24): Promise<number[][]> {
  return page.evaluate(
    ({ x, y, scale, n }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx: x, cy: y, scale });
      v.draw();
      const c = document.getElementById('map') as HTMLCanvasElement;
      const gl = c.getContext('webgl2')!;
      const p = new Uint8Array(4 * n);
      gl.readPixels(Math.floor(c.width / 2) - (n >> 1), Math.floor(c.height / 2), n, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
      return Array.from({ length: n }, (_, i) => [p[4 * i]!, p[4 * i + 1]!, p[4 * i + 2]!]);
    },
    { x, y, scale, n },
  );
}
const setMode = (page: Page, m: string): Promise<void> => page.evaluate((mode) => window.__warsim!.hud.setMapMode(mode as 'political'), m);

test('the air-superiority mode: the zones flown over by their holders\' colours or striped, the rest faded', async ({ page }, info) => {
  test.setTimeout(200_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__warsim!.view!.hasFineCoast, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/5.7') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.evaluate(({ a, d }) => window.__warsim!.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: id('GER'), d: id('POL') });
  // The next day's first hour sends who held the air through the first day's sorties.
  await page.evaluate(() => window.__warsim!.sim.step(49));
  await page.waitForFunction(() => window.__warsim!.view!.lastTick >= 49 && window.__warsim!.view!.airHolder.some((h) => h !== 0), null, { timeout: 30_000 });
  // A held zone and its middle-most cell on land, and a contested one if any: by the view's own zones.
  const zones = await page.evaluate(() => {
    const v = window.__warsim!.view!;
    const w = 2048;
    const cells = new Map<number, number[]>();
    v.airZoneOf.forEach((z, c) => {
      if (z !== 0 && v.airHolder[z] !== 0) (cells.get(z) ?? cells.set(z, []).get(z)!).push(c);
    });
    return [...cells].map(([z, cs]) => ({ z, holder: v.airHolder[z]!, cell: cs[cs.length >> 1]!, n: cs.length, w }));
  });
  expect(zones.length).toBeGreaterThan(0);
  const held = zones.find((z) => z.holder === id('GER'));
  expect(held, 'a zone Germany holds').toBeTruthy();
  const at = (cell: number): [number, number] => [(cell % W) + 0.5, Math.floor(cell / W) + 0.5];
  const ocean = cellOf(-130, -40, W, H);
  await setMode(page, 'political');
  const sea = await pixelAt(page, ocean[0], ocean[1]);
  await setMode(page, 'airControl');
  await expect(page.getByTestId('map-legend')).toHaveAttribute('data-mode', 'airControl');
  const german = parseInt(NATIONS_1938.find((n) => n.tag === 'GER')!.color.replace('#', ''), 16);
  // Germany's zone hatched: pixels of the full colour and of AIR_HELD_TINT of it over the ground.
  const row = await rowAt(page, ...at(held!.cell));
  const full = row.filter((p) => dist(p, rgb(german)) < 30).length;
  const tinted = row.filter((p) => dist(p, rgb(mix(GROUND, german, AIR_HELD_TINT))) < 30).length;
  expect([full, tinted].map((n) => n >= 4), `Germany's zone hatched: ${full} full, ${tinted} tinted of ${row.length}`).toEqual([true, true]);
  // A zone held is not one no one holds: there the ground, whatever the land's nation (Madrid,
  // Moscow, Ankara, Cairo: the first whose air zone no one holds; Germany's own all held here).
  const places = [cellOf(-3.7, 40.4, W, H), cellOf(37.6, 55.75, W, H), cellOf(32.85, 39.9, W, H), cellOf(31.2, 30.05, W, H)];
  const holders = await page.evaluate((ps) => ps.map(([x, y]) => window.__warsim!.view!.airZoneAt(x, y)?.holder ?? -1), places);
  const open = places[holders.findIndex((h) => h === 0)];
  expect(open, `a place no one holds the air of (holders ${holders.join(', ')})`).toBeDefined();
  const ground = await rowAt(page, open![0], open![1]);
  expect(Math.min(...ground.map((p) => dist(p, rgb(GROUND)))), 'land no one holds the air of: the ground').toBeLessThan(20);
  expect(dist(rgb(mix(GROUND, german, AIR_HELD_TINT)), rgb(GROUND)), 'held and not, apart').toBeGreaterThan(40);
  // Where no one flies, the sea faded.
  expect(dist(await pixelAt(page, ocean[0], ocean[1]), rgb(mix(hexOf(sea), FADE, 0.45))), 'the sea faded').toBeLessThan(12);
  // The legend: who holds the air, and the zone under the cursor named with its holder.
  await expect(page.getByTestId('air-holder').filter({ hasText: 'Germany' })).toHaveCount(1);
  await page.evaluate(([x, y]) => window.__warsim!.view!.hoverAir(x, y), at(held!.cell));
  await expect(page.getByTestId('air-hover')).toHaveText('This air zone: held by Germany');
  // A contested zone is striped: its pixels in two colours, one of them the stripe's.
  const contested = zones.find((z) => z.holder === 65535);
  if (contested) {
    const [x, y] = at(contested.cell);
    const px = await page.evaluate(
      ({ x, y }) => {
        const v = window.__warsim!.view!;
        v.controller.set({ cx: x, cy: y, scale: 3 });
        v.draw();
        const c = document.getElementById('map') as HTMLCanvasElement;
        const gl = c.getContext('webgl2')!;
        const p = new Uint8Array(4 * 24);
        gl.readPixels(Math.floor(c.width / 2) - 12, Math.floor(c.height / 2), 24, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
        return Array.from({ length: 24 }, (_, i) => [p[4 * i]!, p[4 * i + 1]!, p[4 * i + 2]!]);
      },
      { x, y },
    );
    const towards = px.map((p) => dist(p, rgb(AIR_CONTESTED_COLOR)));
    expect(Math.max(...towards) - Math.min(...towards), 'stripes').toBeGreaterThan(30);
  }
  process.stderr.write(`air holders on day 3: ${zones.map((z) => `${z.z}:${z.holder}`).join(' ')}\n`);
  await page.evaluate(() => window.__warsim!.view!.controller.set({ cx: 1110, cy: 280, scale: 2.2 }));
  await page.evaluate(() => window.__warsim!.view!.draw());
  await page.screenshot({ path: path.join(out, 'd-air-superiority-mode.png') });
});
