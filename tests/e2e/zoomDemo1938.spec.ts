import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { FIRE_STRIDE, FireField } from '../../src/shared/events';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { elementIndex, slotPlace } from '../../src/sim/systems/elements';
import { assets1938 } from '../helpers/earth';

// PLAN 2.10a: the semantic zoom in one piece. One camera path from the whole world down to
// 3 m/px on a battle of the 1938 scenario's own, a month into the year, in eight stops that
// cross all three tier boundaries (2000, 300 and 30 m/px), two stops in each tier.
//
// The battle is found by a run of the same sim in Node (the worker runs the same sim: I4): of
// the divisions that fire in the last hour and have stood where they stand for a day, the one
// whose battalions have lost most while each still has more than 64 men. Its batteries have lost
// guns too. So the two closest stops show how losses look at T3 (PLAN 2.10b, ADR-80): battalions
// at a third of their strength with a third of their 64 figures, beside batteries that show
// every gun lost. (Until 2.10b each of those battalions drew 64: these pictures decided it.)
//
// The clock is the test's. The game is paused and stepped; the view's own loop is stopped and
// its turns (`frameAt`: the camera eases, the view subscribes, the frame is drawn) are given
// times 16 ms apart, with a pause between two for the worker's snapshots to arrive. Each leg is
// one eased zoom of the camera's own to the next stop (`zoomTo`, what the wheel does), held on
// the battle. A slow machine makes the test longer; it does not change what a frame sees,
// except that a snapshot can come some frames later.
//
// Seamless, measured: in every frame of every leg no unit layer's share moves by more than a
// fade's step, and none moves back. (ADR-71's measure of pixels needs a camera at rest: while
// the camera moves, every edge moves. `fades1938.spec.ts` has that measure at each boundary.)

const { w: W } = SIZE_1938;
const START = 24 * 30;
const VIEW = { width: 1400, height: 800 };
const FRAME_MS = 16;
/** The most a share moves in a frame of 16 ms (as `fades1938`: 0.096 for a fade of 250 ms, with room). */
const MAX_STEP = 0.12;
/** The figures of an element at T3 (ADR-80), written out here on its own: a figure a unit up to 64 units to an element; above, its share of 64, rounded up. */
const figuresOf = (strength: number, size: number): number => (size <= 64 ? strength : Math.min(64, Math.ceil((strength * 64) / size)));
/** The opacity of an element's sprite at T2 (PLAN 2.11g), written out here on its own: its share of its size, from 0.45 to 1. */
const alphaOf = (strength: number, size: number): number => 0.45 + 0.55 * Math.min(1, strength / size);

interface Stop {
  name: string;
  /** m/px; null: as far out as the camera goes. */
  m: number | null;
  tier: number;
  /** The layers' shares at rest: markers (T1 and closer), elements (T2 and closer), figures (T3). */
  shares: [number, number, number];
}
const STOPS: Stop[] = [
  { name: 'world', m: null, tier: 0, shares: [0, 0, 0] },
  { name: 'theatre', m: 6000, tier: 0, shares: [0, 0, 0] },
  { name: 'front', m: 1500, tier: 1, shares: [1, 0, 0] },
  { name: 'sector', m: 500, tier: 1, shares: [1, 0, 0] },
  { name: 'battle', m: 150, tier: 2, shares: [1, 1, 0] },
  { name: 'division', m: 50, tier: 2, shares: [1, 1, 0] },
  { name: 'battalions', m: 12, tier: 3, shares: [1, 1, 1] },
  { name: 'men', m: 3, tier: 3, shares: [1, 1, 1] },
];
/** The stops at which an hour is stepped, so that the battle is seen to fight. */
const CLOSE = STOPS.filter((s) => s.tier >= 2).length;

interface El {
  id: number;
  strength: number;
  /** Its full size, and where it stands (cells). */
  size: number;
  x: number;
  y: number;
}
interface Battle {
  formation: number;
  nation: number;
  x: number;
  y: number;
  /** Between its batteries and the battalions next to them: where the camera closes in. */
  anchor: [number, number];
  /** At START and after each stepped hour: its elements, its men, the state's hash, the shots by or at it in that hour. */
  elements: El[][];
  men: number[];
  hashes: number[];
  shots: number[];
  /** After each stepped hour: whether it has a march, and whether it is in contact (index 0: at START). */
  moving: boolean[];
  engaged: boolean[];
}

/** The battle, and what the stepped hours make of it, from the sim in Node. */
function nodeBattle(): Battle {
  const sim = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
  const w = sim.world;
  const fc = w.formations.cols;
  const ec = w.elements.cols;
  const units = w.rules!.units;
  const size = (e: number): number => units[ec.unit[e]!]!.size;
  sim.step(START - 24);
  const dayBefore = new Map(w.formations.ids().map((f) => [f, [fc.x[f]!, fc.y[f]!] as const]));
  sim.step(23);
  const firing = new Set<number>();
  sim.step(1, (wd) => {
    for (let i = 0; i < wd.out.fires.length; i += FIRE_STRIDE) firing.add(ec.formation[wd.out.fires[i + FireField.shooter]!]!);
    wd.out.fires.length = 0;
    wd.out.events.length = 0;
  });
  const idx = elementIndex(w);
  const battalions = (f: number): number[] => (idx.get(f) ?? []).filter((e) => size(e) > 64);
  const batteries = (f: number): number[] => (idx.get(f) ?? []).filter((e) => size(e) <= 16);
  const kept = (f: number): number => battalions(f).reduce((s, e) => s + ec.strength[e]!, 0) / battalions(f).reduce((s, e) => s + size(e), 0);
  const candidates = [...firing].filter((f) => {
    if (!w.formations.has(f)) return false;
    const was = dayBefore.get(f);
    if (!was || was[0] !== fc.x[f] || was[1] !== fc.y[f]) return false;
    return battalions(f).length >= 8 && battalions(f).every((e) => ec.strength[e]! > 64) && batteries(f).length >= 2 && batteries(f).some((e) => ec.strength[e]! < size(e));
  });
  const formation = candidates.sort((a, b) => kept(a) - kept(b) || a - b)[0];
  if (formation === undefined) throw new Error('no division that fires, stands and has lost men: the demo has no battle');
  const count = w.rules!.templates[fc.template[formation]!]!.elements.reduce((s, x) => s + x.count, 0);
  const read = (): El[] =>
    (elementIndex(w).get(formation) ?? []).map((e) => {
      const [x, y] = slotPlace(w, fc.x[formation]!, fc.y[formation]!, fc.facing[formation]!, ec.slot[e]!, count);
      return { id: e, strength: ec.strength[e]!, size: size(e), x, y };
    });
  const first = read();
  // The anchor: the batteries and, for each, the battalion nearest to it.
  const guns = first.filter((e) => e.size <= 16);
  const men = first.filter((e) => e.size > 64);
  const group = new Set(guns);
  for (const g of guns) group.add([...men].sort((a, b) => Math.hypot(a.x - g.x, a.y - g.y) - Math.hypot(b.x - g.x, b.y - g.y))[0]!);
  const anchor: [number, number] = [[...group].reduce((s, e) => s + e.x, 0) / group.size, [...group].reduce((s, e) => s + e.y, 0) / group.size];

  const own = new Set(first.map((e) => e.id));
  const out: Battle = { formation, nation: fc.nation[formation]!, x: fc.x[formation]!, y: fc.y[formation]!, anchor, elements: [first], men: [fc.strength[formation]!], hashes: [sim.hash()], shots: [0], moving: [fc.moving[formation] === 1], engaged: [fc.engaged[formation] === 1] };
  for (let k = 0; k < CLOSE; k++) {
    let n = 0;
    sim.step(1, (wd) => {
      const f = wd.out.fires;
      for (let i = 0; i < f.length; i += FIRE_STRIDE) if (own.has(f[i + FireField.shooter]!) || own.has(f[i + FireField.target]!)) n++;
      wd.out.fires.length = 0;
      wd.out.events.length = 0;
    });
    if (!w.formations.has(formation)) throw new Error(`formation ${formation} did not live through hour ${k + 1} of the demo`);
    out.elements.push(read());
    out.men.push(fc.strength[formation]!);
    out.hashes.push(sim.hash());
    out.shots.push(n);
    out.moving.push(fc.moving[formation] === 1);
    out.engaged.push(fc.engaged[formation] === 1);
  }
  return out;
}

interface Frame {
  m: number;
  shares: [number, number, number];
  /** Where the anchor is on the screen, CSS px. */
  sx: number;
  sy: number;
}
interface LegArgs {
  now: number;
  toM: number | null;
  /** The anchor in cells, and the screen point the zoom holds it at (null at the first stop, where nothing zooms). */
  ax: number;
  ay: number;
  hold: [number, number] | null;
  mapW: number;
  frameMs: number;
  shares: [number, number, number];
  tier: number;
  maxFrames: number;
  deadlineMs: number;
}
interface LegResult {
  now: number;
  frames: Frame[];
  rest: boolean;
  ms: number;
  /** Where the anchor is on the screen at the leg's end. */
  at: [number, number];
  state: { m: number; shares: [number, number, number]; tier: number; elements: number; figures: number; unitsAnimating: boolean; camAnimating: boolean };
}

/**
 * In the page: the camera eases to `toM`, the view's turns are given times `frameMs` apart, and
 * the leg ends with the frame that leaves the view at rest at the stop: the camera there,
 * nothing animating, the stop's layers in full, its subscription answered.
 */
const leg = async (a: LegArgs): Promise<LegResult> => {
  const v = window.__warsim!.view!;
  const c = v.controller;
  const canvas = document.getElementById('map') as HTMLCanvasElement;
  const [vw, vh] = [canvas.clientWidth, canvas.clientHeight];
  const where = (): [number, number] => {
    // The copy of the anchor nearest the view's middle (the map loops).
    let dx = a.ax - c.cam.cx;
    dx -= Math.round(dx / a.mapW) * a.mapW;
    return [vw / 2 + dx * c.cam.scale, vh / 2 + (a.ay - c.cam.cy) * c.cam.scale];
  };
  const toScale = a.toM === null ? null : (v.metresPerPx * c.cam.scale) / a.toM;
  const frames: Frame[] = [];
  const t0 = performance.now();
  let now = a.now;
  let rest: boolean;
  let zooming = toScale !== null;
  for (;;) {
    now += a.frameMs;
    if (zooming) c.zoomTo(toScale!, a.hold ?? where());
    v.frameAt(now);
    const [sx, sy] = where();
    frames.push({ m: v.metresPerPx, shares: [v.shares.markers, v.shares.elements, v.shares.individuals], sx, sy });
    if (zooming && Math.abs(Math.log(c.cam.scale / toScale!)) < 1e-3 && !c.animating) zooming = false;
    const needsElements = a.tier >= 2;
    rest =
      !zooming &&
      !v.unitsAnimating(now) &&
      v.shares.markers === a.shares[0] &&
      v.shares.elements === a.shares[1] &&
      v.shares.individuals === a.shares[2] &&
      v.subscription?.tier === a.tier &&
      (!needsElements || v.elementCount > 0) &&
      (a.tier < 3 || v.individualCount > 0);
    if (rest || frames.length >= a.maxFrames || performance.now() - t0 > a.deadlineMs) break;
    await new Promise((done) => setTimeout(done, 0));
  }
  // The picture of the stop: what the frame of rest started (a capital's flag making way for a
  // counter that has just come to rest, a nation's name fading in) is let run out, a second at a
  // time, so that the picture is the same on every run. The shares do not move: they are recorded.
  for (let k = 0; rest && (k < 2 || (v.unitsAnimating(now) && k < 6)); k++) {
    now += 1000;
    v.frameAt(now);
    v.draw(now);
    frames.push({ m: v.metresPerPx, shares: [v.shares.markers, v.shares.elements, v.shares.individuals], sx: where()[0], sy: where()[1] });
  }
  return {
    now,
    frames,
    rest,
    ms: performance.now() - t0,
    at: where(),
    state: { m: v.metresPerPx, shares: [v.shares.markers, v.shares.elements, v.shares.individuals], tier: v.subscription?.tier ?? -1, elements: v.elementCount, figures: v.individualCount, unitsAnimating: v.unitsAnimating(now), camAnimating: c.animating },
  };
};

interface Seen {
  cam: { cx: number; cy: number; scale: number };
  counters: { nation: number; strength: number; alpha: number; folded: boolean; text: string; d: number }[];
  markers: { id: number; members: number[]; alpha: number; own: number; text: string; d: number }[];
  /** `flags`: the formation's, as the snapshot carried them; `walks`: whether the sprite is drawn walking; `alpha`: the sprite's own opacity. */
  elements: { id: number; formation: number; strength: number; size: number; x: number; y: number; flags: number; walks: boolean; alpha: number }[];
  figures: number;
  /** The element each figure is of, and whether the figure is drawn walking. */
  owners: number[];
  walkers: boolean[];
}

/** In the page: what the frame on the screen has of each unit layer, with distances from the anchor in CSS px. */
const look = (a: { ax: number; ay: number; mapW: number }): Seen => {
  const v = window.__warsim!.view!;
  const cam = v.controller.cam;
  const canvas = document.getElementById('map') as HTMLCanvasElement;
  const [vw, vh] = [canvas.clientWidth, canvas.clientHeight];
  const screen = (wx: number, wy: number): [number, number] => {
    let dx = wx - cam.cx;
    dx -= Math.round(dx / a.mapW) * a.mapW;
    return [vw / 2 + dx * cam.scale, vh / 2 + (wy - cam.cy) * cam.scale];
  };
  const [ax, ay] = screen(a.ax, a.ay);
  const far = (wx: number, wy: number): number => {
    const [x, y] = screen(wx, wy);
    return Math.hypot(x - ax, y - ay);
  };
  return {
    cam: { cx: cam.cx, cy: cam.cy, scale: cam.scale },
    counters: v.counters.drawn.map((d) => ({ nation: d.nation, strength: d.strength, alpha: d.alpha, folded: d.folded, text: d.text, d: far(d.wx, d.wy) })),
    markers: v.markerRects.map((r) => ({ id: r.id, members: [...r.members], alpha: r.alpha, own: r.own, text: r.text, d: Math.hypot(r.x + r.w / 2 - ax, r.y + r.h / 2 - ay) })),
    elements: Array.from(v.elementId, (id, i) => ({ id, formation: v.elementFormation[i]!, strength: v.elementStrength[i]!, size: v.elementSize[i]!, x: v.elementX[i]!, y: v.elementY[i]!, flags: v.elementFlags[i]!, walks: v.elementWalks(i), alpha: v.elementAlpha(i) })),
    figures: v.individualCount,
    owners: Array.from(v.individualOwner.subarray(0, v.individualCount)),
    walkers: Array.from({ length: v.individualCount }, (_, j) => v.individualWalks(j)),
  };
};

interface Volley {
  status: { tick: number; hash: number };
  now: number;
  /** The most of each in a frame of the volley's first part, and the shooters of all its shots. */
  tracers: number;
  flashes: number;
  impacts: number;
  shooters: number[];
  targets: number[];
  span: number;
}

/**
 * In the page: an hour is stepped, and the frames of its fire are drawn up to the moment of the
 * picture, 40% into the volley. The clock moves forward to the snapshot's arrival, never back.
 */
const volley = async (a: { now: number; frameMs: number }): Promise<Volley> => {
  const { sim, view } = window.__warsim!;
  const v = view!;
  // The fire's times are the browser's clock at the snapshot's arrival: the test's clock waits for it.
  while (performance.now() < a.now) await new Promise((done) => setTimeout(done, 5));
  const tick = (await sim.step(1)).tick;
  await new Promise<void>((done) => {
    const wait = (): void => (v.lastTick === tick ? done() : void setTimeout(wait, 5));
    wait();
  });
  const status = await sim.hash();
  const { from, until } = v.fire;
  const at = from + (until - from) * 0.4;
  const most = { tracers: 0, flashes: 0, impacts: 0 };
  for (let t = Math.max(a.now, from); t < at; t += a.frameMs) {
    // The unit layers alone: the map under them is drawn once, for the picture.
    v.drawUnitLayers(t);
    most.tracers = Math.max(most.tracers, v.fire.tracers.length);
    most.flashes = Math.max(most.flashes, v.fire.flashes);
    most.impacts = Math.max(most.impacts, v.fire.impacts);
  }
  // The picture is of one moment of the volley, the same on every run.
  const now = Math.max(a.now, at);
  v.frameAt(now);
  v.draw(now);
  return { status: { tick: status.tick, hash: status.hash }, now, ...most, shooters: v.fire.shots.map((s) => s.shooter), targets: v.fire.shots.map((s) => s.target), span: until - from };
};

/**
 * Of a leg's frames: the largest move of each share from one frame to the next and the largest
 * move back, and whether the zoom ever went out.
 */
function steps(before: [number, number, number], frames: readonly Frame[]): { up: number[]; down: number[]; out: boolean } {
  const up = [0, 0, 0];
  const down = [0, 0, 0];
  let out = false;
  let prev = before;
  let last: Frame | null = null;
  for (const f of frames) {
    for (let i = 0; i < 3; i++) {
      up[i] = Math.max(up[i]!, f.shares[i]! - prev[i]!);
      down[i] = Math.max(down[i]!, prev[i]! - f.shares[i]!);
    }
    if (last && f.m > last.m * (1 + 1e-9)) out = true;
    last = f;
    prev = f.shares;
  }
  return { up, down, out };
}

async function open(page: Page): Promise<void> {
  await page.setViewportSize(VIEW);
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null && window.__warsim!.sim.elevation !== null && window.__warsim!.sim.landMask !== null, null, { timeout: 60_000 });
}

test('one zoom from the whole world to the men of a battle: eight stops, every tier, no layer in a jump', async ({ page }, info) => {
  test.setTimeout(300_000);
  const node = nodeBattle();
  const tag = NATIONS_1938[node.nation - 1]!.tag;
  const start = node.elements[0]!;
  const battalions = start.filter((e) => e.size > 64);
  const batteries = start.filter((e) => e.size <= 16);
  console.log(`the battle: formation ${node.formation} of ${tag} at ${node.x.toFixed(2)}, ${node.y.toFixed(2)}, ${node.men[0]} men in ${start.length} elements; its ${battalions.length} battalions have ${Math.min(...battalions.map((e) => e.strength))} to ${Math.max(...battalions.map((e) => e.strength))} of ${battalions[0]!.size} men, its ${batteries.length} batteries ${batteries.map((e) => e.strength).join(', ')} of ${batteries[0]!.size} guns; shots by or at it in the four hours: ${node.shots.slice(1).join(', ')}`);
  // What the close pictures are there to show: battalions well under strength (and with more
  // than 64 men: under the cap of ADR-69 these drew 64 figures each).
  expect(Math.max(...battalions.map((e) => e.strength / e.size))).toBeLessThan(0.5);
  expect(Math.min(...battalions.map((e) => e.strength))).toBeGreaterThan(64);
  for (const n of node.shots.slice(1)) expect(n).toBeGreaterThan(10);

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/2.10') : info.outputPath();
  mkdirSync(out, { recursive: true });

  await open(page);
  // A month, stepped: the page's world is Node's.
  expect(await page.evaluate(async (n) => {
    const sim = window.__warsim!.sim;
    await sim.step(n);
    const s = await sim.hash();
    return { tick: s.tick, hash: s.hash };
  }, START)).toEqual({ tick: START, hash: node.hashes[0] });

  // The view's own loop stops; the test gives the frames their times. The whole world, the battle's meridian in the middle.
  let now = await page.evaluate(({ ax, ay }) => {
    const v = window.__warsim!.view!;
    v.dispose();
    v.controller.set({ cx: ax, cy: ay, scale: 1e-6 });
    return performance.now();
  }, { ax: node.anchor[0], ay: node.anchor[1] });

  const [ax, ay] = node.anchor;
  let hold: [number, number] | null = null;
  let shares: [number, number, number] = [0, 0, 0];
  let hour = 0;
  /** Sprites drawn walking, over the close stops. */
  let walking = 0;
  for (const [i, stop] of STOPS.entries()) {
    const r: LegResult = await page.evaluate(leg, { now, toM: stop.m, ax, ay, hold, mapW: W, frameMs: FRAME_MS, shares: stop.shares, tier: stop.tier, maxFrames: 600, deadlineMs: 90_000 });
    now = r.now;
    const name = `stop ${i + 1}, ${stop.name}`;
    const s = steps(shares, r.frames);
    const drift = hold ? Math.max(...r.frames.map((f) => Math.hypot(f.sx - hold![0], f.sy - hold![1]))) : 0;
    console.log(`${name}: ${r.state.m.toFixed(r.state.m < 100 ? 1 : 0)} m/px after ${r.frames.length} frames (${(r.ms / 1000).toFixed(1)} s); the shares' largest steps ${s.up.map((u) => u.toFixed(3)).join(', ')}; the battle at ${r.at.map((x) => x.toFixed(0)).join(', ')} on the screen, never more than ${drift.toFixed(2)} px from there; ${r.state.elements} elements, ${r.state.figures} figures`);
    // The leg came to rest at the stop: the camera there, the tier's layers in full, its subscription answered.
    expect(r.state, name).toMatchObject({ shares: stop.shares, tier: stop.tier, unitsAnimating: false, camAnimating: false });
    expect(r.rest, `${name}: at rest`).toBe(true);
    if (stop.m !== null) expect(Math.abs(r.state.m / stop.m - 1), `${name}: m/px`).toBeLessThan(0.002);
    // Seamless: the camera only went in, the battle stayed where it was on the screen, and no
    // layer came or went by more than a fade's step in a frame, nor went back.
    expect(s.out, `${name}: the zoom went out`).toBe(false);
    expect(drift, `${name}: the battle's place on the screen`).toBeLessThan(1);
    for (const [k, layer] of ['markers', 'elements', 'figures'].entries()) {
      expect(s.up[k], `${name}: the largest step of the ${layer}' share`).toBeLessThan(MAX_STEP);
      expect(s.down[k], `${name}: the ${layer}' share going back`).toBe(0);
    }
    shares = stop.shares;
    // Every zoom holds the battle where the world view has it.
    if (i === 0) hold = r.at;

    // The battle fights at the close stops: an hour is stepped and the picture is of its fire.
    let fire: Volley | null = null;
    if (stop.tier >= 2) {
      hour++;
      fire = await page.evaluate(volley, { now, frameMs: FRAME_MS });
      now = fire.now;
      expect(fire.status, `${name}: the page's world after the hour`).toEqual({ tick: START + hour, hash: node.hashes[hour] });
    }
    const seen: Seen = await page.evaluate(look, { ax, ay, mapW: W });
    await page.screenshot({ path: path.join(out, `stop-${i + 1}-${stop.name}.png`) });

    // The battle is in the picture, as the tier shows it.
    const els = node.elements[hour]!;
    if (stop.tier === 0) {
      const own = seen.counters.filter((c) => c.nation === node.nation && c.alpha === 1 && !c.folded).sort((a, b) => a.d - b.d)[0];
      console.log(`  its counter: ${own ? `"${own.text}" (${own.strength} men) ${own.d.toFixed(0)} px from the battle` : 'none'}; ${seen.counters.length} counters in all`);
      expect(own, `${name}: a counter of ${tag}`).toBeDefined();
      expect(own!.d, `${name}: the counter's distance from the battle, px`).toBeLessThan(150);
      expect(own!.strength, `${name}: the counter's men`).toBeGreaterThanOrEqual(node.men[0]!);
    } else if (stop.tier === 1) {
      const own = seen.markers.find((m) => m.members.includes(node.formation));
      console.log(`  its marker: ${own ? `"${own.text}" for ${own.members.length} formation(s), ${own.d.toFixed(0)} px from the battle` : 'none'}; ${seen.markers.length} markers in all`);
      expect(own, `${name}: the marker of formation ${node.formation}`).toBeDefined();
      expect(own!.alpha, `${name}: the marker's opacity`).toBe(1);
      expect(own!.d, `${name}: the marker's distance from the battle, px`).toBeLessThan(60);
    } else {
      // Its elements as the sim has them after the hour, each one; at the closest stop those in the view.
      const cam = seen.cam;
      const inView = (e: El): boolean => Math.abs(e.x - cam.cx) * cam.scale < VIEW.width / 2 && Math.abs(e.y - cam.cy) * cam.scale < VIEW.height / 2;
      const wanted = els.filter(inView);
      const got = new Map(seen.elements.filter((e) => e.formation === node.formation).map((e) => [e.id, e]));
      const figures = wanted.reduce((n, e) => n + figuresOf(e.strength, e.size), 0);
      console.log(`  its elements: ${wanted.length} of ${els.length} in the view (${wanted.filter((e) => e.size > 64).length} battalions, ${wanted.filter((e) => e.size <= 16).length} batteries)${stop.tier === 3 ? `, ${figures} figures theirs of ${seen.figures}` : ''}; the hour's fire: ${fire!.shooters.length} shots in ${fire!.span.toFixed(0)} ms, at most ${fire!.tracers} tracers, ${fire!.flashes} flashes and ${fire!.impacts} impacts in a frame`);
      if (stop.m! >= 12) expect(wanted.length, `${name}: the whole division in the view`).toBe(els.length);
      for (const e of wanted) {
        expect(got.get(e.id), `${name}: element ${e.id}`).toBeDefined();
        expect(got.get(e.id)!.strength, `${name}: the strength of element ${e.id}`).toBe(e.strength);
        expect(Math.hypot(got.get(e.id)!.x - e.x, got.get(e.id)!.y - e.y), `${name}: the place of element ${e.id}`).toBeLessThan(1e-6);
      }
      // It holds where it stands, and is drawn holding (PLAN 2.11e). It has a march and is in
      // contact: the sim moves it nowhere, and its sprites and figures do not walk. Every
      // sprite in the view walks when its formation is on the march, and only then.
      expect({ moving: node.moving[hour], engaged: node.engaged[hour] }, `${name}: the division has a march and is in contact`).toEqual({ moving: true, engaged: true });
      for (const e of seen.elements) expect(e.walks, `${name}: element ${e.id} of formation ${e.formation} (flags ${e.flags}) drawn walking`).toBe((e.flags & 1) !== 0 && (e.flags & 2) === 0);
      expect(seen.elements.filter((e) => e.formation === node.formation && e.walks), `${name}: elements of the division drawn walking`).toEqual([]);
      walking += seen.elements.filter((e) => e.walks).length;
      // And what is left of each element is in its sprite (PLAN 2.11g): its share of its size,
      // for every sprite in the view. The division's battalions, under half their men, are
      // paler than three quarters; and at T2 a stronger formation's sprites are in the same view.
      for (const e of seen.elements) expect(e.alpha, `${name}: the sprite of element ${e.id}, ${e.strength} of ${e.size}`).toBeCloseTo(alphaOf(e.strength, e.size), 5);
      const pale = seen.elements.filter((e) => e.formation === node.formation && e.size > 64).map((e) => e.alpha);
      const strongest = Math.max(...seen.elements.map((e) => e.alpha));
      if (stop.tier === 2) {
        console.log(`  the sprites' opacity: the division's battalions ${Math.min(...pale).toFixed(2)} to ${Math.max(...pale).toFixed(2)}; the strongest sprite in the view ${strongest.toFixed(2)}`);
        expect(Math.max(...pale), `${name}: the division's battalions' sprites`).toBeLessThan(0.75);
        expect(strongest, `${name}: the strongest sprite in the view`).toBeGreaterThan(Math.max(...pale) + 0.15);
      }
      if (stop.tier === 3) {
        const of = new Set(els.map((e) => e.id));
        expect(seen.owners.filter((o, j) => of.has(o) && seen.walkers[j]).length, `${name}: figures of the division drawn walking`).toBe(0);
      }
      // Both kinds are in the two closest pictures: battalions under strength, and batteries.
      expect(wanted.filter((e) => e.size > 64).length, `${name}: battalions in the view`).toBeGreaterThanOrEqual(2);
      expect(wanted.filter((e) => e.size <= 16).length, `${name}: batteries in the view`).toBeGreaterThanOrEqual(1);
      if (stop.tier === 3) {
        // Its figures are its losses: each element the view holds has its share of them, in the
        // view or beside it, and a battalion under half its men (as these are) has at most 32.
        const drawn = new Map<number, number>();
        for (const o of seen.owners) drawn.set(o, (drawn.get(o) ?? 0) + 1);
        for (const e of els) if (got.has(e.id)) expect(drawn.get(e.id) ?? 0, `${name}: the figures of element ${e.id}, ${e.strength} of ${e.size}`).toBe(figuresOf(e.strength, e.size));
        expect(seen.figures, `${name}: figures`).toBeGreaterThanOrEqual(figures);
        expect(Math.max(...wanted.filter((e) => e.size > 64).map((e) => drawn.get(e.id) ?? 0)), `${name}: the most figures of a battalion in the view`).toBeLessThanOrEqual(32);
      } else expect(seen.figures, `${name}: figures at T2`).toBe(0);
      // And it fights: the hour's shots by or at its elements are the view's, and they are being
      // drawn. (A view gets the shots with an end in the box it subscribed to: all of them while
      // the whole division is in it, a part at the closest stop. `fire1938` has that to the shot.)
      const own = new Set(node.elements[0]!.map((e) => e.id));
      const theirs = fire!.shooters.filter((sh, k) => own.has(sh) || own.has(fire!.targets[k]!)).length;
      if (stop.m! >= 12) expect(theirs, `${name}: the shots of the hour by or at the division`).toBe(node.shots[hour]);
      else {
        expect(theirs, `${name}: shots by or at the division's elements in the view`).toBeGreaterThan(10);
        expect(theirs).toBeLessThanOrEqual(node.shots[hour]!);
      }
      expect(fire!.tracers, `${name}: tracers in a frame`).toBeGreaterThan(0);
      expect(fire!.flashes + fire!.impacts, `${name}: flashes and impacts in a frame`).toBeGreaterThan(0);
    }
  }
  expect(hour).toBe(CLOSE);
  // And the rule is not "nothing walks": formations on the march were in the views, walking.
  console.log(`sprites drawn walking over the ${CLOSE} close stops: ${walking}`);
  expect(walking).toBeGreaterThan(0);
});
