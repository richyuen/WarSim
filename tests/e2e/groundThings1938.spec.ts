import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { lookAt, open1938 } from './mapView';

// PLAN 2.8c2 (ADR-78): the trees, rocks and buildings of T2 and T3. The scatter (2.8c1, unit
// tested) says where they stand; here they are drawn: over a forest, a mountain range and a
// metropolis, where the scatter put them, the same after a reload, and in with the handover.
//
// The map canvas is read with the instances and without them (`view.instances`).

/** Places to look at, found in the terrain the worker sent: a forest and mountains with nothing else around, and a metropolis. */
function spots(page: Page): Promise<{ forest: [number, number]; mountains: [number, number]; city: [number, number]; cityName: string }> {
  return page.evaluate(() => {
    const m = window.__warsim!.sim.mapLayers!;
    const t = m.terrain;
    /** The first cell, row by row away from the poles, with only `cls` for `r` cells around. */
    const whole = (cls: number, r: number): [number, number] => {
      for (let y = r + 150; y < t.h - r - 150; y++)
        for (let x = r; x < t.w - r; x++) {
          let all = true;
          for (let dy = -r; dy <= r && all; dy++) for (let dx = -r; dx <= r && all; dx++) all = t.data[(y + dy) * t.w + x + dx] === cls;
          if (all) return [x + 0.5, y + 0.5];
        }
      throw new Error(`no ${2 * r + 1} × ${2 * r + 1} cells of terrain class ${cls}`);
    };
    const city = m.cities.find((c) => c.size === 5)!;
    return { forest: whole(4, 3), mountains: whole(6, 2), city: [city.x, city.y], cityName: city.name };
  });
}

interface Things {
  count: number;
  truncated: boolean;
  trees: number;
  rocks: number;
  buildings: number;
  /** Of up to 400 instances in full, well inside the view: at how many the picture with the instances differs from the one without, in the 5 × 5 px at the instance's middle. */
  sampled: number;
  drawn: number;
  /** The share of the picture that the instances change, and a hash of the picture with them. */
  changed: number;
  hash: string;
  elements: number;
}

/** The scatter of the view at rest and the two pictures, with the instances and without. */
function things(page: Page): Promise<Things> {
  return page.evaluate(() => {
    const v = window.__warsim!.view!;
    const c = document.getElementById('map') as HTMLCanvasElement;
    const gl = c.getContext('webgl2')!;
    const now = performance.now() + 1e6; // every fade is over
    const read = (instances: boolean): Uint8Array => {
      v.instances = instances;
      v.draw(now);
      const px = new Uint8Array(c.width * c.height * 4);
      gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px;
    };
    const off = read(false);
    const on = read(true);
    const s = v.groundScatter;
    const out = { count: s?.count ?? 0, truncated: s?.truncated ?? false, trees: 0, rocks: 0, buildings: 0, sampled: 0, drawn: 0, changed: 0, hash: '', elements: v.elementCount };
    let h = 0x811c9dc5;
    let changed = 0;
    for (let i = 0; i < on.length; i += 4) {
      h = Math.imul(Math.imul(Math.imul(h ^ on[i]!, 0x01000193) ^ on[i + 1]!, 0x01000193) ^ on[i + 2]!, 0x01000193);
      if (on[i] !== off[i] || on[i + 1] !== off[i + 1] || on[i + 2] !== off[i + 2]) changed++;
    }
    out.hash = (h >>> 0).toString(16).padStart(8, '0');
    out.changed = changed / (c.width * c.height);
    if (!s) return out;
    const dpr = c.width / c.clientWidth;
    const step = Math.max(1, Math.floor(s.count / 400));
    for (let k = 0; k < s.count; k++) {
      const o = k * 6;
      const kind = s.data[o + 3]!;
      if (kind === 0) out.trees++;
      else if (kind === 1) out.rocks++;
      else out.buildings++;
      if (k % step !== 0 || s.data[o + 4] !== 1) continue;
      const [x, y] = [c.clientWidth / 2 + s.data[o]!, c.clientHeight / 2 + s.data[o + 1]!];
      if (x < 20 || y < 20 || x > c.clientWidth - 20 || y > c.clientHeight - 20) continue;
      out.sampled++;
      // The 5 × 5 px at the instance's middle (rows are read from the bottom): something of it is
      // drawn there. (Not the one pixel at its very middle: a slate roof on a grey fill has
      // the ground's colour on one of its slopes, and is told by its ridge and its outline.)
      let most = 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const i = ((c.height - 1 - Math.floor(y * dpr) + dy) * c.width + Math.floor(x * dpr) + dx) * 4;
          most = Math.max(most, Math.abs(on[i]! - off[i]!) + Math.abs(on[i + 1]! - off[i + 1]!) + Math.abs(on[i + 2]! - off[i + 2]!));
        }
      if (most > 24) out.drawn++;
    }
    return out;
  });
}

test('trees stand in a forest, rocks in the mountains, buildings around a metropolis, at T2 and at T3', async ({ page }, info) => {
  test.setTimeout(240_000);
  await open1938(page);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/2.8') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const at = await spots(page);

  const look = async (name: string, where: [number, number], mPerPx: number): Promise<Things> => {
    await lookAt(page, where[0], where[1], mPerPx);
    const t = await things(page);
    console.log(`${name}, ${mPerPx} m/px: ${t.count} instances (${t.trees} trees, ${t.rocks} rocks, ${t.buildings} buildings)${t.truncated ? ', more than the cap' : ''}; the picture differs at the middle of ${t.drawn} of ${t.sampled} looked at; they change ${(t.changed * 100).toFixed(1)}% of the picture`);
    await page.screenshot({ path: path.join(out, `things-${name}-${mPerPx}m.png`) });
    // Drawn where the scatter put them; and they are things on the ground, not a cover over it.
    expect(t.sampled, `${name}, ${mPerPx} m/px: instances looked at`).toBeGreaterThan(20);
    expect(t.drawn / t.sampled, `${name}, ${mPerPx} m/px: drawn where the scatter put them`).toBeGreaterThan(0.95);
    expect(t.changed, `${name}, ${mPerPx} m/px: the share of the picture they change`).toBeLessThan(0.45);
    expect(t.truncated, `${name}, ${mPerPx} m/px: within the cap`).toBe(false);
    return t;
  };

  for (const mPerPx of [150, 20, 3]) {
    const forest = await look('forest', at.forest, mPerPx);
    expect(forest.trees, `a forest at ${mPerPx} m/px: trees`).toBeGreaterThan(2000);
    expect(forest.rocks + forest.buildings).toBe(0);
    const mountains = await look('mountains', at.mountains, mPerPx);
    expect(mountains.rocks, `mountains at ${mPerPx} m/px: rocks`).toBeGreaterThan(1000);
    expect(mountains.rocks, `mountains at ${mPerPx} m/px: more rocks than trees`).toBeGreaterThan(mountains.trees * 2);
  }
  // A metropolis: its buildings reach 18 km. The nearer the view, the more of it is town.
  console.log(`the metropolis: ${at.cityName}`);
  const far = await look('city', at.city, 150);
  const near = await look('city', at.city, 20);
  const close = await look('city', at.city, 3);
  expect(far.buildings, 'a metropolis at 150 m/px: buildings').toBeGreaterThan(20);
  expect(near.buildings, 'a metropolis at 20 m/px: buildings').toBeGreaterThan(1000);
  expect(near.buildings, 'at 20 m/px most of what stands there is buildings').toBeGreaterThan(near.trees * 5);
  expect(close.buildings, 'a metropolis at 3 m/px: buildings').toBeGreaterThan(3000);
});

test('the instances of a place are the same after a reload', async ({ page }) => {
  test.setTimeout(180_000);
  const hashes: string[][] = [];
  for (let load = 0; load < 2; load++) {
    await open1938(page);
    const at = await spots(page);
    const row: string[] = [];
    for (const mPerPx of [150, 5]) {
      await lookAt(page, at.forest[0], at.forest[1], mPerPx);
      const t = await things(page);
      expect(t.elements, 'no sprites in the view').toBe(0);
      expect(t.trees).toBeGreaterThan(2000);
      row.push(`${t.count}:${t.hash}`);
    }
    hashes.push(row);
  }
  console.log(`a forest at 150 and 5 m/px, two loads: ${hashes.map((r) => r.join(' ')).join(' | ')}`);
  expect(hashes[1]).toEqual(hashes[0]);
});

test('the instances come in with the T1 → T2 handover, not at once; at T1 there are none', async ({ page }) => {
  test.setTimeout(180_000);
  await open1938(page);
  const at = await spots(page);
  // T1: nothing is scattered, and the picture is the same with the switch on and off.
  await lookAt(page, at.forest[0], at.forest[1], 320);
  const t1 = await things(page);
  expect(t1.count, 'instances at T1').toBe(0);
  expect(t1.changed, 'at T1 the switch changes nothing').toBe(0);

  // The step into T2, and the view's frames 16 ms apart at times the test gives.
  const rec = await page.evaluate(({ cx, cy }) => {
    const v = window.__warsim!.view!;
    const c = document.getElementById('map') as HTMLCanvasElement;
    const gl = c.getContext('webgl2')!;
    const lum = (now: number): Float32Array => {
      v.draw(now);
      const px = new Uint8Array(c.width * c.height * 4);
      gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const out = new Float32Array(c.width * c.height);
      for (let i = 0; i < out.length; i++) out[i] = 0.2126 * px[i * 4]! + 0.7152 * px[i * 4 + 1]! + 0.0722 * px[i * 4 + 2]!;
      return out;
    };
    const jump = (a: Float32Array, b: Float32Array): number => {
      let max = 0;
      for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i]! - b[i]!));
      return max;
    };
    let now = performance.now() + 60_000;
    const first = lum(now);
    v.controller.set({ cx, cy, scale: (v.metresPerPx * v.controller.cam.scale) / 280 });
    let last = lum(now); // the frame of the step: the handover has begun and nothing of T2 shows yet
    const atStep = { jump: jump(first, last), scattered: v.groundScatter?.count ?? 0 };
    const jumps: number[] = [];
    const counts: number[] = [];
    let frames = 0;
    for (let quiet = 0; quiet < 3 && frames < 200; frames++) {
      now += 16;
      const cur = lum(now);
      jumps.push(jump(last, cur));
      counts.push(v.groundScatter?.count ?? 0);
      last = cur;
      quiet = v.unitsAnimating(now) ? 0 : quiet + 1;
    }
    return { atStep, largest: Math.max(...jumps), whole: jump(first, last), frames, growing: jumps.filter((j) => j > 0.5).length, counts: [...new Set(counts)] };
  }, { cx: at.forest[0], cy: at.forest[1] });
  console.log(`a forest, 320 → 280 m/px: the frame of the step changes a pixel by ${rec.atStep.jump.toFixed(1)} of 255 at most; then ${rec.growing} frames of change, the largest ${rec.largest.toFixed(1)}; the whole change ${rec.whole.toFixed(0)}; instances scattered: ${rec.counts.join(', ')}`);
  // (The step itself is a small zoom: the borders and the names move by a little.)
  expect(rec.frames, 'the view comes to rest').toBeLessThan(200);
  expect(rec.growing, 'frames in which the ground and what stands on it come in').toBeGreaterThanOrEqual(12);
  expect(rec.largest, 'the largest change of a pixel from one frame to the next').toBeLessThanOrEqual(48);
  expect(rec.whole, 'the whole change').toBeGreaterThan(rec.largest * 2);
  const t2 = await things(page);
  expect(t2.trees, 'instances at T2, at rest').toBeGreaterThan(2000);
});

// PLAN 2.11l (the fifth independent read, finding 4). Leaving T2 the sprites go by the clock
// (in full for 220 ms, then a fade), and the ground went with them, at whatever zoom the camera
// had reached by then: at 5000 m/px the trees of a view of 1920 × 1080 were 20,502, cut off at
// 12,000, at a line; and the ground's pass read the fine mask at half a screen pixel to a pixel
// of it. Beyond the zoom at which T2 is left the ground now goes with the zoom.
test('beyond T2 the ground and what stands on it go with the zoom: far out there is none of either, whatever the clock says', async ({ page }) => {
  test.setTimeout(180_000);
  await open1938(page);
  const at = await spots(page);
  await lookAt(page, at.forest[0], at.forest[1], 250);
  expect((await things(page)).trees, 'trees at rest at T2').toBeGreaterThan(1000);

  interface Frame { m: number; sprites: number; ground: number; scattered: number; cut: boolean }
  const rec = await page.evaluate(({ cx, cy }) => {
    const v = window.__warsim!.view!;
    // The view's own loop stops: the test gives the frames their times.
    v.dispose();
    const frame = (): Frame => ({ m: v.metresPerPx, sprites: v.shares.elements, ground: v.groundShare, scattered: v.groundScatter?.count ?? 0, cut: v.groundScatter?.truncated ?? false });
    const scaleOf = (m: number): number => (v.metresPerPx * v.controller.cam.scale) / m;
    let now = performance.now() + 60_000;
    v.draw(now);
    const rest = frame();
    // A jump far out (a test's `set`, God's tools): 40 frames there.
    v.controller.set({ cx, cy, scale: scaleOf(5000) });
    const jump: Frame[] = [];
    for (let k = 0; k < 40; k++) {
      v.draw(now);
      jump.push(frame());
      now += 16;
    }
    // Back at rest in T2, then out by the camera's own eased zoom (a spin of the wheel), frame by frame.
    v.controller.set({ cx, cy, scale: scaleOf(250) });
    now += 5000;
    v.draw(now);
    now += 5000;
    v.draw(now);
    v.frameAt(now); // (the loop's own clock, set to the test's: its first step is then one of 16 ms)
    const back = frame();
    v.controller.zoomTo(scaleOf(1500));
    const wheel: Frame[] = [];
    for (let k = 0; k < 90; k++) {
      now += 16;
      v.frameAt(now);
      wheel.push(frame());
    }
    return { rest, jump, back, wheel };
  }, { cx: at.forest[0], cy: at.forest[1] });

  expect(rec.rest).toMatchObject({ sprites: 1, ground: 1, cut: false });
  expect(rec.rest.scattered).toBeGreaterThan(1000);
  // The jump: the sprites' share is the clock's and still full in the first frames; of the ground there is nothing from the first frame on.
  expect(rec.jump[0]!.m).toBeGreaterThan(4990);
  expect(rec.jump[0]!.sprites, 'the sprites in the first frame far out').toBe(1);
  expect(Math.max(...rec.jump.map((f) => f.ground)), 'the ground far out').toBe(0);
  expect(Math.max(...rec.jump.map((f) => f.scattered)), 'instances far out').toBe(0);
  expect(rec.jump.at(-1)!.sprites, 'the sprites when the handover is over').toBe(0);
  // The wheel: back in T2 all is there again; on the way out the ground is the sprites' share up
  // to 345 m/px, less beyond, nothing from 690 m/px on, never more than the frame before, and
  // the scatter is never cut short.
  expect(rec.back).toMatchObject({ sprites: 1, ground: 1 });
  let before = 1;
  let between = 0;
  for (const f of rec.wheel) {
    expect(f.cut, `${f.m.toFixed(0)} m/px`).toBe(false);
    expect(f.scattered, `${f.m.toFixed(0)} m/px`).toBeLessThan(12_000);
    expect(f.ground, `${f.m.toFixed(0)} m/px`).toBeLessThanOrEqual(f.sprites);
    expect(f.ground, `${f.m.toFixed(0)} m/px`).toBeLessThanOrEqual(before);
    if (f.m <= 345) expect(f.ground, `${f.m.toFixed(0)} m/px`).toBe(f.sprites);
    if (f.m >= 690) expect(f.ground, `${f.m.toFixed(0)} m/px`).toBe(0);
    if (f.ground === 0) expect(f.scattered, `${f.m.toFixed(0)} m/px`).toBe(0);
    if (f.m > 345 && f.m < 690 && f.sprites === 1) between++;
    before = f.ground;
  }
  console.log(`out of T2 by the wheel, 250 → 1500 m/px: ${rec.wheel.filter((f) => f.ground > 0).length} frames with ground, ${between} of them beyond 345 m/px with the sprites still in full; the most instances in a frame ${Math.max(...rec.wheel.map((f) => f.scattered))}; at rest far out: ground ${rec.wheel.at(-1)!.ground}, sprites ${rec.wheel.at(-1)!.sprites}`);
  // (The way out has frames between the two zooms: the ground is seen going, not gone.)
  expect(rec.wheel.filter((f) => f.ground > 0 && f.ground < 1).length, 'frames with the ground going').toBeGreaterThanOrEqual(1);
  expect(rec.wheel.at(-1)!).toMatchObject({ sprites: 0, ground: 0, scattered: 0 });
  expect(Math.abs(rec.wheel.at(-1)!.m - 1500)).toBeLessThan(2);
});
