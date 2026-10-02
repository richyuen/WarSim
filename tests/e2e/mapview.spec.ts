import { expect, test } from '@playwright/test';
import type {} from '../../src/app/testApi';
import { Sim } from '../../src/sim/sim';

// Review (PLAN 0.22): the snapshot → dirty-tile → texture → pixel path shows the sim's truth.
// After 2000 ticks, a cell that the sim says is occupied (controller ≠ owner, inside a
// uniformly occupied 3×3 block: at a cell centre the cubic kernel only reaches the 3×3
// neighbourhood with meaningful weight) must render in the occupier's colour family, not the owner's.

const SEED = 21;
const TICKS = 2000;
const COLORS: Record<number, [number, number, number]> = { 1: [0x3b, 0x6f, 0xb6], 2: [0xc8, 0x55, 0x3d] };

function findOccupiedCell(): { x: number; y: number; owner: number; controller: number } {
  const sim = new Sim({ scenario: 'toy', seed: SEED });
  sim.step(TICKS);
  const { w, h, owner, controller } = sim.world.cells;
  for (let y = 3; y < h - 3; y++) {
    for (let x = 3; x < w - 3; x++) {
      const i = y * w + x;
      const c = controller[i]!;
      const o = owner[i]!;
      if (o === 0 || c === o) continue;
      let uniform = true;
      for (let dy = -1; dy <= 1 && uniform; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const j = (y + dy) * w + x + dx;
          if (controller[j] !== c || owner[j] !== o) {
            uniform = false;
            break;
          }
        }
      }
      if (uniform) return { x, y, owner: o, controller: c };
    }
  }
  throw new Error('no uniformly occupied 3×3 block found');
}

const dist = (a: number[], b: number[]): number => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

test('an occupied cell renders in the occupier colour family', async ({ page }) => {
  const cell = findOccupiedCell();
  await page.setViewportSize({ width: 800, height: 450 });
  await page.goto(`/?paused=1&seed=${SEED}`);
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.view!.lastTick === 0);
  await page.evaluate((n) => window.__warsim!.sim.step(n), TICKS);
  await page.waitForFunction((t) => window.__warsim!.view!.lastTick === t, TICKS);
  const px = await page.evaluate(({ x, y }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x + 0.5, cy: y + 0.5, scale: 24 });
    v.draw();
    const c = document.getElementById('map') as HTMLCanvasElement;
    const gl = c.getContext('webgl2')!;
    const out: number[][] = [];
    const p = new Uint8Array(4);
    // Several pixels around the centre (the hatching alternates between two shades).
    for (const [dx, dy] of [[0, 0], [2, 0], [0, 2], [-2, 0], [0, -2]]) {
      gl.readPixels(Math.floor(c.width / 2) + dx!, Math.floor(c.height / 2) + dy!, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
      out.push([p[0]!, p[1]!, p[2]!]);
    }
    return out;
  }, cell);
  const ctrl = COLORS[cell.controller]!;
  const own = COLORS[cell.owner]!;
  const dark = ctrl.map((v) => v * 0.72);
  for (const p of px) {
    const dCtrl = Math.min(dist(p, ctrl), dist(p, dark), dist(p, ctrl.map((v, k) => v * 0.65 + own[k]! * 0.35)));
    expect(dCtrl, `pixel ${p} vs controller ${ctrl} / owner ${own}`).toBeLessThan(dist(p, own));
  }
});
