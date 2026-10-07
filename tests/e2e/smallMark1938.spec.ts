import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { Frame, turretOf } from '../../src/shared/unitLooks';
import { armourFires, busiest } from '../helpers/armourFire';

// PLAN 3.6e3b AT (ADR-165): where a T2 sprite is at its least size, an element of tanks is drawn
// as the tank's small mark and nothing else is; at 60 m/px none is, and the turrets are whole.
// The ground is that of ADR-164's pictures: two weeks into 1938, where the most armour fires.
//
// What the instance data says is one half. The other is read from the canvas: the sprites are
// drawn once as they are and once with the small share held at 0, and the pixel in the middle of
// each tank is compared with its tint. A mark is its nation's colour there; a hull of 5 px is not.

const START = 24 * 14;
const HULLS: readonly number[] = [Frame.tank, Frame.tankMedium, Frame.tankHeavy];

test('T2: a tank is its small mark where a sprite is at its least size, and a hull with its turret from 60 m/px in', async ({ page }, info) => {
  test.setTimeout(240_000);
  const node = armourFires(START);
  const [cx, cy] = busiest(node.fires);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/3.6') : info.outputPath();
  mkdirSync(out, { recursive: true });

  await page.setViewportSize({ width: 900, height: 560 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  expect(await page.evaluate(async (n) => {
    const sim = window.__warsim!.sim;
    await sim.step(n);
    return sim.hash();
  }, START)).toEqual({ tick: START, hash: node.before });
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1);

  const lookAt = async (m: number): Promise<void> => {
    await page.evaluate(({ x, y, m }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
    }, { x: cx, y: cy, m });
    await page.waitForFunction(({ x, y }) => {
      const v = window.__warsim!.view!;
      v.frameAt(performance.now());
      const b = v.subscription?.bbox;
      return v.subscription?.tier === 2 && b !== undefined && Math.abs((b[0] + b[2]) / 2 - x) < 0.5 && Math.abs((b[1] + b[3]) / 2 - y) < 0.5 && v.elementCount > 0 && v.elementsZoom < 1.01 * v.metresPerPx && !v.unitsAnimating();
    }, { x: cx, y: cy }, { timeout: 30_000 });
  };
  /** A frame now, and what it drew: the small share, and each element's frame and what it is at the least size. */
  const drawn = (): Promise<{ px: number; small: number; turrets: number; elements: { frame: number; smallFrame: number }[] }> => page.evaluate(() => {
    const v = window.__warsim!.view!;
    v.draw(performance.now());
    return { px: v.elementPx, small: v.elementSmall, turrets: v.elementTurrets, elements: Array.from({ length: v.elementCount }, (_, i) => ({ frame: v.elementFrame(i), smallFrame: v.elementSmallFrame(i) })) };
  });

  // 150 m/px: the least size. Every tank is the mark, nothing else is, and no rifle is.
  await lookAt(150);
  const far = await drawn();
  expect(far.px).toBe(5);
  expect(far.small).toBe(1);
  const tanks = far.elements.filter((e) => HULLS.includes(e.frame));
  const rifles = far.elements.filter((e) => e.frame === Frame.infantry || e.frame === Frame.prone);
  expect(tanks.length).toBeGreaterThan(20);
  expect(rifles.length).toBeGreaterThan(20);
  for (const e of far.elements) expect(e.smallFrame, `frame ${e.frame}`).toBe(HULLS.includes(e.frame) ? Frame.tankSmall : e.frame);
  expect(far.turrets).toBe(tanks.length);
  for (const f of HULLS) expect(turretOf(f)).toBeGreaterThanOrEqual(0);

  // The canvas: the middle of each tank, of its tint's brightness, as drawn and with the share held at 0.
  const seen = await page.evaluate((hulls) => {
    const v = window.__warsim!.view!;
    const inner = v as unknown as { elementProxies: { draw: (...a: unknown[]) => void } };
    const gl = v.gl;
    const cam = v.controller.cam;
    const vw = gl.canvas.width;
    const vh = gl.canvas.height;
    const now = performance.now();
    const median = (a: number[]): number => a.sort((x, y) => x - y)[Math.floor(a.length / 2)]!;
    const middles = (): number => {
      v.drawUnitLayers(now, true);
      const px = new Uint8Array(4);
      const shares: number[] = [];
      for (let i = 0; i < v.elementCount; i++) {
        if (!hulls.includes(v.elementFrame(i))) continue;
        const sx = Math.floor((v.elementX[i]! - cam.cx) * cam.scale + vw / 2);
        const sy = Math.floor((v.elementY[i]! - cam.cy) * cam.scale + vh / 2);
        if (sx < 0 || sy < 0 || sx >= vw || sy >= vh) continue;
        gl.readPixels(sx, gl.drawingBufferHeight - 1 - sy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const [r, g, b] = v.elementTint(i);
        shares.push((px[0]! + px[1]! + px[2]!) / (r + g + b));
      }
      return median(shares);
    };
    const mark = middles();
    const p = inner.elementProxies;
    const draw = p.draw;
    p.draw = (...a: unknown[]): void => {
      a[9] = 0;
      draw.apply(p, a);
    };
    const hull = middles();
    p.draw = draw;
    v.draw(now);
    return { mark, hull, elementOpacity: v.elementOpacity };
  }, HULLS);
  expect(seen.elementOpacity).toBe(1);
  expect(seen.mark).toBeGreaterThan(0.6);
  expect(seen.mark - seen.hull).toBeGreaterThan(0.2);

  // Through the band, a metre a pixel at a time: the share falls from 1 to 0 without a step.
  const walk = await page.evaluate(() => {
    const v = window.__warsim!.view!;
    const cam = { ...v.controller.cam };
    const m0 = v.metresPerPx;
    const shares: { m: number; px: number; small: number }[] = [];
    for (let m = 110; m >= 58; m -= 0.5) {
      v.controller.set({ cx: cam.cx, cy: cam.cy, scale: (m0 * cam.scale) / m });
      v.draw(performance.now());
      shares.push({ m, px: v.elementPx, small: v.elementSmall });
    }
    v.controller.set(cam);
    v.draw(performance.now());
    return shares;
  });
  expect(walk[0]!.small).toBe(1);
  expect(walk.at(-1)!.small).toBe(0);
  let step = 0;
  for (let i = 1; i < walk.length; i++) {
    expect(walk[i]!.small, `${walk[i]!.m} m/px`).toBeLessThanOrEqual(walk[i - 1]!.small);
    step = Math.max(step, walk[i - 1]!.small - walk[i]!.small);
  }
  expect(step).toBeLessThan(0.05);
  // 100 m/px, where ADR-164's picture had a blob, is all mark.
  expect(walk.find((w) => w.m === 100)!.small).toBe(1);
  const band = walk.filter((w) => w.small > 0 && w.small < 1);

  for (const m of [300, 200, 100]) {
    await lookAt(m);
    expect((await drawn()).small, `${m} m/px`).toBe(1);
    await page.screenshot({ path: path.join(out, `t2-${m}m-mark-dpr1.png`) });
  }

  // 60 m/px: no mark, and a turret on every hull.
  await lookAt(60);
  const near = await drawn();
  expect(near.small).toBe(0);
  const hulls = near.elements.filter((e) => HULLS.includes(e.frame));
  expect(hulls.length).toBeGreaterThan(10);
  expect(near.turrets).toBe(hulls.length);
  await page.screenshot({ path: path.join(out, 't2-60m-dpr1.png') });
  console.log(`150 m/px: ${tanks.length} tanks, all the small mark, of ${far.elements.length} elements (${rifles.length} rifles, none); the middle of a tank ${seen.mark.toFixed(2)} of its tint as the mark, ${seen.hull.toFixed(2)} as a hull. The band: ${band[0]!.m} to ${band.at(-1)!.m} m/px (${band[0]!.px.toFixed(2)} to ${band.at(-1)!.px.toFixed(2)} px), the largest step ${step.toFixed(3)} in half a metre a pixel. 60 m/px: ${hulls.length} hulls, ${near.turrets} turrets, share ${near.small}`);
});
