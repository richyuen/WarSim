import { expect, test } from '@playwright/test';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { lookAt, open1938 } from './mapView';

// PLAN 7.4f20 (from the Phase 2 review's list under PLAN 7.4, "Picking"): a formation in a stack
// of T1 markers could not be picked by a click, the lead being what is there. A click on the
// stack whose formation is open now opens the next of it, round to the lead.

const { w: W, h: H } = SIZE_1938;

test('clicks on a stack of markers open each of its formations in turn', async ({ page }) => {
  test.setTimeout(150_000);
  await open1938(page, 1938);
  // The Spanish Civil War after two weeks: stacks on its front (as markerStacks1938).
  await page.evaluate(() => window.__warsim!.sim.step(24 * 14));
  const [x, y] = cellOf(-3, 40.5, W, H);
  await lookAt(page, x, y, 1200);
  const stack = await page.evaluate(() => {
    const r = window.__warsim!.view!.markerRects.filter((m) => m.members.length > 1).sort((a, b) => b.members.length - a.members.length)[0];
    return r ? { cx: r.x + r.w / 2, cy: r.y + 12, members: r.members, lead: r.id } : null;
  });
  expect(stack, 'a stack on the front').not.toBeNull();
  const open = () => page.evaluate(() => window.__warsim!.hud.formation.value);
  const seen: number[] = [];
  for (let i = 0; i <= stack!.members.length; i++) {
    await page.mouse.click(stack!.cx, stack!.cy);
    await expect.poll(open).not.toBe(seen[seen.length - 1] ?? -1);
    seen.push(await open());
  }
  // The lead first, then each of the others, then the lead again.
  expect(seen[0]).toBe(stack!.lead);
  expect(new Set(seen.slice(0, stack!.members.length))).toEqual(new Set(stack!.members));
  expect(seen[stack!.members.length]).toBe(stack!.lead);
});
