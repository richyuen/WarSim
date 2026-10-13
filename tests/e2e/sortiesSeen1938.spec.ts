import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 5.7a: the sorties in the air are drawn as planes of their nation's colour where the sim's
// sortie function has them at the frame's time: Germany at war with Poland, its wings tasked at
// the next day's first hour, over Poland at T1 and T0.

const id = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;
const [cx, cy] = cellOf(18.0, 52.0, SIZE_1938.w, SIZE_1938.h);

test('Germany\'s sorties over Poland drawn at T1 and T0, in its colour, moving between ticks', async ({ page }, info) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/5.7') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.evaluate(({ a, d }) => window.__warsim!.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: id('GER'), d: id('POL') });
  // Three days: the front in contact, the air AI's wings over it.
  await page.evaluate(() => window.__warsim!.sim.step(72));
  await page.waitForFunction(() => window.__warsim!.view!.lastTick >= 72);
  // T1 over Poland: hour by hour, the sorties move (a flight near the front is an hour or two,
  // then a turn round); the picture at the hour with the most of them in view.
  await page.evaluate(({ x, y }) => window.__warsim!.view!.controller.set({ cx: x, cy: y, scale: 8 }), { x: cx, y: cy });
  const seen: string[] = [];
  let most = { hour: 0, n: 0 };
  for (let h = 73; h <= 84; h++) {
    await page.evaluate(() => window.__warsim!.sim.step(1));
    await page.waitForFunction((t) => window.__warsim!.view!.lastTick >= t, h);
    await page.evaluate(() => window.__warsim!.view!.draw());
    const marks = await page.evaluate(() => window.__warsim!.view!.sortieMarks.map((m) => ({ ...m })));
    expect(marks.every((m) => m.x >= -60 && m.y >= -60 && m.x <= 1460 && m.y <= 860)).toBe(true);
    if (marks.length > 0) seen.push(JSON.stringify(marks));
    if (marks.length > most.n) {
      most = { hour: h, n: marks.length };
      await page.screenshot({ path: path.join(out, 'a-sorties-over-poland-t1.png') });
    }
  }
  expect(seen.length).toBeGreaterThan(2);
  expect(new Set(seen).size).toBe(seen.length);
  process.stderr.write(`sorties over Poland at T1: ${seen.length} of 12 hours with some in view, the most ${most.n} at hour ${most.hour}\n`);
  // T0, the whole of Europe.
  await page.evaluate(({ x, y }) => window.__warsim!.view!.controller.set({ cx: x, cy: y, scale: 1.5 }), { x: cx, y: cy });
  let t0 = 0;
  for (let h = 85; h <= 96 && t0 === 0; h++) {
    await page.evaluate(() => window.__warsim!.sim.step(1));
    await page.waitForFunction((t) => window.__warsim!.view!.lastTick >= t, h);
    t0 = await page.evaluate(() => { window.__warsim!.view!.draw(); return window.__warsim!.view!.sortieMarks.length; });
  }
  expect(t0).toBeGreaterThan(0);
  await page.screenshot({ path: path.join(out, 'b-sorties-europe-t0.png') });
});
