import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';

// PLAN 2.4b AT: at T2 over a battle, every ElementDestroyed of the window has one wreck at its
// position, and no sprite of a dead element is drawn. The events come from the sim in Node (the
// worker runs the same sim: I4; the hashes are compared before and after), the wrecks and the
// sprites from the view, hour by hour. The pinned hash is the sweep stage's.

const { w: W } = SIZE_1938;
// The hour was 24 * 14 + 8 until PLAN 3.4Rn: with the attackers fed near their network (PLAN
// 3.4Rf) the same battle, in Spain, has its dead five days later (4 in the viewport then, 41 now).
const START = 24 * 19;
const HOURS = 16;
const M_PER_PX = 120;
/** Slots of a block are this far apart (cells): a wreck lies where the sprite stood, not a slot away. */
const SLOT = 0.03;

interface Death {
  id: number;
  x: number;
  y: number;
}
type Box = readonly [number, number, number, number];
const inBox = (d: Death, [x0, y0, x1, y1]: Box): boolean => d.x >= x0 && d.x <= x1 && d.y >= y0 && d.y <= y1;
const ids = (list: readonly Death[]): number[] => list.map((d) => d.id).sort((a, b) => a - b);

/** The elements that die in each of the HOURS after START, and the hashes around them. */
function nodeDeaths(): { hours: Death[][]; before: number; after: number } {
  const sim = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
  sim.step(START);
  const before = sim.hash();
  const hours: Death[][] = [];
  for (let h = 0; h < HOURS; h++) {
    const dead: Death[] = [];
    sim.step(1, (w) => {
      const ev = w.out.events;
      for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.ElementDestroyed) dead.push({ id: ev[i + 2]!, x: ev[i + 4]!, y: ev[i + 5]! });
      w.out.events.length = 0;
      w.out.fires.length = 0;
    });
    hours.push(dead);
  }
  return { hours, before, after: sim.hash() };
}

/** Centre of the 6-cell square where the most elements die. */
function busiest(deaths: readonly Death[]): [number, number] {
  const squares = new Map<string, Death[]>();
  for (const d of deaths) {
    const k = `${Math.floor(d.x / 6)},${Math.floor(d.y / 6)}`;
    squares.set(k, [...(squares.get(k) ?? []), d]);
  }
  const top = [...squares.values()].sort((a, b) => b.length - a.length)[0]!;
  return [top.reduce((s, d) => s + d.x, 0) / top.length, top.reduce((s, d) => s + d.y, 0) / top.length];
}

test('T2: every element that dies leaves a wreck where its sprite stood, and its sprite is gone', async ({ page }, info) => {
  test.setTimeout(240_000);
  const node = nodeDeaths();
  const all = node.hours.flat();
  expect(all.length).toBeGreaterThan(10);
  expect(new Set(ids(all)).size).toBe(all.length);
  const [cx, cy] = busiest(all);

  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  expect(await page.evaluate(async (n) => {
    const sim = window.__warsim!.sim;
    await sim.step(n);
    return sim.hash();
  }, START)).toEqual({ tick: START, hash: node.before });
  // Deaths at the world view leave no wrecks in the view: 19 days of war passed.
  expect(await page.evaluate(() => window.__warsim!.view!.wrecks.wrecks.length)).toBe(0);

  await page.evaluate(({ cx, cy, m }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx, cy, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, { cx, cy, m: M_PER_PX });
  await page.waitForFunction(({ cx, cy }) => {
    const v = window.__warsim!.view!;
    const b = v.subscription?.bbox;
    return v.subscription?.tier === 2 && b !== undefined && Math.abs((b[0] + b[2]) / 2 - cx) < 0.5 && Math.abs((b[1] + b[3]) / 2 - cy) < 0.5 && v.elementCount > 0;
  }, { cx, cy }, { timeout: 15_000 });
  const frame = await page.evaluate(() => {
    const v = window.__warsim!.view!;
    const c = document.querySelector('canvas')!;
    return { sub: v.subscription!.bbox, cam: { ...v.controller.cam }, size: [c.clientWidth, c.clientHeight] as const };
  });
  const [vw, vh] = frame.size;
  const viewport: Box = [frame.cam.cx - vw / 2 / frame.cam.scale, frame.cam.cy - vh / 2 / frame.cam.scale, frame.cam.cx + vw / 2 / frame.cam.scale, frame.cam.cy + vh / 2 / frame.cam.scale];

  let seen = 0;
  let inView = 0;
  let farthest = 0;
  for (let h = 0; h < HOURS; h++) {
    const got = await page.evaluate(async (tick) => {
      const v = window.__warsim!.view!;
      // The sprites of the snapshot before this hour: where each element is drawn.
      const before = new Map<number, [number, number]>();
      v.elementId.forEach((id, i) => before.set(id, [v.elementX[i]!, v.elementY[i]!]));
      const had = new Set(v.wrecks.wrecks.map((w) => w.id));
      await window.__warsim!.sim.step(1);
      await new Promise<void>((done) => {
        const wait = (): void => (v.lastTick === tick ? done() : void setTimeout(wait, 5));
        wait();
      });
      const fresh = v.wrecks.wrecks.filter((w) => !had.has(w.id));
      const born = fresh[0]?.born ?? 0;
      const draw = (at: number): { shown: number[]; bursts: number } => {
        v.drawUnitLayers(at);
        return { shown: v.wrecks.shown.map((w) => w.id), bursts: v.wrecks.bursts };
      };
      return {
        fresh: fresh.map((w) => ({ id: w.id, x: w.x, y: w.y, sprite: before.get(w.id) ?? null, born: w.born })),
        sprites: Array.from(v.elementId),
        burst: fresh.length > 0 ? draw(born + 100) : null,
        rest: fresh.length > 0 ? draw(born + 1000) : null,
        gone: fresh.length > 0 ? draw(born + 15_250) : null,
      };
    }, START + h + 1);

    // One wreck for each element that died this hour inside the subscribed box, at the event's
    // position, which is where its sprite stood in the frame before.
    const wanted = node.hours[h]!.filter((d) => inBox(d, frame.sub));
    expect(ids(got.fresh), `hour ${h + 1}`).toEqual(ids(wanted));
    const byId = new Map(wanted.map((d) => [d.id, d]));
    for (const w of got.fresh) {
      expect({ id: w.id, x: w.x, y: w.y }).toEqual(byId.get(w.id));
      expect(w.sprite, `sprite of ${w.id} before it died`).not.toBeNull();
      const off = Math.hypot(w.x - w.sprite![0], w.y - w.sprite![1]);
      farthest = Math.max(farthest, off);
      expect(off, `wreck of ${w.id} from its sprite`).toBeLessThan(SLOT / 2);
      // No sprite of a dead element is drawn any more.
      expect(got.sprites).not.toContain(w.id);
    }
    seen += got.fresh.length;
    if (got.fresh.length === 0) continue;
    // Drawn: a burst at once (the visible end), the wreck at rest a second on, nothing after
    // its 15 s. The wrecks in the viewport are all there.
    const visible = ids(got.fresh.filter((w) => inBox(w, viewport)));
    inView += visible.length;
    for (const id of visible) {
      expect(got.burst!.shown, `burst of ${id}`).toContain(id);
      expect(got.rest!.shown, `wreck of ${id}`).toContain(id);
    }
    expect(got.burst!.bursts).toBeGreaterThanOrEqual(visible.length);
    expect(got.rest!.bursts).toBe(0);
    expect(got.gone).toEqual({ shown: [], bursts: 0 });
  }
  const wantedAll = all.filter((d) => inBox(d, frame.sub));
  expect(seen).toBe(wantedAll.length);
  expect(inView).toBeGreaterThan(5);
  console.log(`wrecks: ${all.length} elements died in ${HOURS} h, ${seen} in the subscribed box, ${inView} in the viewport; farthest wreck from its sprite ${farthest.toExponential(2)} cells`);
  expect(await page.evaluate(() => window.__warsim!.sim.hash())).toEqual({ tick: START + HOURS, hash: node.after });
  const left = await page.evaluate(() => Array.from(window.__warsim!.view!.elementId));
  for (const d of wantedAll) expect(left).not.toContain(d.id);

  // Evidence: the frame loop is stopped; the moment of the last ends, then the wrecks at rest.
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/2.4') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const shoot = async (ms: number, name: string): Promise<void> => {
    await page.evaluate((ms) => {
      const v = window.__warsim!.view!;
      v.dispose();
      v.draw(v.wrecks.last + ms);
    }, ms);
    await page.screenshot({ path: path.join(out, name) });
  };
  await shoot(120, 'wrecks-120m-burst.png');
  await shoot(1200, 'wrecks-120m.png');
  await page.evaluate(({ cx, cy }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx, cy, scale: (v.metresPerPx * v.controller.cam.scale) / 40 });
  }, { cx, cy });
  await shoot(1200, 'wrecks-40m.png');
});
