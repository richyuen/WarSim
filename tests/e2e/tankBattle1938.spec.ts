import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { FLAME_MS } from '../../src/render/fx/hulls';
import { figureCells } from '../../src/render/units/individuals';
import { Frame } from '../../src/shared/unitLooks';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { inView, STEPPED, tankBattle, VIEW } from '../helpers/tankBattle';
import { leg, steps, type LegResult } from './flight';

// PLAN 3.6e4, the AT of PLAN 3.6: the tank battle demo. One flight of the camera from T1 down to
// 1.5 m/px on a division of tanks of the 1938 scenario's own that fights, and what PLAN 3.6 has
// given a tank is seen on the way, each thing at the stop where it is to be read:
//   1500 m/px (T1)  the division's marker;
//   100 m/px (T2)   its tanks as the small mark (PLAN 3.6e3b);
//   60 m/px (T2)    hulls and turrets; an hour is stepped, and the turrets of the tanks that fire
//                   are on their targets, off their hulls (3.6b);
//   12 m/px (T3)    its tanks one by one; an hour is stepped, and each tank of an element that
//                   fires has its turret where its element's is;
//   4 m/px (T3)     an hour is stepped: a cannon's flash at a tank's muzzle (3.6c, 3.6e1), a
//                   hull that burns where a tank was lost under fire and one left behind where
//                   nothing fired (3.6d), in one view; the time of a frame with them;
//   1.5 m/px (T3)   an hour is stepped: the tank in the middle of the view is lost under fire,
//                   and its hull burns, near.
//
// The ground is found by a run of the same sim in Node (`tankBattle`): the worker runs the same
// sim (I4), and the page's hash is Node's after every hour. The clock is the test's, as in
// `zoomDemo1938.spec.ts` (`flight.ts`): a slow machine makes the test longer and changes nothing
// a frame sees. The three specs of the parts (`turrets1938`, `muzzles1938`, `burning1938`) test
// each thing to the figure; this one tests that they are all there in one battle and one zoom.

const { w: W } = SIZE_1938;
// The seed is the demo's own. That of the scenario's year had such a ground on day 37 until
// PLAN 3.7j moved the world's paths; since then no tank of its first 400 days is lost without
// fire in the view of one lost under fire (PLAN 3.7o). The search's rule is as it was.
const SEED = 2;
const FIRST_DAY = 14;
const LAST_DAY = 120;
/** Elements of tanks that fire in the view of the first stepped stop. */
const SHOOTERS = 10;
const FRAME_MS = 16;
/** The most a share moves in a frame of 16 ms (as `zoomDemo1938`). */
const MAX_STEP = 0.12;
const HULLS: readonly number[] = [Frame.tank, Frame.tankMedium, Frame.tankHeavy];

interface Stop {
  name: string;
  m: number;
  tier: number;
  shares: [number, number, number];
}
const STOPS: Stop[] = [
  { name: 'marker', m: 1500, tier: 1, shares: [1, 0, 0] },
  { name: 'marks', m: 100, tier: 2, shares: [1, 1, 0] },
  { name: 'turrets', m: STEPPED[0], tier: 2, shares: [1, 1, 0] },
  { name: 'tanks', m: STEPPED[1], tier: 3, shares: [1, 1, 1] },
  { name: 'fire', m: STEPPED[2], tier: 3, shares: [1, 1, 1] },
  { name: 'hull', m: STEPPED[3], tier: 3, shares: [1, 1, 1] },
];

/** The angle from `a` to `b`, in (−π, π]. */
const off = (a: number, b: number): number => Math.atan2(Math.sin(b - a), Math.cos(b - a));

interface El {
  id: number;
  formation: number;
  strength: number;
  frame: number;
  smallFrame: number;
  /** CSS px on the screen. */
  sx: number;
  sy: number;
}
interface Seen {
  elements: El[];
  px: number;
  small: number;
  markers: { members: number[]; alpha: number; text: string }[];
  /** The tags of T2 and T3: the formation, its text and its box, CSS px. */
  tags: { id: number; text: string; x: number; y: number; w: number; h: number }[];
  tagsLeft: number;
}

/** In the page: what the frame on the screen has of the unit layers. */
const look = (a: { mapW: number }): Seen => {
  const v = window.__warsim!.view!;
  const cam = v.controller.cam;
  const canvas = document.getElementById('map') as HTMLCanvasElement;
  const [vw, vh] = [canvas.clientWidth, canvas.clientHeight];
  const screen = (wx: number, wy: number): [number, number] => {
    let dx = wx - cam.cx;
    dx -= Math.round(dx / a.mapW) * a.mapW;
    return [vw / 2 + dx * cam.scale, vh / 2 + (wy - cam.cy) * cam.scale];
  };
  return {
    elements: Array.from(v.elementId, (id, i) => {
      const [sx, sy] = screen(v.elementX[i]!, v.elementY[i]!);
      return { id, formation: v.elementFormation[i]!, strength: v.elementStrength[i]!, frame: v.elementFrame(i), smallFrame: v.elementSmallFrame(i), sx, sy };
    }),
    px: v.elementPx,
    small: v.elementSmall,
    markers: v.markerRects.map((r) => ({ members: [...r.members], alpha: r.alpha, text: r.text })),
    tags: v.tagRects.map((g) => ({ id: g.id, text: g.text, x: g.x, y: g.y, w: g.w, h: g.h })),
    tagsLeft: v.tagsLeft,
  };
};

interface Fought {
  status: { tick: number; hash: number };
  /** The elements of tanks the view held before the hour and after it: their tanks. */
  before: [number, number][];
  after: [number, number][];
  shots: { shooter: number; target: number; start: number; x0: number; y0: number; x1: number; y1: number }[];
  from: number;
  until: number;
  skipped: number;
  /** The hulls the hour brought. */
  fresh: { element: number; figure: number; x: number; y: number; burns: boolean; born: number }[];
  dropped: number;
}

/** In the page: an hour is stepped, once the browser's clock has caught up with the test's. */
const fight = async (a: { now: number; tick: number; hulls: readonly number[] }): Promise<Fought> => {
  const { sim, view } = window.__warsim!;
  const v = view!;
  // The fire's and the hulls' times are the browser's clock at the snapshot's arrival: the test's clock waits for it.
  while (performance.now() < a.now) await new Promise((done) => setTimeout(done, 5));
  const tanks = (): [number, number][] => Array.from(v.elementId, (id, i) => [id, v.elementStrength[i]!, v.elementFrame(i)] as const).filter((e) => a.hulls.includes(e[2])).map((e) => [e[0], e[1]]);
  const before = tanks();
  const had = new Set(v.hulls.hulls);
  await sim.step(1);
  await new Promise<void>((done) => {
    const wait = (): void => (v.lastTick === a.tick ? done() : void setTimeout(wait, 5));
    wait();
  });
  const status = await sim.hash();
  return {
    status: { tick: status.tick, hash: status.hash },
    before,
    after: tanks(),
    shots: v.fire.shots.map((s) => ({ shooter: s.shooter, target: s.target, start: s.start, x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1 })),
    from: v.fire.from,
    until: v.fire.until,
    skipped: v.fire.skipped,
    fresh: v.hulls.hulls.filter((h) => !had.has(h)).map((h) => ({ element: h.element, figure: h.figure, x: h.x, y: h.y, burns: h.burns, born: h.born })),
    dropped: v.firesDropped,
  };
};

test('the tank battle: one zoom from a marker to a burning hull, with turrets on their targets and a flash at a muzzle on the way', async ({ page }, info) => {
  test.setTimeout(420_000);
  const node = tankBattle(SEED, FIRST_DAY, LAST_DAY, SHOOTERS);
  const tag = NATIONS_1938[node.nation - 1]!.tag;
  const [ax, ay] = node.anchor;
  console.log(`the battle: formation ${node.formation} of ${tag} at ${ax.toFixed(2)}, ${ay.toFixed(2)}, day ${(node.start / 24).toFixed(1)}; armour's shots in the four hours: ${node.hours.map((h) => h.shots.length).join(', ')}; in the third, within the view at ${STEPPED[2]} m/px, ${node.burning.length} elements lose a tank under fire and ${node.left.length} without`);

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/3.6') : info.outputPath();
  mkdirSync(out, { recursive: true });

  await page.setViewportSize(VIEW);
  await page.goto(`/?scenario=1938&paused=1&seed=${SEED}`);
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null && window.__warsim!.sim.elevation !== null && window.__warsim!.sim.landMask !== null, null, { timeout: 60_000 });
  expect(await page.evaluate(async (n) => {
    const sim = window.__warsim!.sim;
    await sim.step(n);
    const s = await sim.hash();
    return { tick: s.tick, hash: s.hash };
  }, node.start)).toEqual({ tick: node.start, hash: node.hashes[0] });

  // The view's own loop stops; the test gives the frames their times. The flight starts at T1, the battle in the middle.
  let now = await page.evaluate(({ ax, ay, m }) => {
    const v = window.__warsim!.view!;
    v.dispose();
    v.controller.set({ cx: ax, cy: ay, scale: (v.metresPerPx * v.controller.cam.scale) / m });
    return performance.now();
  }, { ax, ay, m: STOPS[0]!.m });

  const inViewport = (p: { sx: number; sy: number }): boolean => p.sx >= 0 && p.sx < VIEW.width && p.sy >= 0 && p.sy < VIEW.height;
  let hold: [number, number] | null = null;
  let shares: [number, number, number] = [0, 0, 0];
  let hour = 0;
  for (const [i, stop] of STOPS.entries()) {
    const name = `stop ${i + 1}, ${stop.name}`;
    const r: LegResult = await page.evaluate(leg, { now, toM: i === 0 ? null : stop.m, ax, ay, hold, mapW: W, frameMs: FRAME_MS, shares: stop.shares, tier: stop.tier, maxFrames: 600, deadlineMs: 90_000 });
    now = r.now;
    expect(r.state, name).toMatchObject({ shares: stop.shares, tier: stop.tier, unitsAnimating: false, camAnimating: false });
    expect(r.rest, `${name}: at rest`).toBe(true);
    expect(Math.abs(r.state.m / stop.m - 1), `${name}: m/px`).toBeLessThan(0.002);
    if (i === 0) hold = r.at;
    else {
      // Seamless, as the zoom demo's flight: the camera only went in, the battle stayed where it
      // was on the screen, and no layer came or went by more than a fade's step, nor went back.
      const s = steps(shares, r.frames);
      const drift = Math.max(...r.frames.map((f) => Math.hypot(f.sx - hold![0], f.sy - hold![1])));
      console.log(`${name}: ${r.state.m.toFixed(1)} m/px after ${r.frames.length} frames (${(r.ms / 1000).toFixed(1)} s); the shares' largest steps ${s.up.map((u) => u.toFixed(3)).join(', ')}; ${r.state.elements} elements, ${r.state.figures} figures`);
      expect(s.out, `${name}: the zoom went out`).toBe(false);
      expect(drift, `${name}: the battle's place on the screen`).toBeLessThan(1);
      for (const [k, layer] of ['markers', 'elements', 'figures'].entries()) {
        expect(s.up[k], `${name}: the largest step of the ${layer}' share`).toBeLessThan(MAX_STEP);
        expect(s.down[k], `${name}: the ${layer}' share going back`).toBe(0);
      }
    }
    shares = stop.shares;
    const shot = (file: string): Promise<Buffer> => page.screenshot({ path: path.join(out, `tank-battle-${i + 1}-${file}.png`) });

    let fought: Fought | null = null;
    if ((STEPPED as readonly number[]).includes(stop.m)) {
      hour++;
      fought = await page.evaluate(fight, { now, tick: node.start + hour, hulls: HULLS });
      expect(fought.status, `${name}: the page's world after the hour`).toEqual({ tick: node.start + hour, hash: node.hashes[hour] });
      expect(fought.skipped).toBe(0);
      expect(fought.dropped).toBe(0);
      // The tanks the view held are the sim's, before the hour and after it.
      const sim = node.hours[hour - 1]!.tanks;
      const after = new Map(fought.after);
      expect(fought.before.length, `${name}: elements of tanks held`).toBeGreaterThanOrEqual(SHOOTERS);
      for (const [id, n] of fought.before) {
        expect(sim.get(id)?.[0], `${name}: the tanks of element ${id} before the hour`).toBe(n);
        if (after.has(id)) expect(sim.get(id)![1], `${name}: the tanks of element ${id} after the hour`).toBe(after.get(id));
      }
      // The hulls (T3): one for every tank lost by an element the view held and holds, burning where the sim had it fired at.
      const lost = stop.tier < 3 ? [] : fought.before.filter(([id]) => after.has(id)).flatMap(([id]) => Array.from({ length: sim.get(id)![0] - sim.get(id)![1] }, () => id));
      expect(fought.fresh.map((h) => h.element).sort(), `${name}: a hull for each tank lost`).toEqual(lost.sort());
      // Every one of them, in the viewport or not: the view holds the whole of a formation that
      // reaches into the box it subscribed to and gets only the shots with an end in that box,
      // and the snapshot says of each element whether it was fired at (PLAN 3.6e5).
      for (const h of fought.fresh) expect(h.burns, `${name}: the hull of element ${h.element} burns`).toBe(sim.get(h.element)![2]);
      const beside = fought.fresh.filter((h) => !inView(h.x, h.y, node.anchor, stop.m));
      if (fought.fresh.length > 0) console.log(`${name}: ${fought.fresh.length} hull(s), ${fought.fresh.filter((h) => h.burns).length} burning; outside the viewport ${beside.length}, ${beside.filter((h) => h.burns).length} burning`);
    }
    const seen: Seen = await page.evaluate(look, { mapW: W });
    const own = seen.elements.filter((e) => e.formation === node.formation && HULLS.includes(e.frame));

    if (stop.tier === 1) {
      const marker = seen.markers.find((m) => m.members.includes(node.formation));
      console.log(`${name}: its marker ${marker ? `"${marker.text}" for ${marker.members.length} formation(s)` : 'none'}; ${seen.markers.length} markers in all`);
      expect(marker, `${name}: the marker of formation ${node.formation}`).toBeDefined();
      expect(marker!.alpha).toBe(1);
      await shot(stop.name);
      continue;
    }
    expect(own.length, `${name}: the division's elements of tanks held`).toBeGreaterThanOrEqual(SHOOTERS);

    if (stop.tier === 2) {
      // PLAN 3.6e3 asked what was seen: whether the tanks that fight are under a tag.
      const under = (e: El, mine: boolean): boolean => seen.tags.some((g) => (g.id === node.formation) === mine && e.sx >= g.x && e.sx <= g.x + g.w && e.sy >= g.y && e.sy <= g.y + g.h);
      const mine = seen.tags.find((g) => g.id === node.formation);
      console.log(`${name}: ${own.length} elements of tanks of the division (${own.filter(inViewport).length} in the viewport), a sprite ${seen.px.toFixed(1)} px, the small share ${seen.small.toFixed(2)}; its tag ${mine ? `"${mine.text}"` : 'not placed'}; under its own tag ${own.filter((e) => under(e, true)).length}, under another formation's ${own.filter((e) => under(e, false)).length}; ${seen.tags.length} tags, ${seen.tagsLeft} without a place`);
      expect(own.filter(inViewport).length, `${name}: the division's tanks in the viewport`).toBe(own.length);
    }
    if (stop.name === 'marks') {
      // A sprite of 5.5 px or less (5.1 here): every tank the mark, and nothing else (PLAN 3.6e3b).
      expect(seen.px).toBeLessThanOrEqual(5.5);
      expect(seen.small).toBe(1);
      for (const e of seen.elements) expect(e.smallFrame, `${name}: element ${e.id}, frame ${e.frame}`).toBe(HULLS.includes(e.frame) ? Frame.tankSmall : e.frame);
      await shot(stop.name);
    }
    if (stop.name === 'turrets') {
      // Hulls and turrets, and the turrets of the tanks that fired on their targets as the last shot leaves.
      expect(seen.small).toBe(0);
      const fired = Math.max(...fought!.shots.map((s) => s.start));
      const turrets = await page.evaluate((t) => {
        const v = window.__warsim!.view!;
        v.draw(t);
        return Array.from({ length: v.elementTurrets }, (_, k) => {
          const e = v.elementTurretOwner[k]!;
          return { id: v.elementId[e]!, hull: v.elementFacing(e), turret: v.elementTurretFacing(k) };
        });
      }, fired);
      now = Math.max(now, fired);
      const shotOf = new Map(fought!.shots.map((s) => [s.shooter, s]));
      const shooters = new Set(node.hours[hour - 1]!.shots.map((s) => s.shooter));
      const firing = turrets.filter((t) => shooters.has(t.id));
      let turned = 0;
      for (const t of turrets) {
        if (!shooters.has(t.id)) {
          expect(t.turret, `${name}: the turret of ${t.id}, silent`).toBe(t.hull);
          continue;
        }
        const s = shotOf.get(t.id);
        expect(s, `${name}: the shot of ${t.id}`).toBeDefined();
        expect(Math.abs(off(t.turret, Math.atan2(s!.y1 - s!.y0, s!.x1 - s!.x0))), `${name}: the turret of ${t.id} off its target's line`).toBeLessThan(1e-5);
        if (Math.abs(off(t.hull, t.turret)) > 0.02) turned++;
      }
      console.log(`${name}: ${turrets.length} turrets, ${firing.length} of tanks that fired, ${turned} of them more than 0.02 rad off the hull`);
      expect(firing.length, `${name}: tanks that fired`).toBeGreaterThanOrEqual(SHOOTERS);
      expect(turned, `${name}: turrets off their hulls`).toBeGreaterThan(firing.length / 2);
      await shot(stop.name);
    }
    if (stop.name === 'tanks') {
      // The tanks one by one: a figure for each tank, and each tank's turret where its element's is.
      const fired = Math.max(...fought!.shots.map((s) => s.start));
      const close = await page.evaluate((t) => {
        const v = window.__warsim!.view!;
        v.draw(t);
        const figures = new Map<number, number>();
        for (let j = 0; j < v.individualCount; j++) figures.set(v.individualOwner[j]!, (figures.get(v.individualOwner[j]!) ?? 0) + 1);
        const hullOf = new Map<number, number>();
        for (let i = 0; i < v.elementCount; i++) hullOf.set(v.elementId[i]!, v.elementFacing(i));
        return {
          figures: [...figures],
          turrets: Array.from({ length: v.individualTurrets }, (_, k) => ({ id: v.individualOwner[v.individualTurretOwner[k]!]!, turret: v.individualTurretFacing(k), hull: hullOf.get(v.individualOwner[v.individualTurretOwner[k]!]!)! })),
        };
      }, fired);
      now = Math.max(now, fired);
      const figures = new Map(close.figures);
      for (const e of own) expect(figures.get(e.id) ?? 0, `${name}: the figures of element ${e.id}, ${e.strength} tanks`).toBe(e.strength);
      const shotOf = new Map(fought!.shots.map((s) => [s.shooter, s]));
      const shooters = new Set(node.hours[hour - 1]!.shots.map((s) => s.shooter));
      let turned = 0;
      let onTarget = 0;
      for (const t of close.turrets) {
        if (!shooters.has(t.id)) {
          expect(t.turret, `${name}: the turret of a tank of ${t.id}, silent`).toBe(t.hull);
          continue;
        }
        const s = shotOf.get(t.id)!;
        expect(Math.abs(off(t.turret, Math.atan2(s.y1 - s.y0, s.x1 - s.x0))), `${name}: the turret of a tank of ${t.id} off its target's line`).toBeLessThan(1e-5);
        onTarget++;
        if (Math.abs(off(t.hull, t.turret)) > 0.02) turned++;
      }
      console.log(`${name}: ${own.reduce((n, e) => n + e.strength, 0)} tanks of the division's ${own.length} elements, a figure each; ${close.turrets.length} turrets in the view's box, ${onTarget} of tanks whose element fired on the target's line, ${turned} of them more than 0.02 rad off the hull`);
      expect(turned, `${name}: tanks with the turret off the hull`).toBeGreaterThan(10);
      await shot(stop.name);
    }
    if (stop.name === 'fire') {
      const shooters = new Set(node.hours[hour - 1]!.shots.map((s) => s.shooter));
      const born = fought!.fresh[0]!.born;
      // What the frames of the hour's fire have: a flash at a tank's muzzle for each shot of armour
      // in the viewport, and the hulls with their flames. The frames are drawn in the shots' order.
      const got = await page.evaluate(({ shooters, born, mapW }) => {
        const v = window.__warsim!.view!;
        const cam = v.controller.cam;
        const canvas = document.getElementById('map') as HTMLCanvasElement;
        const [vw, vh] = [canvas.clientWidth, canvas.clientHeight];
        const inside = (wx: number, wy: number): boolean => {
          let dx = wx - cam.cx;
          dx -= Math.round(dx / mapW) * mapW;
          return Math.abs(dx) * cam.scale < vw / 2 && Math.abs(wy - cam.cy) * cam.scale < vh / 2;
        };
        const tanks = new Set(shooters);
        const flashes = v.fire.shots.filter((s) => tanks.has(s.shooter)).sort((a, b) => a.start - b.start).map((s) => {
          v.draw(s.start + 1);
          const f = v.fire.flashAt.find((f) => f.shot === s);
          // How far the flash is from the nearest figure of its shooter in this frame, in cells.
          let reach = Infinity;
          if (f && s.from) for (let j = 0; j < v.individualCount; j++) if (v.individualOwner[j] === s.shooter) reach = Math.min(reach, Math.hypot(v.individualX[j]! - f.x, v.individualY[j]! - f.y));
          return { shooter: s.shooter, start: s.start, flashed: f !== undefined, inView: inside(s.x0, s.y0), held: s.from !== null, reach, side: s.from ? s.from.side : 0, scale: cam.scale };
        });
        // The hulls a tenth of a second after they were made, and the time of a frame with them, flames
        // on: the script's part, as `individuals1938` takes it (the test's browser draws on the CPU).
        const at = born + 100;
        v.draw(at);
        const t0 = performance.now();
        for (let k = 0; k < 10; k++) v.draw(at);
        const drawMs = (performance.now() - t0) / 10;
        return {
          flashes,
          drawMs,
          flames: v.hulls.flames,
          held: v.hulls.hulls.length,
          shown: v.hulls.shown.map((h) => ({ element: h.element, figure: h.figure, burns: h.burns, born: h.born, inView: inside(h.x, h.y) })),
          figures: v.individualCount,
          elements: v.elementCount,
          tracers: v.fire.tracers.length,
        };
      }, { shooters: [...shooters], born, mapW: W });
      const drawn = got.flashes.filter((f) => f.flashed && f.held);
      for (const f of drawn) {
        // A figure is drawn at its size in cells here, and no barrel is longer than half a figure.
        const side = figureCells(f.side);
        expect(side * f.scale, `${name}: a tank of ${f.shooter}, px`).toBeGreaterThan(2.5);
        expect(f.reach / side, `${name}: the flash of ${f.shooter} from its nearest tank, figures`).toBeLessThanOrEqual(0.5);
        expect(f.reach / side, `${name}: the flash of ${f.shooter}, not at the middle of a hull`).toBeGreaterThan(0.3);
      }
      // (A shot without a flash is of a tank whose muzzle is outside the viewport: `muzzles1938` has that to the shot.)
      expect(drawn.length, `${name}: flashes at a tank's muzzle`).toBeGreaterThanOrEqual(3);
      const fresh = got.shown.filter((h) => h.born === born);
      const burning = fresh.filter((h) => h.burns && h.inView);
      const left = fresh.filter((h) => !h.burns && h.inView);
      console.log(`${name}: ${got.flashes.length} shots of armour in the view's box (${got.flashes.filter((f) => f.inView).length} of shooters in the viewport), ${drawn.length} with a flash at a tank's muzzle; ${fought!.fresh.length} hulls for as many tanks lost (${fought!.fresh.filter((h) => h.burns).length} under fire), in the viewport ${burning.length} burning and ${left.length} left behind; ${got.flames} flames; a frame with ${got.shown.length} hulls drawn of ${got.held} held, ${got.figures} figures of ${got.elements} elements: ${got.drawMs.toFixed(2)} ms of script`);
      // Both kinds in one view, as the sim has them on this ground.
      expect(burning.length, `${name}: hulls burning in the viewport`).toBeGreaterThanOrEqual(1);
      expect(left.length, `${name}: hulls left behind in the viewport`).toBeGreaterThanOrEqual(1);
      expect(got.flames, `${name}: a flame for each hull lost under fire no longer ago than a flame lasts`).toBe(got.shown.filter((h) => h.burns && born + 100 - h.born < FLAME_MS).length);
      // The script's part of a frame at T3 is about a millisecond; half of a frame at 30 fps leaves room for a loaded machine.
      expect(got.drawMs, `${name}: the script's time of a frame with hulls, ms`).toBeLessThan(16);
      // The picture: as the shot of the tank nearest the battle's middle is on its way, the hulls burning.
      const mid = drawn.reduce((a, b) => (a.start <= b.start ? a : b));
      const picture = await page.evaluate((t) => {
        const v = window.__warsim!.view!;
        v.draw(t);
        return { flames: v.hulls.flames, flashes: v.fire.flashAt.length, tracers: v.fire.tracers.length };
      }, Math.max(mid.start + 30, born + 100));
      expect(picture.flames, `${name}: flames in the picture`).toBeGreaterThanOrEqual(1);
      expect(picture.flashes + picture.tracers, `${name}: fire in the picture`).toBeGreaterThanOrEqual(1);
      now = Math.max(now, ...got.flashes.map((f) => f.start + 1), mid.start + 30, born + 100);
      await shot(stop.name);
    }
    if (stop.name === 'hull') {
      // Near: the tank the camera is on is lost under fire in this hour, and burns a second and a half after.
      const mine = fought!.fresh.filter((h) => h.element === node.element);
      expect(mine.length, `${name}: the hull of element ${node.element}`).toBe(1);
      expect(mine[0]!.burns).toBe(true);
      const near = await page.evaluate(({ at, mapW }) => {
        const v = window.__warsim!.view!;
        const cam = v.controller.cam;
        const canvas = document.getElementById('map') as HTMLCanvasElement;
        v.draw(at);
        const inside = (wx: number, wy: number): boolean => {
          let dx = wx - cam.cx;
          dx -= Math.round(dx / mapW) * mapW;
          return Math.abs(dx) * cam.scale < canvas.clientWidth / 2 && Math.abs(wy - cam.cy) * cam.scale < canvas.clientHeight / 2;
        };
        return { flames: v.hulls.flames, shown: v.hulls.shown.filter((h) => inside(h.x, h.y)).map((h) => ({ element: h.element, burns: h.burns, age: at - h.born })), figures: v.individualCount, tracers: v.fire.tracers.length };
      }, { at: mine[0]!.born + 1500, mapW: W });
      now = Math.max(now, mine[0]!.born + 1500);
      const alight = near.shown.filter((h) => h.burns && h.age < FLAME_MS);
      console.log(`${name}: ${fought!.fresh.length} hulls of the hour, ${near.shown.length} hulls in the viewport, ${alight.length} of them alight; ${near.flames} flames, ${near.tracers} tracers; ${near.figures} figures`);
      expect(near.shown.some((h) => h.element === node.element && h.burns && h.age === 1500), `${name}: the hull of element ${node.element} in the viewport`).toBe(true);
      expect(alight.length, `${name}: hulls alight in the viewport`).toBeGreaterThanOrEqual(1);
      expect(near.flames).toBeGreaterThanOrEqual(alight.length);
      await shot(stop.name);
    }
  }
  expect(hour).toBe(STEPPED.length);
});
