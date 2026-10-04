import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { settle } from './settle';

// PLAN 1.29 AT: curved, area-sized nation names for ≥ 20 nations; no overlaps among the major
// ones. Labels come from the worker's derived curves and are drawn on the 2D overlay.

const { w: W, h: H } = SIZE_1938;

interface Laid {
  id: number;
  text: string;
  fontPx: number;
  area: number;
  curved: boolean;
  glyphs: { x: number; y: number }[];
}

async function view(page: Page, lon: number, lat: number, scale: number): Promise<Laid[]> {
  const [cx, cy] = cellOf(lon, lat, W, H);
  return page.evaluate(
    ({ cx, cy, scale }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx, cy, scale });
      v.draw();
      return v.nationLabels.map((l) => ({ id: l.id, text: l.text, fontPx: l.fontPx, area: l.area, curved: l.curved, glyphs: l.glyphs.map((g) => ({ x: g.x, y: g.y })) }));
    },
    { cx, cy, scale },
  );
}

test('curved, area-sized nation labels without overlaps', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.view!.lastTick === 0, null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__warsim!.sim.labels !== null, null, { timeout: 60_000 });

  const europe = await view(page, 15, 48, 3.2);
  const world = await view(page, 30, 25, 1.2);
  const names = new Set([...europe, ...world].map((l) => l.text));
  expect(names.size, [...names].join(', ')).toBeGreaterThanOrEqual(20);
  expect(world.filter((l) => l.curved).length).toBeGreaterThanOrEqual(3);
  // Area-sized: a big nation's name is larger than a small one's in the same view.
  const sorted = [...world].sort((a, b) => b.area - a.area);
  expect(sorted[0]!.fontPx).toBeGreaterThan(sorted.at(-1)!.fontPx);
  // No overlaps among the major nations (10 largest placed), in either view.
  for (const set of [europe, world]) {
    const major = [...set].sort((a, b) => b.area - a.area).slice(0, 10);
    for (let i = 0; i < major.length; i++) {
      for (let j = i + 1; j < major.length; j++) {
        const a = major[i]!;
        const b = major[j]!;
        const r = (a.fontPx + b.fontPx) / 2 / 2;
        for (const g of a.glyphs) for (const q of b.glyphs) expect(Math.hypot(g.x - q.x, g.y - q.y), `${a.text} × ${b.text}`).toBeGreaterThan(r * 0.99);
      }
    }
  }
  // The overlay really shows text: dark pixels on the label canvas.
  const ink = await page.evaluate(() => {
    const o = document.querySelector('canvas.map-nations') as HTMLCanvasElement;
    const d = o.getContext('2d')!.getImageData(0, 0, o.width, o.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]! > 200) n++;
    return n;
  });
  expect(ink).toBeGreaterThan(2000);

  // City names in the main app (review after 1.29): around Berlin at T1 zoom, named cities.
  await page.waitForFunction(() => window.__warsim!.view!.hasFineCoast, null, { timeout: 60_000 });
  const [bx, by] = cellOf(13.4, 52.5, W, H);
  // (Names come in by a fade since PLAN 2.7d: read them at rest.)
  await page.evaluate(({ bx, by }) => window.__warsim!.view!.controller.set({ cx: bx, cy: by, scale: 24 }), { bx, by });
  await settle(page);
  const named = await page.evaluate(() => window.__warsim!.view!.cityLabels.lastPlaced.filter((l) => l.nameAlpha > 0.5).length);
  expect(named).toBeGreaterThanOrEqual(5);

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.29') : info.outputPath();
  mkdirSync(out, { recursive: true });
  for (const [name, lon, lat, scale] of [
    ['labels-europe', 15, 48, 3.2],
    ['labels-world', 30, 25, 1.2],
    ['cities-berlin', 13.4, 52.5, 24],
  ] as const) {
    await view(page, lon, lat, scale);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
  }
});
