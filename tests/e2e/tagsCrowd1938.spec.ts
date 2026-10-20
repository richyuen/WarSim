import { expect, test } from '@playwright/test';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 7.4f37: the tags of formations in contact, in a running war's battles (seed 1938, Germany
// at war with Poland three weeks, the panels shut), at T2 and T3: no tag on another; none over a
// block whose own tag is not by it (a reader takes it for that block's: the line seen at 60 m/px
// in PLAN 3.10c1b's picture); and at T3 none further than TAG_FAR from its block but a few
// (PLAN 7.4f36: one in ten stood 140 to 380 px off before).

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;

test('the tags of formations in contact: apart, by their own blocks, not far out', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.evaluate(async ([g, p]) => {
    const s = window.__warsim!.sim;
    s.command({ kind: 'declareWar', attacker: g!, defender: p! });
    const tick = (await s.step(24 * 21)).tick;
    // The view at that tick: read before, it had no formation in contact (1 run in 3).
    const v = window.__warsim!.view!;
    await new Promise<void>((done) => {
      const wait = (): void => (v.lastTick === tick ? done() : void setTimeout(wait, 5));
      wait();
    });
  }, [id('GER'), id('POL')]);
  await page.evaluate(() => {
    const h = window.__warsim!.hud;
    if (h.showStats.value) h.toggleStats();
  });
  const km = await page.evaluate(() => window.__warsim!.view!.geo.kmPerCell);
  const spots: number[][] = await page.evaluate(() => {
    const v = window.__warsim!.view!;
    const out: number[][] = [];
    for (const f of v.formationIds()) if (v.formationEngaged(f)) out.push([...v.formationPos(f)!]);
    return out.filter((_, i) => i % 2 === 0).slice(0, 15);
  });
  expect(spots.length, 'formations in contact').toBeGreaterThanOrEqual(10);
  for (const m of [60, 12]) {
    let tags = 0;
    let far = 0;
    for (const [x, y] of spots) {
      await page.evaluate(({ x, y, s }) => window.__warsim!.view!.controller.set({ cx: x, cy: y, scale: s }), { x: x!, y: y!, s: (km * 1000) / m });
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => {
        const v = window.__warsim!.view!;
        const t = v.tagRects;
        const on: string[] = [];
        const over: string[] = [];
        for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) {
          const a = t[i]!;
          const b = t[j]!;
          if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) on.push(`${a.name} / ${b.name}`);
        }
        for (const g of t)
          for (const o of v.tagInputs)
            if (o.id !== g.id && g.x < o.x1 && o.x0 < g.x + g.w && g.y < o.y1 && o.y0 < g.y + g.h && !t.some((u) => u.id === o.id && u.gap <= 5)) over.push(`${g.name} over ${o.name}`);
        return { n: t.length, on, over, far: t.filter((g) => g.gap > 120).length };
      });
      expect(r.on, `tags on each other at ${m} m/px by ${x}, ${y}`).toEqual([]);
      expect(r.over, `tags over a block whose own tag is not by it, at ${m} m/px by ${x}, ${y}`).toEqual([]);
      tags += r.n;
      far += r.far;
    }
    console.log(`${m} m/px: ${tags} tags, ${far} over 120 px from their blocks`);
    expect(tags).toBeGreaterThan(40);
    // Before PLAN 7.4f36 6 % at 12 m/px and 9 % at 6 (of 101 and 75); since, 1 to 2 %.
    expect(far / tags, `tags over 120 px off at ${m} m/px`).toBeLessThanOrEqual(0.035);
  }
});
