import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { T1_MIN_M } from '../../src/render/units/markers';
import type { Command } from '../../src/shared/commands';
import { NATIONS_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { settle } from './settle';

// PLAN 2.7c, found in the review pass after PLAN 2.7. On its way into the T2 sprites a marker's
// box is a picture of itself, so that it shrinks smoothly. The pictures were kept by symbol and
// state and not by nation: of two nations' markers in view, one wore the other's colour and
// flag for the 250 ms of the morph. fades1938.spec.ts spawns two divisions of one nation and
// could not see it.
//
// Here an infantry division of Japan and one of Manchukuo, its subject, stand side by side where
// nothing else is (cream and ochre; nothing fires), and the camera steps from T1 into T2. Each
// box is read at rest and in the frames of the morph. (A division of a nation with no business
// there, Germany's, is sent home by the sim within the tick: `repatriationSystem`.)

const SITE = [1578.5, 338.8] as const; // western China, far from every other formation
const nation = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const infantry = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');
const JAP = nation('JAP');
const MAN = nation('MAN');
const SETUP: Command[] = [
  { kind: 'setAi', nation: JAP, enabled: false },
  { kind: 'setAi', nation: MAN, enabled: false },
  { kind: 'spawnFormation', nation: JAP, x: SITE[0] - 1, y: SITE[1], strength: 0, template: infantry },
  { kind: 'spawnFormation', nation: MAN, x: SITE[0] + 1, y: SITE[1], strength: 0, template: infantry },
];
/** The box's share of a marker's height; under it are the strength bar and the number (17 and 12 px). */
const BOX_SHARE = 17 / 29;

interface Box {
  nation: number;
  scale: number;
  alpha: number;
  /** Mean colour of the box on black, 0–255. */
  rgb: [number, number, number];
}
const apart = (a: Box, b: Box): number => Math.max(...a.rgb.map((c, i) => Math.abs(c - b.rgb[i]!)));

test('the marker → elements morph: each nation\'s box keeps its own colour and flag', async ({ page }, info) => {
  test.setTimeout(120_000);
  const out = process.env['EVIDENCE'] !== undefined ? path.resolve(import.meta.dirname, '../../docs/evidence/2.7') : info.outputPath();
  mkdirSync(out, { recursive: true });
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

  // At rest at T1, just above the boundary.
  await page.evaluate(({ x, y, m }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, { x: SITE[0], y: SITE[1], m: T1_MIN_M * 1.0002 });
  await settle(page);

  const rec = await page.evaluate(({ x, y, m, boxShare }) => {
    const v = window.__warsim!.view!;
    const overlay = document.querySelector<HTMLCanvasElement>('canvas.map-nations')!;
    const k = overlay.width / overlay.clientWidth; // device px per CSS px
    const scratch = document.createElement('canvas');
    scratch.width = overlay.width;
    scratch.height = overlay.height;
    const ctx = scratch.getContext('2d', { willReadFrequently: true })!;
    /** The markers' boxes in the frame at `now`: the overlay alone, on black. */
    const boxes = (now: number): { nation: number; scale: number; alpha: number; rgb: [number, number, number] }[] => {
      v.drawUnitLayers(now, true);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, scratch.width, scratch.height);
      ctx.drawImage(overlay, 0, 0);
      return v.markerRects.map((r) => {
        const d = ctx.getImageData(Math.round(r.x * k), Math.round(r.y * k), Math.round(r.w * k), Math.round(r.h * boxShare * k)).data;
        const sum = [0, 0, 0];
        for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) sum[c]! += d[i + c]!;
        const n = d.length / 4;
        return { nation: r.nation, scale: r.scale, alpha: r.alpha, rgb: [sum[0]! / n, sum[1]! / n, sum[2]! / n] };
      });
    };
    const now = performance.now();
    const rest = boxes(now);
    // The step across the boundary, then the camera stays.
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
    const step = boxes(now);
    const begun = boxes(now + 16);
    // Evidence: a quarter of the way in, with the map under it, the 480 × 240 px around the two.
    v.draw(now + 64);
    const crop = document.createElement('canvas');
    crop.width = 480 * k;
    crop.height = 240 * k;
    const c2 = crop.getContext('2d')!;
    const sx = scratch.width / 2 - crop.width / 2;
    const sy = scratch.height / 2 - crop.height / 2;
    for (const layer of [document.querySelector('canvas')!, overlay]) c2.drawImage(layer, sx, sy, crop.width, crop.height, 0, 0, crop.width, crop.height);
    const picture = crop.toDataURL('image/png');
    return { rest, step, begun, half: boxes(now + 125), picture };
  }, { x: SITE[0], y: SITE[1], m: T1_MIN_M * 0.9998, boxShare: BOX_SHARE });
  writeFileSync(path.join(out, 'morph-two-nations-at-64ms.png'), Buffer.from(rec.picture.split(',')[1]!, 'base64'));

  const of = (frame: Box[], id: number): Box => frame.find((b) => b.nation === id)!;
  for (const frame of [rec.rest, rec.step, rec.begun, rec.half]) expect(frame.map((b) => b.nation).sort((a, b) => a - b)).toEqual([JAP, MAN].sort((a, b) => a - b));
  // At rest the two boxes are told apart with ease: the test would see one wearing the other's colour.
  const told = apart(of(rec.rest, JAP), of(rec.rest, MAN));
  console.log(`at rest: Japan ${of(rec.rest, JAP).rgb.map((c) => c.toFixed(0)).join(',')}, Manchukuo ${of(rec.rest, MAN).rgb.map((c) => c.toFixed(0)).join(',')} (apart by ${told.toFixed(0)} of 255)`);
  expect(told).toBeGreaterThan(60);
  for (const id of [JAP, MAN]) {
    const at = of(rec.rest, id);
    // The frame of the step: nothing has changed yet.
    expect(of(rec.step, id), `nation ${id}: the frame of the step`).toMatchObject({ scale: 1, alpha: 1 });
    expect(apart(of(rec.step, id), at), `nation ${id}: the frame of the step`).toBeLessThan(1);
    // 16 ms on the box is a picture, a little smaller and fainter, and of the same nation.
    const begun = of(rec.begun, id);
    expect(begun.scale, `nation ${id}: the morph has begun`).toBeLessThan(1);
    expect(begun.alpha).toBeGreaterThan(0.95);
    console.log(`nation ${id}: 16 ms into the morph its box differs from rest by ${apart(begun, at).toFixed(1)} of 255`);
    expect(apart(begun, at), `nation ${id}: its box 16 ms into the morph, against at rest`).toBeLessThan(12);
  }
  // Half-way both are fainter, and still two colours.
  expect(apart(of(rec.half, JAP), of(rec.half, MAN)), 'half-way: the two boxes').toBeGreaterThan(told * 0.3);
});
