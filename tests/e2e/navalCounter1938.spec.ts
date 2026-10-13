import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { lookAt, open1938 } from './mapView';

// PLAN 4.10a (the critic's R4-B4): at T0 a fleet's counter was an army's, and fleets and
// armies of a nation in one cell of the grid were one counter. A fleet is now a counter of its
// own, drawn as a navy's: a sea-blue box and frame with a hull under its strength.

const { w: W, h: H } = SIZE_1938;
const ENG = NATIONS_1938.findIndex((n) => n.tag === 'ENG') + 1;

/** The counters drawn in full: their nation, whether a navy's, their box and the mean colour of its inside (the flag chip left out). */
function counters(page: Page): Promise<{ nation: number; naval: boolean; wx: number; wy: number; rgb: [number, number, number] }[]> {
  return page.evaluate(() => {
    const v = window.__warsim!.view!;
    v.draw();
    const c = document.querySelector('canvas.map-nations') as HTMLCanvasElement;
    const k = c.width / c.clientWidth;
    const g = c.getContext('2d')!;
    return v.counters.drawn
      .filter((d) => d.alpha > 0.99)
      .map((d) => {
        const px = g.getImageData(Math.round((d.x + 16) * k), Math.round((d.y + 2) * k), Math.max(1, Math.round((d.w - 18) * k)), Math.max(1, Math.round((d.h - 4) * k))).data;
        const sum = [0, 0, 0];
        for (let i = 0; i < px.length; i += 4) for (let j = 0; j < 3; j++) sum[j]! += px[i + j]!;
        const n = px.length / 4;
        return { nation: d.nation, naval: d.naval, wx: d.wx, wy: d.wy, rgb: sum.map((s) => s / n) as [number, number, number] };
      });
  });
}

test('at T0 a fleet\'s counter is a navy\'s, apart from the armies, and its pixels are not an army counter\'s', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await open1938(page, 1938);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/4.10') : info.outputPath();
  mkdirSync(out, { recursive: true });
  // The British Isles at T0 (6 km/px): Scapa Flow's fleets, the armies of England.
  const [sx, sy] = cellOf(-3.1, 58.9, W, H);
  await lookAt(page, sx, sy + 12, 6000);
  const all = await counters(page);
  const fleets = all.filter((c) => c.naval && c.nation === ENG);
  const armies = all.filter((c) => !c.naval && c.nation === ENG);
  expect(fleets.length, 'a British navy counter in view').toBeGreaterThan(0);
  expect(armies.length, 'a British army counter in view').toBeGreaterThan(0);
  const scapa = fleets.reduce((a, b) => (Math.hypot(a.wx - sx, a.wy - sy) < Math.hypot(b.wx - sx, b.wy - sy) ? a : b));
  expect(Math.hypot(scapa.wx - sx, scapa.wy - sy), 'one by Scapa Flow').toBeLessThan(6);
  // A navy's box is sea-blue, an army's dark grey: blue over red by far in the one, not in the other.
  const blue = (c: { rgb: [number, number, number] }): number => c.rgb[2] - c.rgb[0];
  for (const f of fleets) expect(blue(f), 'a navy counter is blue').toBeGreaterThan(25);
  for (const a of armies) expect(blue(a), 'an army counter is not').toBeLessThan(15);
  await page.screenshot({ path: path.join(out, 'naval-counters-t0.png') });
});
