import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 5.7b: the air war's effects drawn from its events: tracers and flak where an hour's air
// fight is, bombs bursting at a strike's target, flak about a sortie fired on by AA. Germany at
// war with Poland (seed 1), over Poland at T1, from its second day.

const id = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;
const [cx, cy] = cellOf(18.0, 52.0, SIZE_1938.w, SIZE_1938.h);
const NAMES = ['fight', 'bombs', 'flak'] as const;

test('over Poland at T1: air fights, bombs and flak drawn, each in the hour of its event', async ({ page }, info) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/5.7') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.evaluate(({ a, d }) => window.__warsim!.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: id('GER'), d: id('POL') });
  await page.evaluate(() => window.__warsim!.sim.step(24));
  await page.waitForFunction(() => window.__warsim!.view!.lastTick >= 24);
  await page.evaluate(({ x, y }) => window.__warsim!.view!.controller.set({ cx: x, cy: y, scale: 8 }), { x: cx, y: cy });
  const seen = [0, 0, 0];
  const hours = [0, 0, 0];
  for (let h = 25; h <= 72 && seen.some((n) => n === 0); h++) {
    await page.evaluate(() => window.__warsim!.sim.step(1));
    await page.waitForFunction((t) => window.__warsim!.view!.lastTick >= t, h);
    // A little into the hour's marks' life, as a frame then would show it: drawn at that time of
    // the render clock (the test's own steps take seconds, the marks live two or three).
    const draw = (): Promise<number[]> =>
      page.evaluate(() => {
        const v = window.__warsim!.view!;
        const born = Math.max(-Infinity, ...v.airFx.marks.map((m) => m.born));
        v.draw(born + 400);
        return v.airFx.shown.slice();
      });
    const shown = await draw();
    for (let k = 0; k < 3; k++) {
      if (shown[k]! > 0 && seen[k] === 0) {
        // The picture, of that same frame (a screenshot draws again at its own time first: frozen here by the same call).
        await page.evaluate(() => {
          const v = window.__warsim!.view!;
          const born = Math.max(...v.airFx.marks.map((m) => m.born));
          (v as unknown as { frameAt: (t: number) => boolean }).frameAt = () => false;
          v.draw(born + 400);
        });
        await page.screenshot({ path: path.join(out, `c-air-${NAMES[k]}-t1.png`) });
        await page.evaluate(() => {
          delete (window.__warsim!.view! as unknown as { frameAt?: unknown }).frameAt;
        });
      }
      if (shown[k]! > 0) {
        seen[k] = seen[k]! + shown[k]!;
        hours[k] = hours[k]! + 1;
      }
    }
  }
  process.stderr.write(`over Poland, hours 25 to 72: fights drawn ${seen[0]} (${hours[0]} hours), bombs ${seen[1]} (${hours[1]}), flak ${seen[2]} (${hours[2]})\n`);
  expect(seen[1], 'bombs').toBeGreaterThan(0);
  expect(seen[2], 'flak').toBeGreaterThan(0);
  expect(seen[0], 'a fight').toBeGreaterThan(0);
  // They go: three seconds and a half after the last came, every mark is over.
  expect(
    await page.evaluate(() => {
      const v = window.__warsim!.view!;
      v.draw(Math.max(...v.airFx.marks.map((m) => m.born), 0) + 3600);
      return v.airFx.shown.reduce((a, b) => a + b, 0);
    }),
  ).toBe(0);
});
