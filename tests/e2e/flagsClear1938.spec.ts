import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { settle } from './settle';

// PLAN 1.45c AT: at 3 and 6 px per cell over Europe, at the 1938 start, no capital flag covers any
// part of a counter's box. The flags are drawn above the unit layers (PLAN 2.1); a flag that would
// cover a counter stands above that counter instead, and is left out when that would be more than
// 40 px from its capital. Before, the flags of Rome, Helsinki and Lisbon covered the numbers of
// the counters standing there.

const { w: W, h: H } = SIZE_1938;
const VW = 1400;
const VH = 800;
const [EX, EY] = cellOf(15, 50, W, H);

interface Rect { x: number; y: number; w: number; h: number }
const touches = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

async function rest(page: Page, scale: number): Promise<{ flags: (Rect & { id: number })[]; counters: (Rect & { text: string; alpha: number })[] }> {
  await page.evaluate(({ cx, cy, scale }) => window.__warsim!.view!.controller.set({ cx, cy, scale }), { cx: EX, cy: EY, scale });
  await settle(page);
  return page.evaluate(() => {
    const v = window.__warsim!.view!;
    return {
      flags: v.flagRects.map((f) => ({ id: f.id, x: f.x, y: f.y, w: f.w, h: f.h })),
      counters: v.counters.drawn.map((d) => ({ x: d.x, y: d.y, w: d.w, h: d.h, text: d.text, alpha: d.alpha })),
    };
  });
}

test('capital flags keep clear of the T0 counters', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: VW, height: VH });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.45') : info.outputPath();
  mkdirSync(out, { recursive: true });
  // The capitals of the living nations, in cells.
  const capitals = await page.evaluate(async () => {
    const s = await window.__warsim!.sim.inspect(true);
    const living = new Set(s.nations.filter((n) => n.living).map((n) => n.id));
    return s.cities.filter((c) => c.capitalOf !== 0 && living.has(c.capitalOf)).map((c) => ({ id: c.capitalOf, x: c.x, y: c.y }));
  });
  expect(capitals.length).toBeGreaterThan(90);

  for (const scale of [3, 6]) {
    const { flags, counters } = await rest(page, scale);
    expect(counters.length, `${scale} px`).toBeGreaterThan(20);
    expect([...new Set(counters.map((c) => c.alpha))], `${scale} px`).toEqual([1]);
    // No flag, with its 1 px frame, touches a counter's box.
    const covered = flags.flatMap((f) => counters.filter((c) => touches({ x: f.x - 1, y: f.y - 1, w: f.w + 2, h: f.h + 2 }, c)).map((c) => `flag of nation ${f.id} on ${c.text}`));
    expect(covered, `${scale} px`).toEqual([]);

    // Every capital in view has its flag, or has no place for one: the counters above its usual
    // place (24 px above the capital) leave none within 40 px, and such a flag is left out (ADR-65,
    // addendum). Some flags stand higher than their usual place, which is how they made way.
    //
    // This read "every capital in view has its flag: none had to be left out" until PLAN 2.7l. That
    // was a count of one picture of this zoom, and the picture depended on the frames drawn on the
    // way to it (ADR-75): the code of that time, with frames exactly 16 ms apart, left Prague's
    // flag out. What is asserted now is the rule, for each capital.
    const usual = new Map(capitals.map((c) => [c.id, { x: Math.round((c.x - EX) * scale + VW / 2 - 12), y: Math.round((c.y - EY) * scale + VH / 2 - 24) }]));
    const inView = [...usual].filter(([, p]) => p.x >= -24 && p.x <= VW && p.y >= -16 && p.y <= VH);
    const have = new Set(flags.map((f) => f.id));
    expect(have.size, `${scale} px: one flag a nation`).toBe(flags.length);
    const leftOut: number[] = [];
    for (const [id, u] of inView) {
      if (have.has(id)) continue;
      // The climb of the view, done again here: above the highest counter in the way, and again
      // if another stands there. Left out only when that ends more than 40 px up.
      for (let rise = 0; rise <= 40; ) {
        const hit = counters.filter((c) => touches({ x: u.x - 1, y: u.y - rise - 1, w: 26, h: 18 }, c));
        expect(hit.length, `${scale} px: nation ${id} has no flag, and its place ${rise} px above the usual one is free`).toBeGreaterThan(0);
        rise = u.y - (Math.floor(Math.min(...hit.map((c) => c.y))) - 16 - 3);
      }
      leftOut.push(id);
    }
    expect(flags.length + leftOut.length, `${scale} px`).toBe(inView.length);
    for (const f of flags) expect(inView.some(([id]) => id === f.id), `nation ${f.id}`).toBe(true);
    let raised = 0;
    for (const f of flags) {
      const u = usual.get(f.id)!;
      expect(f.x, `nation ${f.id}`).toBe(u.x);
      expect(f.y, `nation ${f.id}`).toBeLessThanOrEqual(u.y);
      if (f.y < u.y) {
        raised++;
        // It was in the way of a counter at its usual place, and stands just above one now.
        expect(counters.some((c) => touches({ x: u.x - 1, y: u.y - 1, w: 26, h: 18 }, c)), `nation ${f.id}`).toBe(true);
        expect(counters.some((c) => f.x - 1 < c.x + c.w && c.x < f.x + 25 && c.y - (f.y + 17) >= 0 && c.y - (f.y + 17) <= 3), `nation ${f.id}`).toBe(true);
      }
    }
    expect(raised, `${scale} px`).toBeGreaterThan(0);
    // None stands further from its capital than the limit beyond which a flag is left out.
    expect(Math.max(...flags.map((f) => usual.get(f.id)!.y - f.y)), ` px`).toBeLessThanOrEqual(40);
    console.log(`${scale} px per cell: ${counters.length} counters; ${flags.length} of ${inView.length} flags, ${raised} raised by up to ${Math.max(...flags.map((f) => usual.get(f.id)!.y - f.y))} px, ${leftOut.length} left out${leftOut.length ? ` (nations ${leftOut.join(', ')})` : ''}`);
    await page.screenshot({ path: path.join(out, `flags-clear-${scale}px.png`) });
  }

  // Making way is a short move, not a jump: after a zoom the flags ease to their new places.
  const move = await page.evaluate(({ cx, cy }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx, cy, scale: 3 });
    let now = performance.now() + 2_000;
    for (let i = 0; i < 40; i++) v.draw((now += 16)); // rest at 3 px per cell
    const before = new Map(v.flagRects.map((f) => [f.id, f.y]));
    v.controller.set({ cx, cy, scale: 3.4 });
    const steps: number[] = [];
    let last = new Map(v.flagRects.map((f) => [f.id, f.y]));
    for (let i = 0; i < 20; i++) {
      v.draw((now += 16));
      // The largest step of any flag in this frame, beyond what the zoom itself moves it.
      const cur = new Map(v.flagRects.map((f) => [f.id, f.y]));
      if (i > 0) steps.push(Math.max(0, ...[...cur].filter(([id]) => last.has(id)).map(([id, y]) => Math.abs(y - last.get(id)!))));
      last = cur;
    }
    return { flags: before.size, steps, animating: v.unitsAnimating(now) };
  }, { cx: EX, cy: EY });
  expect(move.flags).toBeGreaterThan(10);
  expect(Math.max(...move.steps)).toBeLessThanOrEqual(8); // px per 16 ms frame
  expect(move.animating).toBe(false);
  await page.waitForFunction(() => !window.__warsim!.view!.unitsAnimating());
});
