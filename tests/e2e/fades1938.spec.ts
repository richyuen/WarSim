import { expect, test } from '@playwright/test';
import type {} from '../../src/app/testApi';
import type { Command } from '../../src/shared/commands';
import { NATIONS_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { settle } from './settle';

// PLAN 2.7b AT: no popping at any tier change. Two divisions are spawned where nothing else
// stands (no enemy: nothing fires), and the camera crosses each of the three tier boundaries in
// both directions: T0 ↔ T1 at 2000 m/px, T1 ↔ T2 at 300, T2 ↔ T3 at 30, out again above each by
// the hysteresis (× 1.15).
//
// The AT's measure, "the maximal per-pixel luminance jump between consecutive frames", is taken
// at a fixed camera: the camera steps across the boundary once and stays, and the frames of the
// change that follows are drawn 16 ms apart, the unit layers alone on black. (While the camera
// moves, every edge moves by pixels a frame; that is motion, not popping.) That the step itself
// changes nothing at once is in the layers' shares: the first frame after it still has the old
// layer in full.

const SITE = [1578.5, 338.8] as const; // western China, far from every other formation
const nation = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const template = (id: string): number => TEMPLATES_LAND.findIndex((t) => t.id === id);
const SETUP: Command[] = [
  { kind: 'setAi', nation: nation('JAP'), enabled: false },
  { kind: 'spawnFormation', nation: nation('JAP'), x: SITE[0], y: SITE[1] - 0.3, strength: 0, template: template('infantry_div') },
  { kind: 'spawnFormation', nation: nation('JAP'), x: SITE[0], y: SITE[1] + 0.3, strength: 0, template: template('panzer_div') },
];

/**
 * A smooth cross-fade over 250 ms moves a layer's share by at most 0.096 in a 16 ms frame (1.5 ×
 * the linear step), which is 25 of 255 for a white figure on black, and the layer going out adds
 * its own change at the pixels the two share. 48 is twice the single step with room for
 * rounding; a layer that appears or goes in one frame jumps by its whole contrast.
 */
const MAX_JUMP = 48;
const FRAMES = 22; // 352 ms: the fade and its tail
const HYSTERESIS = 1.15;

interface Crossing {
  name: string;
  /** m/px the camera rests at before, and steps to. */
  from: number;
  to: number;
  /** Which of `shares` changes, and to what. */
  share: 'markers' | 'elements' | 'individuals';
  end: 0 | 1;
}
const crossing = (name: string, threshold: number, share: Crossing['share'], inward: boolean): Crossing =>
  inward
    ? { name, from: threshold * 1.0002, to: threshold * 0.9998, share, end: 1 }
    : { name, from: threshold * HYSTERESIS * 0.9998, to: threshold * HYSTERESIS * 1.0002, share, end: 0 };
const CROSSINGS: Crossing[] = [
  crossing('T0 → T1', 2000, 'markers', true),
  crossing('T1 → T2', 300, 'elements', true),
  crossing('T2 → T3', 30, 'individuals', true),
  crossing('T3 → T2', 30, 'individuals', false),
  crossing('T2 → T1', 300, 'elements', false),
  crossing('T1 → T0', 2000, 'markers', false),
];

test('no popping: every tier change is a cross-fade whose frames differ by little, in both directions', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  await page.evaluate(async (cmds) => {
    const sim = window.__warsim!.sim;
    for (const c of cmds) sim.command(c);
    const tick = (await sim.step(1)).tick;
    await new Promise<void>((done) => {
      const wait = (): void => (window.__warsim!.view!.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
  }, SETUP);

  const at = (mPerPx: number): Promise<void> =>
    page.evaluate(({ x, y, m }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
    }, { x: SITE[0], y: SITE[1], m: mPerPx });

  for (const c of CROSSINGS) {
    // At rest on the far side of the boundary, with the elements in the view where the tier has them.
    await at(c.from);
    if (c.from < 450) await page.waitForFunction(({ x, y }) => {
      const v = window.__warsim!.view!;
      const b = v.subscription?.bbox;
      return b !== undefined && v.subscription!.wantsElements && Math.abs((b[0] + b[2]) / 2 - x) < 0.05 && Math.abs((b[1] + b[3]) / 2 - y) < 0.05 && v.elementCount > 0;
    }, { x: SITE[0], y: SITE[1] }, { timeout: 15_000 });
    await settle(page);

    const rec = await page.evaluate(({ x, y, m, frames, share }) => {
      const v = window.__warsim!.view!;
      // The map's canvas (WebGL: the sprites) and the overlay (counters, markers); the city
      // labels have a canvas of their own between the two.
      const gl = document.querySelector('canvas')!;
      const overlay = document.querySelector<HTMLCanvasElement>('canvas.map-nations')!;
      const w = gl.width;
      const h = gl.height;
      const scratch = document.createElement('canvas');
      scratch.width = w;
      scratch.height = h;
      const ctx = scratch.getContext('2d', { willReadFrequently: true })!;
      /** The unit layers at `now`, composited on black, as luminance (Rec. 709, 0–255). */
      let slowest = 0;
      const frame = (now: number): Float32Array => {
        const t0 = performance.now();
        v.drawUnitLayers(now, true);
        slowest = Math.max(slowest, performance.now() - t0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(gl, 0, 0);
        ctx.drawImage(overlay, 0, 0, w, h);
        const px = ctx.getImageData(0, 0, w, h).data;
        const lum = new Float32Array(w * h);
        for (let i = 0; i < lum.length; i++) lum[i] = 0.2126 * px[i * 4]! + 0.7152 * px[i * 4 + 1]! + 0.0722 * px[i * 4 + 2]!;
        return lum;
      };
      const jump = (a: Float32Array, b: Float32Array): number => {
        let max = 0;
        for (let i = 0; i < a.length; i++) {
          const d = Math.abs(a[i]! - b[i]!);
          if (d > max) max = d;
        }
        return max;
      };
      const lit = (a: Float32Array): number => a.reduce((n, l) => n + (l > 8 ? 1 : 0), 0);

      let now = performance.now();
      const before = { ...v.shares };
      // The step across the boundary, then the camera stays.
      v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
      const first = frame(now);
      const shares = [v.shares[share]];
      const jumps: number[] = [];
      let prev = first;
      for (let k = 0; k < frames; k++) {
        now += 16;
        const cur = frame(now);
        jumps.push(jump(prev, cur));
        shares.push(v.shares[share]);
        prev = cur;
      }
      return { before, shares, jumps, whole: jump(first, prev), lit: [lit(first), lit(prev)], after: { ...v.shares }, animating: v.unitsAnimating(now), figures: v.individualCount, elements: v.elementCount, slowest };
    }, { x: SITE[0], y: SITE[1], m: c.to, frames: FRAMES, share: c.share });

    const start = 1 - c.end;
    console.log(`${c.name} (${c.from.toFixed(1)} → ${c.to.toFixed(1)} m/px): largest luminance jump between frames ${Math.max(...rec.jumps).toFixed(1)} of 255; the whole change ${rec.whole.toFixed(0)}; lit pixels ${rec.lit[0]} → ${rec.lit[1]}; slowest frame of the unit layers ${rec.slowest.toFixed(2)} ms of CPU`);
    // The step itself changes nothing at once: the first frame still has the old layer in full.
    expect(rec.before[c.share], `${c.name}: at rest before`).toBe(start);
    expect(rec.shares[0], `${c.name}: the frame of the step`).toBe(start);
    // Then the share moves to the other end in steps the eye follows, and stays.
    for (let k = 1; k < rec.shares.length; k++) {
      const d = (rec.shares[k]! - rec.shares[k - 1]!) * (c.end === 1 ? 1 : -1);
      expect(d, `${c.name}: frame ${k}`).toBeGreaterThanOrEqual(0);
      expect(d, `${c.name}: frame ${k}`).toBeLessThan(0.12);
    }
    expect(rec.shares.at(-1), c.name).toBe(c.end);
    expect(rec.animating, c.name).toBe(false);
    // The AT: no pixel of the unit layers jumps between two frames.
    expect(Math.max(...rec.jumps), `${c.name}: largest luminance jump`).toBeLessThanOrEqual(MAX_JUMP);
    // And the measure would have seen a pop: done in one frame, this change is several times the limit.
    expect(rec.whole, `${c.name}: the whole change`).toBeGreaterThan(MAX_JUMP * 2);
    expect(Math.min(...rec.lit), `${c.name}: units on screen`).toBeGreaterThan(50);
    if (c.share === 'individuals') expect(rec.figures, c.name).toBeGreaterThan(1000);
  }

  // Hysteresis: back inside the band after going out, the farther layer stays (T1 markers at
  // 320 m/px having come from T1; before, the markers and the sprites were both half there).
  await at(320);
  await settle(page);
  expect(await page.evaluate(() => ({ ...window.__warsim!.view!.shares, markerOpacity: window.__warsim!.view!.markerOpacity }))).toEqual({ markers: 1, elements: 0, individuals: 0, markerOpacity: 1 });
  await at(250); // the old fade band toward T2: sprites in full, no marker left
  await settle(page);
  expect(await page.evaluate(() => ({ ...window.__warsim!.view!.shares, markers: window.__warsim!.view!.markerRects.length, markerOpacity: window.__warsim!.view!.markerOpacity }))).toEqual({ markers: 0, elements: 1, individuals: 0, markerOpacity: 0 });
  await at(320); // out again, inside the hysteresis: still the sprites
  await settle(page);
  expect(await page.evaluate(() => window.__warsim!.view!.shares.elements)).toBe(1);
});
