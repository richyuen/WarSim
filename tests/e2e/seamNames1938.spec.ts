import { expect, test } from '@playwright/test';
import type {} from '../../src/app/testApi';

// PLAN 7.4f41 (a line of PLAN 7.4's "seam of the looping map"): the two copies of a city either
// side of the seam shared one name switch and one place. With both laid out, what stood in one
// copy's way moved both, and the layer never rested. A capital's name holds out to 5,750 m/px (its
// limit × ZOOM_HYSTERESIS), where the whole world is some 6,970 px wide: a view 8,000 px wide at
// 5,700 m/px shows both copies of the capitals in a strip of some 970 px. Each has its own name,
// and the layer comes to rest.

const VW = 8000;
const VH = 800;

test('both copies of a city by the seam have their names, and the layer rests', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: VW, height: VH });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.evaluate(() => {
    const h = window.__warsim!.hud;
    if (h.showStats.value) h.toggleStats();
  });
  const km = await page.evaluate(() => window.__warsim!.view!.geo.kmPerCell);
  const w = await page.evaluate(() => window.__warsim!.view!.geo.w);
  // In at 4,900 m/px over Europe (capital names come in), then out to 5,700 (held by the
  // hysteresis), the view's left edge at x 980: the cities in the strip of the view wider than the
  // world (x 980 to some 1280: Europe) are on both copies.
  for (const m of [4900, 5700]) {
    const scale = (km * 1000) / m;
    await page.evaluate(({ cx, s }) => window.__warsim!.view!.controller.set({ cx, cy: 265, scale: s }), { cx: m === 5700 ? 980 + VW / 2 / scale : 1080, s: scale });
    await page.waitForTimeout(1200);
  }
  void w;
  // Both copies of a capital in view, each with its name.
  const copies = await page.evaluate(() => {
    const v = window.__warsim!.view!;
    const by = new Map<number, number>();
    for (const p of v.cityLabels.lastPlaced) if (!p.ghost && p.nameAlpha > 0.99) by.set(p.index, (by.get(p.index) ?? 0) + 1);
    return [...by.values()].filter((n) => n >= 2).length;
  });
  console.log(`cities with a name on both copies: ${copies}`);
  expect(copies, 'cities named on both copies').toBeGreaterThan(5);
  // At rest: frames drawn 50 ms apart over 1.5 s (a wide view draws a few frames a second on a
  // test machine: the frames are drawn here, at the times given). Each frame, no name of the layer
  // fades, and nothing is left fading.
  const busy = await page.evaluate(() => {
    const v = window.__warsim!.view!;
    let animating = 0;
    const t0 = performance.now();
    for (let k = 0; k < 30; k++) {
      const now = t0 + k * 50;
      v.draw(now);
      if (v.cityLabels.animating(now)) animating++;
    }
    return { frames: 30, animating };
  });
  console.log(`frames ${busy.frames}, with the city layer animating ${busy.animating}`);
  expect(busy.animating, 'frames with the city layer animating').toBe(0);
});
