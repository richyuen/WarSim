import { expect, test } from '@playwright/test';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';
import { settle } from './settle';

// PLAN 2.7q (ADR-74, second read, finding 4): a world loaded into a running game takes the place
// of everything of the old one in the view.
//
// The view kept each nation's capital and colour by id, set them for every row of a snapshot and
// removed none. A scenario file imported into a game in which a revolt had made a nation has no
// row for that nation: its flag stayed where its capital had been.

const { w: W, h: H } = SIZE_1938;

test('a scenario loaded into a running game leaves no flag of a nation it does not have', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });

  // The world as it starts, as the state of a scenario file (kept in the page: it is megabytes).
  const start = await page.evaluate(async () => {
    const sim = window.__warsim!.sim;
    (window as unknown as { __saved: Uint8Array }).__saved = (await sim.exportScenario()).bytes;
    return { tick: (await sim.inspect()).tick, ids: (await sim.inspect()).nations.map((n) => n.id) };
  });

  // A revolt in Masovia makes a nation the scenario does not have.
  const node = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
  const [wx, wy] = cellOf(21.0, 52.23, W, H); // Warsaw
  const province = node.world.cells.province[Math.floor(wy) * W + Math.floor(wx)]!;
  const born = await page.evaluate(async (province) => {
    const sim = window.__warsim!.sim;
    sim.command({ kind: 'spawnRevolt', province });
    const tick = (await sim.step(1)).tick;
    await new Promise<void>((done) => {
      const wait = (): void => (window.__warsim!.view!.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
    const s = await sim.inspect(true);
    return { nations: s.nations.filter((n) => n.living).map((n) => n.id), capitals: s.cities.filter((c) => c.capitalOf !== 0).map((c) => ({ id: c.capitalOf, x: c.x, y: c.y })) };
  }, province);
  const rebels = born.nations.filter((id) => !start.ids.includes(id));
  expect(rebels.length, 'the revolt made one nation with an id of its own').toBe(1);
  const rebel = rebels[0]!;
  const capital = born.capitals.find((c) => c.id === rebel)!;
  expect(capital, 'the rebels have a capital').toBeDefined();

  // Their flag flies over it.
  const flagsAt = async (): Promise<number[]> => {
    await page.evaluate(({ x, y }) => window.__warsim!.view!.controller.set({ cx: x, cy: y, scale: 6 }), capital);
    await settle(page);
    return page.evaluate(() => window.__warsim!.view!.flagRects.map((f) => f.id));
  };
  expect(await flagsAt()).toContain(rebel);

  // The scenario is loaded into the running game, as the editor's import does it.
  const loaded = await page.evaluate(async () => {
    const sim = window.__warsim!.sim;
    const before = window.__warsim!.view!.snapshots;
    await sim.load((window as unknown as { __saved: Uint8Array }).__saved);
    await new Promise<void>((done) => {
      const wait = (): void => (window.__warsim!.view!.snapshots > before ? done() : void setTimeout(wait, 5));
      wait();
    });
    const s = await sim.inspect();
    return { tick: s.tick, ids: s.nations.map((n) => n.id) };
  });
  expect(loaded.tick).toBe(start.tick);
  expect(loaded.ids).toEqual(start.ids);
  expect(loaded.ids).not.toContain(rebel);

  // Nudged, so that the view draws; at the same place and zoom.
  await page.evaluate(({ x, y }) => window.__warsim!.view!.controller.set({ cx: x + 0.01, cy: y, scale: 6 }), capital);
  await settle(page);
  const flags = await page.evaluate(() => window.__warsim!.view!.flagRects.map((f) => f.id));
  expect(flags.length).toBeGreaterThan(5);
  expect(flags.filter((id) => !loaded.ids.includes(id)), 'flags of nations the loaded world does not have').toEqual([]);
});
