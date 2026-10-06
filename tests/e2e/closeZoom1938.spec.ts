import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import type { Command } from '../../src/shared/commands';
import { SCENARIO_GEOMETRY } from '../../src/shared/scenarios';
import { NATIONS_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';

// PLAN 2.7n (ADR-74, second read, finding 1): the closest zooms, as a picture.
//
// At 1 m/px a view is smaller than a division. Three things were wrong there:
// - the worker sent a division's elements only when its centre was in the view's box (2.7n1);
// - the view asked the worker again only when its box had moved by a quarter cell, which is two
//   and a half screens (2.7n2);
// - with no elements in the snapshot every formation is drawn as a stand-in sprite 0.9 cells
//   wide: 17,611 px at 1 m/px. A division three kilometres away covered the view in its
//   nation's tint (2.7n3).
//
// What is read here is the sprite layers alone, drawn on cleared canvases: which pixels are lit.

const VW = 1280;
const VH = 720;
const SITE = [1578.5, 338.8] as const; // western China, far from every other formation
const KM = SCENARIO_GEOMETRY['1938'].kmPerCell;
const nation = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const JAP = nation('JAP');
const SETUP: Command[] = [
  { kind: 'setAi', nation: JAP, enabled: false },
  { kind: 'spawnFormation', nation: JAP, x: SITE[0], y: SITE[1], strength: 0, template: TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div') },
];
/** A stand-in is a square of at most this many px; turned by its formation's facing it spans up to √2 of it. */
const STAND_IN_MAX_PX = 48;

interface Seen {
  /** Px of the sprite layers that are lit, the box they lie in, and the px of the view. */
  lit: number;
  w: number;
  h: number;
  total: number;
  /** The larger side of the box of the lit px that hang together with the one at the view's centre (0: it is dark). */
  centre: number;
  elements: number;
  figures: number;
  figuresShare: number;
  /** Where the elements in hand stand, in cells. */
  at: [number, number][];
}

/**
 * Puts the camera at (`cx`, `cy`) at `mPerPx` and waits for the snapshot that answers the view's
 * new subscription; draws until nothing animates; then draws the sprite layers alone and reads
 * them. (The camera must not be where it was: a view that has not moved asks nothing.)
 */
function look(page: Page, cx: number, cy: number, mPerPx: number): Promise<Seen> {
  return page.evaluate(async ({ cx, cy, m }) => {
    const v = window.__warsim!.view!;
    const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
    const scale = (v.metresPerPx * v.controller.cam.scale) / m;
    const before = v.snapshots;
    v.controller.set({ cx, cy, scale });
    // The view's own loop subscribes, at most 10 times a second; the worker answers.
    for (const t0 = performance.now(); ; await sleep(10)) {
      const b = v.subscription?.bbox;
      const mine = b !== undefined && Math.abs((b[0] + b[2]) / 2 - cx) < 1e-9 && Math.abs((b[1] + b[3]) / 2 - cy) < 1e-9 && Math.abs((b[2] - b[0]) * scale - window.innerWidth * 1.25) < 1;
      if (mine && v.snapshots > before) break;
      if (performance.now() - t0 > 10_000) throw new Error(`no snapshot for the view at ${cx}, ${cy}, ${m} m/px`);
    }
    for (const t0 = performance.now(); ; await sleep(25)) {
      // At the frame's own time (PLAN 2.16Rj, `settle.ts`).
      const now = performance.now();
      v.draw(now);
      if (!v.unitsAnimating(now)) break;
      if (performance.now() - t0 > 10_000) throw new Error('the view did not come to rest');
    }
    // The sprite layers alone, on cleared canvases, composited on black.
    v.drawUnitLayers(performance.now(), true);
    const gl = document.querySelector('canvas')!;
    const overlay = document.querySelector<HTMLCanvasElement>('canvas.map-nations')!;
    const scratch = document.createElement('canvas');
    scratch.width = gl.width;
    scratch.height = gl.height;
    const ctx = scratch.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, gl.width, gl.height);
    ctx.drawImage(gl, 0, 0);
    ctx.drawImage(overlay, 0, 0, gl.width, gl.height);
    const px = ctx.getImageData(0, 0, gl.width, gl.height).data;
    let lit = 0;
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (let y = 0; y < gl.height; y++)
      for (let x = 0; x < gl.width; x++) {
        const i = (y * gl.width + x) * 4;
        if (px[i]! + px[i + 1]! + px[i + 2]! <= 24) continue;
        lit++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    // What is lit at the view's centre, and all that hangs together with it.
    const isLit = (x: number, y: number): boolean => {
      const i = (y * gl.width + x) * 4;
      return px[i]! + px[i + 1]! + px[i + 2]! > 24;
    };
    let centre = 0;
    const [mx, my] = [gl.width >> 1, gl.height >> 1];
    if (isLit(mx, my)) {
      const seen = new Uint8Array(gl.width * gl.height);
      const todo = [my * gl.width + mx];
      seen[todo[0]!] = 1;
      let [bx0, by0, bx1, by1] = [mx, my, mx, my];
      while (todo.length > 0) {
        const p = todo.pop()!;
        const [x, y] = [p % gl.width, Math.floor(p / gl.width)];
        if (x < bx0) bx0 = x;
        if (x > bx1) bx1 = x;
        if (y < by0) by0 = y;
        if (y > by1) by1 = y;
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const) {
          if (nx < 0 || ny < 0 || nx >= gl.width || ny >= gl.height) continue;
          const q = ny * gl.width + nx;
          if (seen[q] === 1 || !isLit(nx, ny)) continue;
          seen[q] = 1;
          todo.push(q);
        }
      }
      centre = Math.max(bx1 - bx0, by1 - by0) + 1;
    }
    const at: [number, number][] = [];
    for (let i = 0; i < v.elementCount; i++) at.push([v.elementX[i]!, v.elementY[i]!]);
    return { lit, w: lit ? x1 - x0 + 1 : 0, h: lit ? y1 - y0 + 1 : 0, total: gl.width * gl.height, centre, elements: v.elementCount, figures: v.individualCount, figuresShare: v.shares.individuals, at };
  }, { cx, cy, m: mPerPx });
}

/** A picture of the whole view: the view's own loop draws it again first (`look` left the sprite layers alone on the canvases). */
async function shot(page: Page, file: string): Promise<void> {
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
  await page.screenshot({ path: file });
}

/** Opens `url` and waits for the world: for the 1938 world its statistics and map layers too (the toy world has neither). */
async function boot(page: Page, url: string, earth: boolean): Promise<void> {
  await page.setViewportSize({ width: VW, height: VH });
  await page.goto(url);
  await page.waitForFunction((earth) => (window.__warsim?.view?.frames ?? 0) > 0 && (window.__warsim!.hud.worker.value ?? null) !== null && (!earth || (window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null)), earth, { timeout: 60_000 });
}

test('at 1 m/px a view shows the figures of the division it is on, and nothing of one it is not on', async ({ page }, info) => {
  test.setTimeout(120_000);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/2.7') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await boot(page, '/?scenario=1938&paused=1&seed=1938', true);
  await page.evaluate(async (cmds) => {
    const sim = window.__warsim!.sim;
    for (const c of cmds) sim.command(c);
    const tick = (await sim.step(1)).tick;
    await new Promise<void>((done) => {
      const wait = (): void => (window.__warsim!.view!.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
  }, SETUP);

  // The whole division in view, at the outer end of T3: where its elements stand.
  const whole = await look(page, SITE[0], SITE[1], 20);
  expect(whole.elements).toBe(28);
  expect(whole.figures).toBeGreaterThan(500);
  // The element furthest from the centre: 2,055 m to a side and 880 m ahead of it.
  const flank = whole.at.reduce((far, e) => (Math.hypot(e[0] - SITE[0], e[1] - SITE[1]) > Math.hypot(far[0] - SITE[0], far[1] - SITE[1]) ? e : far));
  const off = Math.hypot(flank[0] - SITE[0], flank[1] - SITE[1]) * KM * 1000;
  expect(off).toBeGreaterThan(2000);

  // On that flank at 1 m/px the division's centre is two kilometres outside the view.
  const onFlank = await look(page, flank[0], flank[1], 1);
  console.log(`1 m/px on the flank element (${off.toFixed(0)} m from the centre): ${onFlank.elements} elements, ${onFlank.figures} figures, ${onFlank.lit} of ${onFlank.total} px lit in a box of ${onFlank.w} × ${onFlank.h}`);
  expect(onFlank.elements).toBe(28);
  expect(onFlank.figuresShare).toBe(1);
  expect(onFlank.figures).toBeGreaterThan(500);
  expect(onFlank.lit).toBeGreaterThan(200);
  expect(onFlank.lit).toBeLessThan(onFlank.total / 2);
  await shot(page, path.join(out, 'close-on-a-flank-1m.png'));

  // 3.2 km north of the centre: the division is not in the view, nor within its reach of the
  // view's box. Nothing of it is sent, and nothing is drawn.
  const clear = await look(page, SITE[0], SITE[1] - 3200 / (KM * 1000), 1);
  console.log(`1 m/px, 3.2 km from the division's centre: ${clear.elements} elements, ${clear.lit} of ${clear.total} px lit in a box of ${clear.w} × ${clear.h}`);
  expect(clear.elements).toBe(0);
  expect(clear.lit).toBe(0);
  await shot(page, path.join(out, 'close-3km-from-a-division-1m.png'));

  // And a pan from there back onto the flank, more than a screen: the figures again.
  const back = await look(page, flank[0], flank[1], 1);
  expect({ elements: back.elements, figures: back.figures, lit: back.lit }).toEqual({ elements: onFlank.elements, figures: onFlank.figures, lit: onFlank.lit });
});

test('the stand-in sprite of a formation with no elements is no larger than a marker at any zoom', async ({ page }, info) => {
  test.setTimeout(120_000);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/2.7') : info.outputPath();
  mkdirSync(out, { recursive: true });
  // The toy world's formations have no elements: at T2 and T3 each is one stand-in sprite.
  await boot(page, '/?scenario=toy&paused=1&seed=7', false);
  const f = await page.evaluate(async () => (await window.__warsim!.sim.inspect(true)).formations[0]!);
  const sizes: string[] = [];
  for (const mPerPx of [200, 30, 5, 1]) {
    // A little off the formation, so that no two looks have one camera.
    const seen = await look(page, f.x + mPerPx * 1e-7, f.y, mPerPx);
    sizes.push(`${mPerPx} m/px: ${seen.centre} px`);
    expect(seen.elements, `${mPerPx} m/px`).toBe(0);
    // The formation under the camera is drawn, and what is drawn of it is a sprite of marker size.
    expect(seen.centre, `${mPerPx} m/px: the formation is drawn`).toBeGreaterThanOrEqual(8);
    expect(seen.centre, `${mPerPx} m/px`).toBeLessThanOrEqual(Math.ceil(STAND_IN_MAX_PX * Math.SQRT2));
    if (mPerPx === 200) await shot(page, path.join(out, 'toy-stand-ins-200m.png'));
  }
  console.log(`the toy world's stand-in under the camera, the larger side of its lit px: ${sizes.join('; ')}`);
});

// PLAN 2.7p (ADR-74, second read, finding 2): which of the two close layers shows is a matter of
// the zoom. It was also made a matter of whether there were figures to show: over ground with no
// formation the close tier went off, and a pan onto a division then turned it on again, with its
// fade. For those 250 ms the division's element sprites were drawn in full at the zoom of the
// figures: 102 px each at 5 m/px, where a figure is a few px.
test('a pan at T3 from empty ground onto a division shows its figures at once, not its sprites first', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page, '/?scenario=1938&paused=1&seed=1938', true);
  await page.evaluate(async (cmds) => {
    const sim = window.__warsim!.sim;
    for (const c of cmds) sim.command(c);
    const tick = (await sim.step(1)).tick;
    await new Promise<void>((done) => {
      const wait = (): void => (window.__warsim!.view!.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
  }, SETUP);

  // At 5 m/px half a cell (10 km) east of the division: ground, nothing in the snapshot.
  const ground = await look(page, SITE[0] + 0.5, SITE[1], 5);
  expect(ground.elements).toBe(0);
  expect(ground.lit).toBe(0);

  // The pan onto the division, at the same zoom. The view's own frames are read as they are
  // drawn, from the first that has the division's elements, for half a second after it and
  // until there are six of them. (Half a second alone held 3 and 4 frames in two gate runs of
  // 2026-10-05, beside three other pages drawn on the CPU, where the test asks for more than
  // 5; alone it holds 19. How many frames a loaded machine draws is not what is tested: the
  // first frame is, and every one after it.)
  const frames = await page.evaluate(async ({ x, y }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: v.controller.cam.scale });
    const seen: { ms: number; share: number; figures: number }[] = [];
    const t0 = performance.now();
    for (let since = -1; ; ) {
      await new Promise((done) => requestAnimationFrame(done));
      const now = performance.now();
      if (v.elementCount === 0) {
        if (now - t0 > 10_000) throw new Error('no elements for the view on the division');
        continue;
      }
      if (since < 0) since = now;
      seen.push({ ms: Math.round(now - since), share: v.shares.individuals, figures: v.individualCount });
      if (now - since > 500 && (seen.length > 5 || now - since > 10_000)) return seen;
    }
  }, { x: SITE[0], y: SITE[1] });
  const low = frames.reduce((a, f) => (f.share < a.share ? f : a));
  console.log(`a pan at 5 m/px onto the division: ${frames.length} frames in ${frames.at(-1)!.ms} ms; the figures' share in the first ${frames[0]!.share.toFixed(2)}, the lowest ${low.share.toFixed(2)} (${low.ms} ms in); ${frames[0]!.figures} figures`);
  expect(frames.length).toBeGreaterThan(5);
  expect(frames[0]!.figures).toBeGreaterThan(500);
  // The figures in full from the first frame: no frame draws the element sprites.
  expect(low.share).toBe(1);
});
