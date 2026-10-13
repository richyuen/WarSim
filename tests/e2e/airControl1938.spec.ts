import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { AIR_CONTESTED_COLOR, AIR_HELD_TINT, mix, SEA_LAND_FADE } from '../../src/shared/mapModes';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 5.7c: the air-superiority map mode. An air zone held is tinted with its holder's colour
// (AIR_HELD_TINT of it over the faded land or the sea), one contested striped, one no one flies
// over as the land and sea are faded. Germany at war with Poland (seed 1), its second day.

const { w: W, h: H } = SIZE_1938;
const id = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;
const rgb = (c: number): number[] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const dist = (a: number[], b: number[]): number => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
const hexOf = (p: number[]): number => (p[0]! << 16) | (p[1]! << 8) | p[2]!;
const FADE = 0xc7c7bf; // vec3(0.78, 0.78, 0.75)

async function pixelAt(page: Page, x: number, y: number, scale = 3): Promise<number[]> {
  return page.evaluate(
    ({ x, y, scale }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx: x, cy: y, scale });
      v.draw();
      const c = document.getElementById('map') as HTMLCanvasElement;
      const gl = c.getContext('webgl2')!;
      const p = new Uint8Array(4);
      gl.readPixels(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
      return [p[0]!, p[1]!, p[2]!];
    },
    { x, y, scale },
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
  await setMode(page, 'political');
  const before = await pixelAt(page, ...at(held!.cell));
  const ocean = cellOf(-130, -40, W, H);
  const sea = await pixelAt(page, ocean[0], ocean[1]);
  await setMode(page, 'airControl');
  await expect(page.getByTestId('map-legend')).toHaveAttribute('data-mode', 'airControl');
  const german = parseInt(NATIONS_1938.find((n) => n.tag === 'GER')!.color.replace('#', ''), 16);
  const want = mix(mix(hexOf(before), FADE, SEA_LAND_FADE), german, AIR_HELD_TINT);
  const got = await pixelAt(page, ...at(held!.cell));
  expect(dist(got, rgb(want)), `Germany's zone: ${got} for ${rgb(want)}`).toBeLessThan(30);
  // Where no one flies, the sea as it is.
  expect(dist(await pixelAt(page, ocean[0], ocean[1]), sea)).toBeLessThan(12);
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
