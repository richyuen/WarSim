import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { kmPerCell } from '../../src/sim/data/projection';
import { cellOf } from '../../src/sim/data/terrain';
import { ZOOM_HYSTERESIS } from '../../src/render/timing';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { MAX_JUMP } from './noPop';
import { settle } from './settle';

// PLAN 2.7d and 2.7e AT: the layers that are not units do not pop either. The capital flags came
// in at 3 px per cell in one frame; a city's dot and name faded by a curve of the zoom, so a
// camera resting inside a band showed them half there, and a name that found room appeared at
// once; a curved nation name appeared in one frame when its size reached 9 px. Now each is a
// state with hysteresis and a fade in time.
//
// As for the unit tiers (fades1938.spec.ts): the camera steps across a threshold once and stays,
// the frames of the change are drawn 16 ms apart (the city labels and the flags alone, on
// black), and no pixel may jump by more than the limit between two frames. At rest, wherever
// the camera stands, every dot, name and flag is in full or absent.

const { w: W, h: H } = SIZE_1938;
const [CX, CY] = cellOf(15, 50, W, H); // central Europe: cities of every size, many capitals
const M_PER_CELL = kmPerCell(W) * 1000;
const FRAMES = 22; // 352 ms: a fade of 250 ms and its tail
const HYSTERESIS = ZOOM_HYSTERESIS;

interface Crossing {
  name: string;
  /** m/px the camera comes from, so that what crosses is off (coming in) or on (going out) at `from`. */
  approach: number;
  /** m/px the camera rests at before, and steps to. */
  from: number;
  to: number;
}
/** Zooming in across `limit` m/px, or out across its hysteresis. */
const crossing = (name: string, limit: number, inward: boolean): Crossing =>
  inward
    ? { name: `${name} in`, approach: limit * 1.3, from: limit * 1.0002, to: limit * 0.9998 }
    : { name: `${name} out`, approach: limit * 0.9, from: limit * HYSTERESIS * 0.9998, to: limit * HYSTERESIS * 1.0002 };
const FLAGS = M_PER_CELL / 3; // 3 px per cell
const CROSSINGS: Crossing[] = [
  crossing('flags', FLAGS, true),
  crossing('flags', FLAGS, false),
  // Names by city size (and capitals at 5000), dots by size.
  ...[5000, 3500, 2000, 1400, 800, 450].flatMap((l) => [crossing(`names at ${l}`, l, true), crossing(`names at ${l}`, l, false)]),
  ...[12_000, 6000, 3000, 1500].flatMap((l) => [crossing(`dots at ${l}`, l, true), crossing(`dots at ${l}`, l, false)]),
];

test('no popping of labels and flags: each comes and goes by a fade, and at rest is in full or absent', async ({ page }, info) => {
  test.setTimeout(240_000);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/2.7') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null && window.__warsim!.view!.cityLabels.lastPlaced.length > 0, null, { timeout: 60_000 });
  const at = (mPerPx: number): Promise<void> => page.evaluate(({ cx, cy, scale }) => window.__warsim!.view!.controller.set({ cx, cy, scale }), { cx: CX, cy: CY, scale: M_PER_CELL / mPerPx });

  // PLAN 2.7e: the curved nation names. A name comes in when its size reaches 9 px and nothing
  // larger is in its way; where that is depends on the nation's shape, so the zooms are found
  // here, by bisection, for two names that the world view does not show and a closer one does.
  const names = await page.evaluate(({ cx, cy, perCell }) => {
    const v = window.__warsim!.view!;
    // Frames far apart in time: every fade is over by the next one. (Frames of the view's own
    // loop come before these on the clock, which leaves an animation done.)
    let now = performance.now() + 1e6;
    const rest = (m: number): void => {
      v.controller.set({ cx, cy, scale: perCell / m });
      for (let i = 0; i < 2; i++) v.drawLabelLayers((now += 10_000));
    };
    /** The names in full at `m` m/px, the camera coming from `via`. */
    const shown = (via: number, m: number): Set<number> => {
      rest(via);
      rest(m);
      return new Set(v.nationLabels.filter((l) => l.alpha === 1).map((l) => l.id));
    };
    const FAR = 14_000;
    const NEAR = 3_000;
    const far = shown(60_000, FAR);
    const near = v.nationLabels.length === 0 ? new Set<number>() : shown(60_000, NEAR);
    const text = new Map(v.nationLabels.map((l) => [l.id, l.text]));
    const out: { name: string; approach: number; from: number; to: number }[] = [];
    for (const id of [...near].filter((n) => !far.has(n)).slice(0, 2)) {
      // In: absent at `hi`, there at `lo`, the camera coming from far away each time.
      let [lo, hi] = [NEAR, FAR];
      for (let i = 0; i < 16; i++) {
        const mid = Math.sqrt(lo * hi);
        if (shown(60_000, mid).has(id)) lo = mid;
        else hi = mid;
      }
      out.push({ name: `the name ${text.get(id)} in`, approach: 60_000, from: hi, to: lo });
      // Out: there at `on`, gone at `off`, the camera coming from where it is on.
      let [on, off] = [lo, lo * 1.6];
      for (let i = 0; i < 16; i++) {
        const mid = Math.sqrt(on * off);
        if (shown(lo * 0.9, mid).has(id)) on = mid;
        else off = mid;
      }
      out.push({ name: `the name ${text.get(id)} out`, approach: lo * 0.9, from: on, to: off });
    }
    return out;
  }, { cx: CX, cy: CY, perCell: M_PER_CELL });
  expect(names.map((n) => n.name).join(', '), 'nation names that come and go between 14 and 3 km/px').toMatch(/ in, .* out, .* in, .* out/);

  for (const c of [...CROSSINGS, ...names]) {
    await at(c.approach);
    await settle(page);
    await at(c.from);
    await settle(page);
    const rec = await page.evaluate(({ cx, cy, scale, frames, shot }) => {
      const v = window.__warsim!.view!;
      const cities = document.querySelector<HTMLCanvasElement>('canvas.map-cities')!;
      const overlay = document.querySelector<HTMLCanvasElement>('canvas.map-nations')!;
      const w = overlay.width;
      const h = overlay.height;
      const scratch = document.createElement('canvas');
      scratch.width = w;
      scratch.height = h;
      const ctx = scratch.getContext('2d', { willReadFrequently: true })!;
      /** Where each flag stood in each frame: a flag that moves is not a fade (see below). */
      const places = new Map<number, Set<string>>();
      /** City labels and flags at `now`, composited on black, as luminance (Rec. 709, 0–255). */
      const frame = (now: number): Float32Array => {
        v.drawLabelLayers(now);
        for (const f of v.flagRects) places.set(f.id, (places.get(f.id) ?? new Set()).add(`${f.x},${f.y}`));
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(cities, 0, 0, w, h);
        ctx.drawImage(overlay, 0, 0, w, h);
        const px = ctx.getImageData(0, 0, w, h).data;
        const lum = new Float32Array(w * h);
        for (let i = 0; i < lum.length; i++) lum[i] = 0.2126 * px[i * 4]! + 0.7152 * px[i * 4 + 1]! + 0.0722 * px[i * 4 + 2]!;
        return lum;
      };
      /** The largest change of a pixel between two frames, outside the `skip` rectangles. */
      const jump = (a: Float32Array, b: Float32Array, skip: readonly [number, number, number, number][] = []): number => {
        let max = 0;
        for (let i = 0; i < a.length; i++) {
          const d = Math.abs(a[i]! - b[i]!);
          if (d <= max) continue;
          const x = i % w;
          const y = (i - x) / w;
          if (!skip.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)) max = d;
        }
        return max;
      };
      /** What is on: dots, names, flags and nation names that are wanted (at any opacity). */
      const count = (): { dots: number; names: number; flags: number; nations: number } => ({
        dots: v.cityLabels.lastPlaced.filter((l) => l.dotAlpha > 0).length,
        // (Not what still shows of a name at a place it has left: PLAN 2.7r. Its opacity is among `alphas` below.)
        names: v.cityLabels.lastPlaced.filter((l) => l.nameAlpha > 0 && !l.ghost).length,
        flags: v.flagRects.length,
        nations: v.nationLabels.filter((l) => l.alpha > 0).length,
      });
      const alphas = (): number[] => [...v.cityLabels.lastPlaced.flatMap((l) => [l.dotAlpha, l.nameAlpha]), ...v.flagRects.map((f) => f.alpha), ...v.nationLabels.map((l) => l.alpha)];

      let now = performance.now();
      v.drawLabelLayers(now);
      const before = count();
      // The step across the threshold, then the camera stays.
      v.controller.set({ cx, cy, scale });
      const recorded = [frame(now)];
      const partial = [alphas().filter((a) => a > 0 && a < 1).length];
      let picture = '';
      for (let k = 0; k < frames; k++) {
        now += 16;
        recorded.push(frame(now));
        partial.push(alphas().filter((a) => a > 0 && a < 1).length);
        if (shot === k) {
          // Evidence: this moment of the change, with the map and everything else.
          v.draw(now);
          ctx.drawImage(document.querySelector('canvas')!, 0, 0);
          ctx.drawImage(cities, 0, 0, w, h);
          ctx.drawImage(overlay, 0, 0, w, h);
          picture = scratch.toDataURL('image/png');
        }
      }
      // A capital flag keeps clear of the counters (PLAN 1.45c), and the camera's step can move
      // a counter's box by a pixel: the flag above it then follows, in whole pixels. That is a
      // flag moving, with a spec of its own (flagsClear1938), not something coming or going, so
      // the places such flags passed through are left out of the comparison, and counted.
      const moved = [...places].filter(([, at]) => at.size > 1);
      const skip = moved.flatMap(([, at]) => [...at].map((p): [number, number, number, number] => {
        const [x, y] = p.split(',').map(Number) as [number, number];
        return [x - 2, y - 2, x + 24 + 2, y + 16 + 2];
      }));
      const jumps = recorded.slice(1).map((cur, k) => jump(recorded[k]!, cur, skip));
      const unmasked = Math.max(...recorded.slice(1).map((cur, k) => jump(recorded[k]!, cur)));
      // (A sum of the rectangles, not their union: a flag's places overlap, so this counts too much.)
      const masked = skip.reduce((a, [x0, y0, x1, y1]) => a + (x1 - x0 + 1) * (y1 - y0 + 1), 0) / (w * h);
      return { before, after: count(), jumps, unmasked, moved: moved.length, masked, partial, whole: jump(recorded[0]!, recorded.at(-1)!, skip), animating: v.unitsAnimating(now), rest: alphas(), picture };
    }, { cx: CX, cy: CY, scale: M_PER_CELL / c.to, frames: FRAMES, shot: process.env['EVIDENCE'] && (c.name === 'flags in' || c.name === 'names at 2000 in' || c === names[0]) ? 7 : -1 });
    if (rec.picture) writeFileSync(path.join(out, `change-${c.name.replaceAll(' ', '-')}-at-128ms.png`), Buffer.from(rec.picture.split(',')[1]!, 'base64'));

    const changed = (['dots', 'names', 'flags', 'nations'] as const).filter((k) => rec.before[k] !== rec.after[k]);
    console.log(`${c.name} (${c.from.toFixed(0)} → ${c.to.toFixed(0)} m/px): largest luminance jump ${Math.max(...rec.jumps).toFixed(1)} of 255; the whole change ${rec.whole.toFixed(0)}; ${changed.map((k) => `${k} ${rec.before[k]} → ${rec.after[k]}`).join(', ') || 'nothing changed'}${rec.moved ? `; ${rec.moved} flags moved (with them: ${rec.unmasked.toFixed(0)})` : ''}`);
    // The comparison is of nearly all of the picture: what moving flags take out of it is small
    // (most at 2000 m/px, where the counters hand over to the markers and the flags that stood
    // above them come down).
    expect(rec.masked, `${c.name}: share of the picture left out for moving flags`).toBeLessThan(0.1);
    // The crossing changed what is on (or the view has no city of that size: then it tests nothing).
    expect(changed.length, `${c.name}: something comes or goes`).toBeGreaterThan(0);
    // The frame of the step shows nothing new in full and takes nothing away: whatever changes is
    // on its way, partly there, for several frames; then nothing is.
    expect(rec.partial.filter((n) => n > 0).length, `${c.name}: frames with something on its way`).toBeGreaterThanOrEqual(12);
    expect(rec.partial.at(-1), `${c.name}: at the end`).toBe(0);
    expect(rec.animating, c.name).toBe(false);
    for (const a of rec.rest) expect([0, 1], `${c.name}: an opacity at rest`).toContain(a);
    // The AT: no pixel of these layers jumps between two frames, and the measure would see a pop.
    expect(Math.max(...rec.jumps), `${c.name}: largest luminance jump`).toBeLessThanOrEqual(MAX_JUMP);
    expect(rec.whole, `${c.name}: the whole change`).toBeGreaterThan(MAX_JUMP * 2);
  }

  // At rest, wherever the camera stands, also inside the bands where dots and names used to be
  // half there (0.7–1 × each limit): everything in full or absent.
  for (const m of [400, 700, 1300, 1800, 2800, 4500, 5800, 9000, 11_000]) {
    await at(m);
    await settle(page);
    const rest = await page.evaluate(() => {
      const v = window.__warsim!.view!;
      return { labels: [...v.cityLabels.lastPlaced.flatMap((l) => [l.dotAlpha, l.nameAlpha]), ...v.nationLabels.map((l) => l.alpha)], flags: v.flagRects.map((f) => f.alpha), dots: v.cityLabels.lastPlaced.length };
    });
    expect(rest.dots, `${m} m/px`).toBeGreaterThan(5);
    expect([...new Set([...rest.labels, ...rest.flags])].sort(), `${m} m/px`).toEqual(rest.labels.includes(0) ? [0, 1] : [1]);
  }
});
