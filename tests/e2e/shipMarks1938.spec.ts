import { expect, test } from '@playwright/test';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';
import { isShipFrame } from '../../src/shared/unitLooks';

// PLAN 7.10a (critic run 7, naval 5: "ships at 15 m/px are flat coloured bars",
// `critic/shots/c7e_9043_1_0015m.png`): a ship's marks were light grey, which the tint made a paler
// shade of its hull. They are now dark (`SHIP_DETAIL`) and large enough to read at its least size.
// The critic's game (seed 9043, Germany on the United Kingdom, the first sea battle) at 15 m/px:
// along each ship's centre line, inside its outline, the darkest point against the brightest: the
// marks against the hull. Light-grey marks: a median of 0.51, the least 0.17; dark ones 0.67 and 0.29.

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;

test('T3: a ship at 15 m/px has dark marks on its hull, not a flat bar', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=9043');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const at = await page.evaluate(async ([g, e]) => {
    const { sim, view, hud } = window.__warsim!;
    sim.command({ kind: 'declareWar', attacker: g!, defender: e! });
    for (let d = 0; d < 20; d++) {
      const tick = (await sim.step(24)).tick;
      await new Promise<void>((done) => {
        const wait = (): void => (view!.lastTick === tick ? done() : void setTimeout(wait, 5));
        wait();
      });
      const sb = hud.seaBattles.value;
      if (sb.length > 0) return [sb[0]!.x, sb[0]!.y] as [number, number];
    }
    return null;
  }, [id('GER'), id('ENG')]);
  expect(at, 'a sea battle within 20 days').not.toBeNull();
  await page.evaluate(({ x, y }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / 15 });
  }, { x: at![0], y: at![1] });
  await page.waitForFunction(() => window.__warsim!.view!.subscription?.tier === 3 && window.__warsim!.view!.individualCount > 0, null, { timeout: 15_000 });
  await page.waitForTimeout(1500);
  const shipFrames = Array.from({ length: 32 }, (_, f) => isShipFrame(f));
  const got = await page.evaluate((shipFrames) => {
    const v = window.__warsim!.view!;
    const canvas = document.querySelector('canvas')!;
    const gl = canvas.getContext('webgl2')!;
    v.draw(performance.now());
    const dpr = canvas.width / canvas.clientWidth;
    const cam = v.controller.cam;
    const [vw, vh] = [canvas.clientWidth, canvas.clientHeight];
    const index = new Map<number, number>();
    for (let i = 0; i < v.elementCount; i++) index.set(v.elementId[i]!, i);
    const lum = (sx: number, sy: number): number => {
      const p = new Uint8Array(4);
      gl.readPixels(Math.round(sx * dpr), canvas.height - Math.round(sy * dpr) - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
      return 0.2126 * p[0]! + 0.7152 * p[1]! + 0.0722 * p[2]!;
    };
    const ships: { contrast: number; len: number }[] = [];
    for (let j = 0; j < v.individualCount; j++) {
      const e = index.get(v.individualOwner[j]!);
      if (e === undefined || !shipFrames[v.elementFrame(e)]) continue;
      const sx = (v.individualX[j]! - cam.cx) * cam.scale + vw / 2;
      const sy = (v.individualY[j]! - cam.cy) * cam.scale + vh / 2;
      if (sx < 40 || sy < 80 || sx > vw - 40 || sy > vh - 140) continue;
      const f = v.elementFacing(e);
      // Its length on the screen: the larger of its least size and its own (the shader's rule) is
      // more than the sprite's side times its hull's share; along the middle 10 px, inside the smallest hull.
      const half = 10;
      const l: number[] = [];
      for (let t = -0.5; t <= 0.5; t += 0.05) l.push(lum(sx + Math.cos(f) * t * half, sy + Math.sin(f) * t * half));
      const hi = Math.max(...l);
      const lo = Math.min(...l);
      ships.push({ contrast: hi > 0 ? (hi - lo) / hi : 0, len: l.length });
    }
    ships.sort((a, b) => a.contrast - b.contrast);
    return { n: ships.length, median: ships.length > 0 ? ships[Math.floor(ships.length / 2)]!.contrast : 0, least: ships[0]?.contrast ?? 0 };
  }, shipFrames);
  console.log(`ships at 15 m/px: ${got.n}; along the centre line, (brightest − darkest) / brightest: median ${got.median.toFixed(2)}, least ${got.least.toFixed(2)}`);
  await page.screenshot({ path: path.resolve('docs/evidence/7.10/a-ships-15m.png'), clip: { x: 450, y: 200, width: 500, height: 400 } });
  expect(got.n).toBeGreaterThan(3);
  expect(got.median, 'the marks against the hull, the median ship').toBeGreaterThan(0.6);
  expect(got.least, 'the marks against the hull, the least').toBeGreaterThan(0.25);
});
