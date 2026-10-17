import { expect, test } from '@playwright/test';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 7.11a (critic run 7, semantic zoom 6: "at 10 to 25 m/px the two sides are clumps of tiny
// sprites that run into one another; the front line between them cannot be read",
// `critic/shots/c7d_7781_arm_15m_live_1.png`): where two formations in contact face each other, each
// the other's nearest, a line of contact between their fronts, each side's half in its colour. The
// critic's fight (seed 7781, Germany on Poland, the first German armoured division in contact) at
// 15 m/px: a line drawn, its two halves opaque and unlike each other.

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;

test('T3: the line of contact between the German armour and the French infantry', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=7781');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const GER = id('GER');
  const pick = await page.evaluate(async ([g, p]) => {
    const { sim, view } = window.__warsim!;
    sim.command({ kind: 'declareWar', attacker: g!, defender: p! });
    for (let d = 0; d < 10; d++) {
      const tick = (await sim.step(24)).tick;
      await new Promise<void>((done) => {
        const wait = (): void => (view!.lastTick === tick ? done() : void setTimeout(wait, 5));
        wait();
      });
      const arm = view!.formationsOf(g!).filter((f) => view!.formationEngaged(f) && /Armou?red|Panzer|Tank/i.test(view!.formationTitle(f)?.kind ?? ''));
      if (arm.length > 0) return { f: arm[0]!, at: view!.formationPos(arm[0]!)! };
    }
    return null;
  }, [GER, id('POL')]);
  expect(pick, 'a German armoured division in contact within 10 days').not.toBeNull();
  await page.evaluate(({ x, y }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / 15 });
  }, { x: pick!.at[0], y: pick!.at[1] });
  await page.waitForFunction(() => window.__warsim!.view!.subscription?.tier === 3 && window.__warsim!.view!.individualCount > 0, null, { timeout: 15_000 });
  await page.waitForTimeout(1500);
  const got = await page.evaluate(() => {
    const v = window.__warsim!.view!;
    v.draw(performance.now());
    const lines = v.contactLinesShown.map((l) => ({ x: l.x, y: l.y, axis: l.axis, nations: [l.nationA, l.nationB] }));
    // The effects overlay's pixels a few px to either side of the first line's middle, along its axis.
    const cam = v.controller.cam;
    const out: number[][] = [];
    const l = v.contactLinesShown[0];
    if (l) {
      const c = (v as unknown as { overlay: HTMLCanvasElement }).overlay;
      const g = c.getContext('2d')!;
      const dpr = c.width / c.clientWidth;
      const sx = (l.x - cam.cx) * cam.scale + c.clientWidth / 2;
      const sy = (l.y - cam.cy) * cam.scale + c.clientHeight / 2;
      for (const side of [-1, 1]) {
        const px = g.getImageData(Math.round((sx + side * 1.5 * Math.cos(l.axis)) * dpr), Math.round((sy + side * 1.5 * Math.sin(l.axis)) * dpr), 1, 1).data;
        out.push([px[0]!, px[1]!, px[2]!, px[3]!]);
      }
    }
    return { lines, sides: out };
  });
  console.log(`lines of contact at 15 m/px: ${got.lines.length}, nations ${JSON.stringify(got.lines.map((l) => l.nations))}; the overlay at the first one's two halves ${JSON.stringify(got.sides)}`);
  await page.screenshot({ path: path.resolve('docs/evidence/7.11/a-contact-line-15m.png'), clip: { x: 300, y: 150, width: 800, height: 500 } });
  expect(got.lines.length).toBeGreaterThan(0);
  // Its two halves drawn, opaque, and unlike each other (the French blue, the German light grey).
  expect(got.sides).toHaveLength(2);
  for (const p of got.sides) expect(p[3]!).toBeGreaterThan(150);
  expect(Math.hypot(got.sides[0]![0]! - got.sides[1]![0]!, got.sides[0]![1]! - got.sides[1]![1]!, got.sides[0]![2]! - got.sides[1]![2]!)).toBeGreaterThan(60);
});
