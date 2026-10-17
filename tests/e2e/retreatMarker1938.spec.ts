import { expect, test } from '@playwright/test';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 7.4g2 (ADR-460): a retreat was a march like any other on the page. A formation on the
// retreat has a badge on the corner of the T1 marker that stands for it, its own or its stack's
// (an orange « on a dark square); the panel says
// "On the retreat" (PLAN 3.7m). Not a row of the history: seed 99 has some 2,800 retreats a year
// against 292 rows of everything else.

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;

test('a formation on the retreat has a badge on its T1 marker', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  // Germany against Poland, day by day until a formation is on the retreat.
  const found = await page.evaluate(async ([g, p]) => {
    const { sim, view } = window.__warsim!;
    sim.command({ kind: 'declareWar', attacker: g!, defender: p! });
    for (let d = 0; d < 60; d++) {
      const tick = (await sim.step(24)).tick;
      await new Promise<void>((done) => {
        const wait = (): void => (view!.lastTick === tick ? done() : void setTimeout(wait, 5));
        wait();
      });
      for (const f of view!.formationIds()) {
        const info = await sim.formation(f);
        if (info && info.retreat > 2) return { id: f, at: view!.formationPos(f)!, hours: info.retreat };
      }
    }
    return null;
  }, [id('GER'), id('POL')]);
  expect(found, 'a formation on the retreat within 60 days').not.toBeNull();
  await page.evaluate(({ x, y }) => window.__warsim!.view!.controller.set({ cx: x, cy: y, scale: 16 }), { x: found!.at[0], y: found!.at[1] });
  await page.waitForTimeout(800);
  const marker = await page.evaluate((f) => window.__warsim!.view!.markerRects.find((m) => m.members.includes(f) && m.alpha > 0.5) ?? null, found!.id);
  expect(marker, 'its marker at T1').not.toBeNull();
  // On its marker, or on the marker of the stack it is in (a retreat begins where its stack stands).
  expect(marker!.retreating, 'the badge on the marker that stands for it').toBe(true);
  const others = await page.evaluate(() => window.__warsim!.view!.markerRects.filter((m) => m.alpha > 0.5).map((m) => m.retreating));
  console.log(`formation ${found!.id} on the retreat ${found!.hours} h; markers in view ${others.length}, with a badge ${others.filter(Boolean).length}`);
  expect(others.filter(Boolean).length).toBeGreaterThan(0);
  expect(others.filter(Boolean).length, 'not every marker has one').toBeLessThan(others.length);
  await page.screenshot({ path: path.resolve('docs/evidence/7.4/g2-retreat-badge.png'), clip: { x: Math.max(0, marker!.x - 100), y: Math.max(0, marker!.y - 70), width: 220, height: 160 } });
});
