import { expect, test } from '@playwright/test';
import type {} from '../../src/app/testApi';
import { armourLosses } from '../helpers/armourLosses';

// PLAN 3.7n (the eighth read, finding 5): a game loaded into a running one leaves nothing in
// the view of the fighting of the game before, and makes no hull of what lies between the two.
//
// The view told a load by a clock that went back. A later save of the same game passed: its
// elements are the same by id, formation and size, and every tank lost between the two states
// was a hull at once. A load to an earlier tick kept the hulls, wrecks and shots of the state
// that was gone for as long as they last.
//
// The ground is that of `burning1938`: where armour loses tanks under fire, found in Node. A
// save at the window's start (A) and one at its end (B), the camera at T3 over it.

const FIRST_DAY = 14;
const LAST_DAY = 120;
const HOURS = 12;
const LEAST = 5;
const M_PER_PX = 4;

test('T3: a game loaded into a running one leaves no hull, wreck or shot of the game before, and none for what lies between', async ({ page }) => {
  test.setTimeout(300_000);
  const node = armourLosses(FIRST_DAY, LAST_DAY, HOURS, LEAST, true);

  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  expect(await page.evaluate(async (n) => {
    const sim = window.__warsim!.sim;
    await sim.step(n);
    (window as unknown as { __a: Uint8Array }).__a = await sim.save();
    return sim.hash();
  }, node.start)).toEqual({ tick: node.start, hash: node.before });

  await page.evaluate(({ x, y, m }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, { x: node.x, y: node.y, m: M_PER_PX });
  await page.waitForFunction(({ x, y }) => {
    const v = window.__warsim!.view!;
    const b = v.subscription?.bbox;
    return v.subscription?.tier === 3 && b !== undefined && Math.abs((b[0] + b[2]) / 2 - x) < 0.5 && Math.abs((b[1] + b[3]) / 2 - y) < 0.5 && v.snapshots > 0 && v.elementsZoom < 1.01 * v.metresPerPx && v.individualsShown && v.shares.individuals === 1;
  }, { x: node.x, y: node.y }, { timeout: 15_000 });

  /** Steps `hours` hours one by one from tick `from`; the hulls each made, and the most wrecks and shots the view held. */
  const watch = (from: number, hours: number) => page.evaluate(async ({ from, hours }) => {
    const v = window.__warsim!.view!;
    const made: string[] = [];
    let wrecks = 0;
    let shots = 0;
    for (let h = 1; h <= hours; h++) {
      const had = new Set(v.hulls.hulls);
      await window.__warsim!.sim.step(1);
      await new Promise<void>((done) => {
        const wait = (): void => (v.lastTick === from + h ? done() : void setTimeout(wait, 5));
        wait();
      });
      for (const x of v.hulls.hulls) if (!had.has(x)) made.push(`${h}:${x.element}:${x.figure}:${x.burns}`);
      wrecks = Math.max(wrecks, v.wrecks.wrecks.length);
      shots = Math.max(shots, v.fire.shots.length);
    }
    return { made, wrecks, shots, held: { hulls: v.hulls.hulls.length, wrecks: v.wrecks.wrecks.length, shots: v.fire.shots.length } };
  }, { from, hours });

  /** Loads the save kept as `name` and reads the view after the first snapshot of the loaded game. */
  const load = (name: '__a' | '__b', tick: number) => page.evaluate(async ({ name, tick }) => {
    const v = window.__warsim!.view!;
    const before = v.snapshots;
    const had = { hulls: v.hulls.hulls.length, shots: v.fire.shots.length };
    const status = await window.__warsim!.sim.load((window as unknown as Record<string, Uint8Array>)[name]!);
    await new Promise<void>((done) => {
      const wait = (): void => (v.snapshots > before && v.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
    const at = performance.now();
    v.drawUnitLayers(at);
    return { had, tick: status.tick, hulls: v.hulls.hulls.length, wrecks: v.wrecks.wrecks.length, shots: v.fire.shots.length, shown: v.hulls.shown.length + v.wrecks.shown.length, animating: v.hulls.animating(at) || v.wrecks.animating(at) || v.fire.animating(at), tanks: Array.from(v.elementId).length };
  }, { name, tick });

  // The twelve hours, watched: tanks are lost and burn.
  const first = await watch(node.start, HOURS);
  expect(first.made.length, 'hulls of the twelve hours').toBeGreaterThanOrEqual(3);
  expect(first.held.hulls, 'hulls still there at the window\'s end').toBeGreaterThanOrEqual(1);
  expect(first.shots, 'shots seen in the twelve hours').toBeGreaterThanOrEqual(1);
  expect(await page.evaluate(async () => {
    const sim = window.__warsim!.sim;
    (window as unknown as { __b: Uint8Array }).__b = await sim.save();
    return sim.hash();
  })).toEqual({ tick: node.start + HOURS, hash: node.after });

  // Back to the window's start: nothing is left of the hours that are gone.
  const back = await load('__a', node.start);
  expect(back.tick).toBe(node.start);
  expect(back.tanks, 'the view holds the loaded game\'s elements').toBeGreaterThan(0);
  expect.soft({ hulls: back.hulls, wrecks: back.wrecks, shots: back.shots, shown: back.shown, animating: back.animating }, 'after a load to an earlier tick').toEqual({ hulls: 0, wrecks: 0, shots: 0, shown: 0, animating: false });

  // On to the window's end, the view holding the elements of its start: the tanks lost between
  // the two were not lost in the hour before, and nobody saw them go.
  const on = await load('__b', node.start + HOURS);
  expect(on.tick).toBe(node.start + HOURS);
  expect(on.tanks).toBeGreaterThan(0);
  expect.soft({ hulls: on.hulls, wrecks: on.wrecks, shots: on.shots, shown: on.shown, animating: on.animating }, 'after a load to a later tick').toEqual({ hulls: 0, wrecks: 0, shots: 0, shown: 0, animating: false });

  // The loaded game goes on as the first did: the same hulls in the same hours, the same state.
  await load('__a', node.start);
  const again = await watch(node.start, HOURS);
  expect(again.made).toEqual(first.made);
  // A load in the middle of the firing, the hour's shots still in the air: they go with their game.
  const mid = await load('__b', node.start + HOURS);
  expect(mid.had.shots, 'shots in the air at the load').toBeGreaterThanOrEqual(1);
  expect.soft({ hulls: mid.hulls, wrecks: mid.wrecks, shots: mid.shots, shown: mid.shown, animating: mid.animating }, 'after a load with shots in the air').toEqual({ hulls: 0, wrecks: 0, shots: 0, shown: 0, animating: false });
  expect(await page.evaluate(() => window.__warsim!.sim.hash())).toEqual({ tick: node.start + HOURS, hash: node.after });
  console.log(`loaded effects: day ${(node.start / 24).toFixed(1)}, ${HOURS} h at (${node.x.toFixed(2)}, ${node.y.toFixed(2)}): ${first.made.length} hulls, at most ${first.wrecks} wrecks and ${first.shots} shots; held at the end ${first.held.hulls} hulls, ${first.held.wrecks} wrecks, ${first.held.shots} shots; none after either load, the same ${again.made.length} hulls on the second run, ${mid.had.shots} shots in the air at the last load`);
});
