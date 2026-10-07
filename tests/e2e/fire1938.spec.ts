import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { FIRE_STRIDE, FireField } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';

// PLAN 2.4a AT: the tracers the view draws at T2 are the sim's FireEvents of the same window,
// one each. The events come from the sim in Node (the worker runs the same sim: I4), the tracers
// from the frames of the view. Two weeks into 1938 a battle is found, the camera is put on it,
// one hour is stepped, and every frame of the shots' life is drawn.

const { w: W } = SIZE_1938;
const START = 24 * 14;
const M_PER_PX = 120;

interface Fire {
  shooter: number;
  target: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
type Box = readonly [number, number, number, number];

const inBox = (x: number, y: number, [x0, y0, x1, y1]: Box): boolean => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const touches = (f: Fire, b: Box): boolean => inBox(f.x0, f.y0, b) || inBox(f.x1, f.y1, b);
const ids = (fires: readonly Fire[]): number[] => fires.map((f) => f.shooter).sort((a, b) => a - b);

/** The FireEvents of the hour after START and the state hash after it. */
function nodeFires(): { fires: Fire[]; before: number; after: number } {
  const sim = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
  sim.step(START);
  const before = sim.hash();
  let raw: number[] = [];
  sim.step(1, (w) => {
    raw = w.out.fires.slice();
    w.out.fires.length = 0;
    w.out.events.length = 0;
  });
  const fires: Fire[] = [];
  for (let i = 0; i < raw.length; i += FIRE_STRIDE) {
    fires.push({ shooter: raw[i + FireField.shooter]!, target: raw[i + FireField.target]!, x0: raw[i + FireField.x0]!, y0: raw[i + FireField.y0]!, x1: raw[i + FireField.x1]!, y1: raw[i + FireField.y1]! });
  }
  return { fires, before, after: sim.hash() };
}

/** Centre of the 4-cell square with the most shooters. */
function busiest(fires: readonly Fire[]): [number, number] {
  const squares = new Map<string, { n: number; x: number; y: number }>();
  for (const f of fires) {
    const k = `${Math.floor(f.x0 / 4)},${Math.floor(f.y0 / 4)}`;
    const s = squares.get(k) ?? { n: 0, x: 0, y: 0 };
    s.n++;
    s.x += f.x0;
    s.y += f.y0;
    squares.set(k, s);
  }
  const top = [...squares.values()].sort((a, b) => b.n - a.n)[0]!;
  return [top.x / top.n, top.y / top.n];
}

test('T2 fire: one tracer for every FireEvent in the window, with its flash and its impact', async ({ page }, info) => {
  test.setTimeout(240_000);
  const node = nodeFires();
  expect(node.fires.length).toBeGreaterThan(200);
  // A shooter fires once an hour, so its id names its volley.
  expect(new Set(ids(node.fires)).size).toBe(node.fires.length);
  const [cx, cy] = busiest(node.fires);

  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  expect(await page.evaluate(async (n) => {
    const sim = window.__warsim!.sim;
    await sim.step(n);
    return sim.hash();
  }, START)).toEqual({ tick: START, hash: node.before });
  // Two weeks at the world view: no fire reached the view.
  expect(await page.evaluate(() => window.__warsim!.view!.fire.from)).toBe(-Infinity);

  // T2 on the battle; the view subscribes there before the hour is stepped.
  await page.evaluate(({ cx, cy, m }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx, cy, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, { cx, cy, m: M_PER_PX });
  await page.waitForFunction(({ cx, cy }) => {
    const v = window.__warsim!.view!;
    const b = v.subscription?.bbox;
    return v.subscription?.tier === 2 && b !== undefined && Math.abs((b[0] + b[2]) / 2 - cx) < 0.5 && Math.abs((b[1] + b[3]) / 2 - cy) < 0.5 && v.elementCount > 0;
  }, { cx, cy }, { timeout: 15_000 });
  expect(await page.evaluate(async () => {
    const sim = window.__warsim!.sim;
    await sim.step(1);
    return sim.hash();
  })).toEqual({ tick: START + 1, hash: node.after });
  await page.waitForFunction((t) => window.__warsim!.view!.lastTick === t, START + 1);

  const got = await page.evaluate(() => {
    const v = window.__warsim!.view!;
    const c = document.querySelector('canvas')!;
    const { from, until, shots } = v.fire;
    // Every frame of the shots' life, 16 ms apart, on the overlay alone.
    const flown = new Map<number, number>();
    const frames: { tracers: number; flashes: number; impacts: number }[] = [];
    for (let now = from; now < until + 32; now += 16) {
      v.drawUnitLayers(now);
      for (const s of v.fire.tracers) flown.set(s.shooter, (flown.get(s.shooter) ?? 0) + 1);
      frames.push({ tracers: v.fire.tracers.length, flashes: v.fire.flashes, impacts: v.fire.impacts });
    }
    v.drawUnitLayers(until + 500);
    return {
      cam: { ...v.controller.cam },
      size: [c.clientWidth, c.clientHeight] as const,
      sub: v.subscription!,
      shots: shots.map((s) => ({ ...s })),
      flown: [...flown],
      frames,
      after: { tracers: v.fire.tracers.length, flashes: v.fire.flashes, impacts: v.fire.impacts },
      dropped: v.firesDropped,
      skipped: v.fire.skipped,
      span: until - from,
    };
  });

  // Interest management: the view got the events with an end in its subscribed box, each once
  // and as the sim made it.
  const wanted = node.fires.filter((f) => touches(f, got.sub.bbox));
  expect(wanted.length).toBeGreaterThan(50);
  expect(got.dropped).toBe(0);
  expect(got.skipped).toBe(0);
  expect(ids(got.shots)).toEqual(ids(wanted));
  const byShooter = new Map(wanted.map((f) => [f.shooter, f]));
  for (const s of got.shots) {
    // What the view adds (when it starts, how it looks, where around the target it lands, the
    // figure it leaves at T3: none at this zoom) aside.
    const { start: _start, weapon: _weapon, dx, dy, from, ...ends } = s;
    expect(ends).toEqual(byShooter.get(s.shooter));
    expect(from).toBeNull();
    expect(Math.hypot(dx, dy)).toBeLessThan(0.03); // within the target's slot
  }

  // The AT: the tracers drawn in the viewport are the FireEvents of the same window.
  const [vw, vh] = got.size;
  const view: Box = [got.cam.cx - vw / 2 / got.cam.scale, got.cam.cy - vh / 2 / got.cam.scale, got.cam.cx + vw / 2 / got.cam.scale, got.cam.cy + vh / 2 / got.cam.scale];
  const shotOf = new Map(got.shots.map((s) => [s.shooter, s]));
  const drawnInView = got.flown.map(([shooter]) => shotOf.get(shooter)!).filter((s) => touches(s, view));
  const eventsInView = node.fires.filter((f) => touches(f, view));
  expect(eventsInView.length).toBeGreaterThan(30);
  expect(drawnInView.length).toBe(eventsInView.length);
  expect(ids(drawnInView)).toEqual(ids(eventsInView));
  // A tracer flies for 150–420 ms: 9 to 27 frames, never a single flicker and never a leftover.
  for (const [shooter, n] of got.flown) {
    expect(n, `tracer of ${shooter}`).toBeGreaterThanOrEqual(9);
    expect(n, `tracer of ${shooter}`).toBeLessThanOrEqual(27);
  }
  // Flashes come first and impacts last; when the last impact has faded nothing is drawn.
  const first = got.frames.findIndex((f) => f.flashes > 0);
  const lastTracer = got.frames.findLastIndex((f) => f.tracers > 0);
  const lastImpact = got.frames.findLastIndex((f) => f.impacts > 0);
  expect(first).toBeGreaterThanOrEqual(0);
  expect(got.frames.slice(0, first).every((f) => f.tracers === 0 && f.impacts === 0)).toBe(true);
  expect(lastImpact).toBeGreaterThan(lastTracer);
  expect(Math.max(...got.frames.map((f) => f.impacts))).toBeGreaterThan(10);
  expect(got.after).toEqual({ tracers: 0, flashes: 0, impacts: 0 });
  expect(got.span).toBeLessThan(1300);

  // Evidence: the frame loop is stopped and one moment of the burst is drawn, map and all.
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/2.4') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const shoot = async (ms: number, name: string): Promise<void> => {
    await page.evaluate((ms) => {
      const v = window.__warsim!.view!;
      v.dispose();
      v.draw(v.fire.from + ms);
    }, ms);
    await page.screenshot({ path: path.join(out, name) });
  };
  await shoot(260, 'fire-120m.png');
  await page.evaluate(({ cx, cy }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx, cy, scale: (v.metresPerPx * v.controller.cam.scale) / 45 });
  }, { cx, cy });
  await shoot(260, 'fire-45m.png');

  // Running at a day a second an element fires 24 volleys a second. A shooter shows one shot at
  // a time, so the fire on screen is bounded by the elements that fight, not by the speed. The
  // view's frame loop stays stopped: software GL takes over 100 ms a frame here, and the worker
  // sends one snapshot per acked frame; without it snapshots come per tick, as with a GPU.
  await page.evaluate(({ cx, cy, m }) => {
    const v = window.__warsim!.view!;
    const hud = window.__warsim!.hud;
    v.controller.set({ cx, cy, scale: (v.metresPerPx * v.controller.cam.scale) / m });
    hud.setSpeedLevel(4);
    if (hud.paused.value) hud.togglePause();
  }, { cx, cy, m: M_PER_PX });
  await page.waitForFunction((t) => window.__warsim!.view!.lastTick >= t, START + 20, { timeout: 30_000 });
  const run = await page.evaluate(() => {
    const v = window.__warsim!.view!;
    const hud = window.__warsim!.hud;
    const now = performance.now();
    v.draw(now);
    const res = { ticks: v.lastTick, tracers: v.fire.tracers.map((s) => s.shooter), flashes: v.fire.flashes, impacts: v.fire.impacts, shots: v.fire.shots.length, skipped: v.fire.skipped, dropped: v.firesDropped, elements: v.elementCount, ms: 0 };
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) v.drawUnitLayers(now);
    res.ms = (performance.now() - t0) / 100;
    v.draw(now);
    if (!hud.paused.value) hud.togglePause();
    return res;
  });
  await page.screenshot({ path: path.join(out, 'fire-120m-running.png') });
  console.log(`fire at ×5, ${M_PER_PX} m/px: ${run.tracers.length} tracers, ${run.flashes} flashes, ${run.impacts} impacts of ${run.shots} shots among ${run.elements} elements; ${run.skipped} events not drawn, ${run.dropped} dropped; fire layer ${run.ms.toFixed(3)} ms a frame`);
  expect(run.tracers.length).toBeGreaterThan(10);
  expect(new Set(run.tracers).size).toBe(run.tracers.length); // one in flight per shooter
  expect(run.shots).toBeLessThanOrEqual(2 * run.elements); // the live ones and those not yet cleared
  expect(run.skipped).toBeGreaterThan(0);
  expect(run.dropped).toBe(0);
  expect(run.ms).toBeLessThan(4);
});

test('T1: no fire is sent to a view that draws no elements', async ({ page }) => {
  test.setTimeout(180_000);
  const node = nodeFires();
  const [cx, cy] = busiest(node.fires);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  await page.evaluate((n) => window.__warsim!.sim.step(n), START);
  await page.evaluate(({ cx, cy }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx, cy, scale: (v.metresPerPx * v.controller.cam.scale) / 1000 });
  }, { cx, cy });
  await page.waitForFunction(() => window.__warsim!.view!.subscription?.tier === 1);
  await page.evaluate(() => window.__warsim!.sim.step(1));
  await page.waitForFunction((t) => window.__warsim!.view!.lastTick === t, START + 1);
  const got = await page.evaluate(() => {
    const v = window.__warsim!.view!;
    return { from: v.fire.from, shots: v.fire.shots.length, markers: v.markerRects.length };
  });
  expect(got.markers).toBeGreaterThan(0); // the battle is in view
  expect(got).toMatchObject({ from: -Infinity, shots: 0 });
});
