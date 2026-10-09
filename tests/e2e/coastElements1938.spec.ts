import { expect, test } from '@playwright/test';
import type {} from '../../src/app/testApi';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { lookAt, open1938 } from './mapView';

// PLAN 2.9a (ADR-79), the task's own test: element positions at T3 near coasts, against the
// fine mask. The view's elements are those of the worker's snapshot; the mask is the copy the
// worker sent of the one its world was built with. Before the task 200 of the 23,210 elements
// of the 1938 start stood on the mask's water (a formation at a coastal cell's middle).

const { w: W, h: H } = SIZE_1938;

test('at T3 no element of a formation near a coast stands on the fine mask’s water', async ({ page }) => {
  test.setTimeout(240_000);
  await open1938(page, 99);
  await page.waitForFunction(() => window.__warsim!.sim.landMask !== null, null, { timeout: 60_000 });

  // The formations nearest a coast: those within half a cell of the mask's water, by the page's own copy.
  const coastal = await page.evaluate(({ W, H }) => {
    const v = window.__warsim!.view!;
    const m = window.__warsim!.sim.landMask!;
    const bit = (px: number, py: number): boolean => {
      if (py < 0 || py >= m.h) return false;
      const i = py * m.w + (((px % m.w) + m.w) % m.w);
      return ((m.bits[i >> 3]! >> (i & 7)) & 1) === 1;
    };
    const k = m.w / W;
    const out: { id: number; x: number; y: number; sea: number }[] = [];
    for (const id of v.formationIds()) {
      // Of the land: a fleet stands on the mask's water (PLAN 4.2b).
      if (v.formationAfloat(id)) continue;
      const [x, y] = v.formationPos(id)!;
      const [px, py] = [Math.floor(x * k), Math.floor((y * m.h) / H)];
      let sea = Infinity;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (!bit(px + dx, py + dy)) sea = Math.min(sea, Math.hypot(dx, dy) / k);
      if (sea < 0.5) out.push({ id, x, y, sea });
    }
    return out.sort((a, b) => a.sea - b.sea);
  }, { W, H });
  console.log(`${coastal.length} formations of the 1938 start stand within half a cell of the mask's water; the nearest ${coastal.slice(0, 3).map((c) => `${c.id} (${(c.sea * 19.57).toFixed(1)} km)`).join(', ')}`);
  expect(coastal.length).toBeGreaterThanOrEqual(20);

  // Their elements, as the view has them at T3 (5 m/px), each formation in the middle of the view.
  // The page asks its own copy of the mask, by the module's convention (`maskLand`: the bit of
  // the pixel that holds the point); 17 MB of mask do not come over to the test.
  let elements = 0;
  let formations = 0;
  const wet: string[] = [];
  // The ground is not this test's, and at T3 it is most of a frame in the tests' rasteriser.
  await page.evaluate(() => {
    window.__warsim!.view!.relief = false;
  });
  // (The first look is a change of tier and is let come to rest; after it each look is a pan
  // at T3, and what is waited for is the snapshot, not the view's rest.)
  await lookAt(page, coastal[0]!.x, coastal[0]!.y, 5);
  for (const c of coastal.slice(0, 20)) {
    await page.evaluate(({ x, y }) => {
      const v = window.__warsim!.view!;
      v.controller.set({ cx: x, cy: y, scale: v.controller.cam.scale });
    }, c);
    // The snapshot for this view: the worker sends a formation's elements when its block reaches the view's box.
    await page.waitForFunction((id) => {
      const v = window.__warsim!.view!;
      for (let i = 0; i < v.elementCount; i++) if (v.elementFormation[i] === id) return true;
      return false;
    }, c.id, { timeout: 30_000 });
    const got = await page.evaluate(({ id, W, H }) => {
      const v = window.__warsim!.view!;
      const m = window.__warsim!.sim.landMask!;
      const land = (x: number, y: number): boolean => {
        const px = (((Math.floor((x * m.w) / W) % m.w) + m.w) % m.w);
        const py = Math.floor((y * m.h) / H);
        if (py < 0 || py >= m.h) return false;
        const i = py * m.w + px;
        return ((m.bits[i >> 3]! >> (i & 7)) & 1) === 1;
      };
      const out = { n: 0, wet: [] as string[] };
      for (let i = 0; i < v.elementCount; i++) {
        if (v.elementFormation[i] !== id) continue;
        out.n++;
        const [x, y] = [v.elementX[i]!, v.elementY[i]!];
        if (!land(x, y)) out.wet.push(`element ${v.elementId[i]} of formation ${id} at ${x.toFixed(3)}, ${y.toFixed(3)}`);
      }
      return out;
    }, { id: c.id, W, H });
    formations++;
    elements += got.n;
    wet.push(...got.wet);
  }
  console.log(`${formations} formations looked at at 5 m/px, ${elements} elements; on the mask's water: ${wet.length}`);
  expect(formations).toBe(20);
  expect(elements).toBeGreaterThan(300);
  expect(wet).toEqual([]);
});
