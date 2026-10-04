import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { settle } from './settle';

// PLAN 2.7g (ADR-74, finding 2): a destroyed nation's capital flag goes with it. The snapshot
// has a row for every nation, the dead ones too, with the last capital; the view only ever added
// to its capitals. Poland's flag stood over Warsaw, in Germany's colour of the map, for the rest
// of the game.

const { w: W, h: H } = SIZE_1938;
const nation = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const POL = nation('POL');
const GER = nation('GER');

test('a nation that is annexed loses its capital flag; the annexer keeps its own', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  // Warsaw and Berlin in one view, at a zoom that has the flags (3 px per cell and more).
  const [wx, wy] = cellOf(17.2, 52.4, W, H);
  await page.evaluate(({ wx, wy }) => window.__warsim!.view!.controller.set({ cx: wx, cy: wy, scale: 8 }), { wx, wy });
  await settle(page);
  const flags = (): Promise<{ id: number; alpha: number }[]> => page.evaluate(() => window.__warsim!.view!.flagRects.map((f) => ({ id: f.id, alpha: f.alpha })));

  const out = process.env['EVIDENCE'] !== undefined ? path.resolve(import.meta.dirname, '../../docs/evidence/2.7') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const clip = { x: 300, y: 150, width: 800, height: 500 };
  await page.screenshot({ path: path.join(out, 'flag-poland-before-annex.png'), clip });

  const before = await flags();
  expect(before.find((f) => f.id === POL), 'Poland before').toMatchObject({ alpha: 1 });
  expect(before.find((f) => f.id === GER), 'Germany before').toMatchObject({ alpha: 1 });

  await page.evaluate(async ({ annexer, target }) => {
    const sim = window.__warsim!.sim;
    sim.command({ kind: 'annexNation', annexer, target });
    const tick = (await sim.step(1)).tick;
    await new Promise<void>((done) => {
      const wait = (): void => (window.__warsim!.view!.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
  }, { annexer: GER, target: POL });
  // The name goes too, when the worker has laid the names out again (at most every 2 s).
  await page.waitForFunction(() => !window.__warsim!.view!.nationLabels.some((l) => l.text === 'Poland'), null, { timeout: 15_000 });
  await settle(page);
  await page.screenshot({ path: path.join(out, 'flag-poland-after-annex.png'), clip });

  const stats = await page.evaluate(() => window.__warsim!.sim.inspect(false));
  expect(stats.nations.find((n) => n.id === POL), 'Poland is dead').toMatchObject({ living: false });
  expect(stats.nations.find((n) => n.id === GER), 'Germany lives').toMatchObject({ living: true });
  const after = await flags();
  expect(after.some((f) => f.id === POL), 'Poland after').toBe(false);
  expect(after.find((f) => f.id === GER), 'Germany after').toMatchObject({ alpha: 1 });
  // Nothing else went with it.
  expect(after.map((f) => f.id).sort((a, b) => a - b)).toEqual(before.map((f) => f.id).filter((id) => id !== POL).sort((a, b) => a - b));
});
