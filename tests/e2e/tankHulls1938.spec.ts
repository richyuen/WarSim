import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 7.23a (critic run 8, tanks 7: "in 45 s at Speed x1 at 25 m/px on a live armour fight,
// hulls.shown stayed at 0"): the critic's case. Seed 3929, Germany at war with Poland and France
// from the start; on day 3 Germany's armoured division 41 is in contact with France's infantry.
// The camera on it at 25 m/px, the game at Speed x1: within 45 s a tank hull burns on the screen.
// Before 7.23a its tanks took 3.5 tanks of fire in two days in fractions over 34 elements, and
// lost none; now an element of tanks fired at loses whole tanks (ADR-501). The marks of the
// fallen are counted apart: they were all the critic's `hulls.count` saw.

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const WATCH_MS = 45_000;
const M_PER_PX = 25;

test("the critic's armour fight at Speed x1: a tank hull burns on the screen within 45 s", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?scenario=1938&paused=1&seed=3929');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
  const division = await page.evaluate(
    async ([ger, pol, fra]) => {
      const { sim, view } = window.__warsim!;
      sim.command({ kind: 'declareWar', attacker: ger!, defender: pol! });
      sim.command({ kind: 'declareWar', attacker: ger!, defender: fra! });
      const t = (await sim.step(72)).tick;
      await new Promise<void>((done) => {
        const wait = (): void => (view!.lastTick === t ? done() : void setTimeout(wait, 5));
        wait();
      });
      const s = await sim.inspect(true);
      const f = s.formations.find((g) => g.id === 41)!;
      const foe = Math.min(...s.formations.filter((g) => g.nation === fra && !g.wing).map((g) => Math.hypot(g.x - f.x, g.y - f.y)));
      return { nation: f.nation, kind: view!.formationTitle(41)?.kind ?? '', x: f.x, y: f.y, foe };
    },
    [id('GER'), id('POL'), id('FRA')],
  );
  // The critic's division: Germany's armour, in contact with France's on day 3.
  expect(division.nation).toBe(id('GER'));
  expect(division.kind).toMatch(/Armoured/);
  expect(division.foe).toBeLessThan(1.5);

  // Every frame the page draws: the tank hulls on the screen, those alight, and the marks of the fallen apart.
  await page.evaluate(({ x, y, m }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: (v.metresPerPx * v.controller.cam.scale) / m });
    const h = v.hulls;
    const draw = h.draw.bind(h);
    const seen = { frames: 0, tanks: 0, burning: 0, flames: 0, marks: 0, firstFlame: -1, start: 0 };
    (window as unknown as { __hulls: typeof seen }).__hulls = seen;
    h.draw = (...args: Parameters<typeof h.draw>): void => {
      draw(...args);
      if (seen.start === 0) return;
      seen.frames++;
      seen.tanks = Math.max(seen.tanks, h.shown.length);
      seen.burning = Math.max(seen.burning, h.shown.filter((b) => b.burns).length);
      seen.flames = Math.max(seen.flames, h.flames);
      seen.marks = Math.max(seen.marks, h.fallenShown.length);
      if (h.flames > 0 && seen.firstFlame < 0) seen.firstFlame = performance.now() - seen.start;
    };
  }, { x: division.x, y: division.y, m: M_PER_PX });
  await page.waitForFunction(() => {
    const v = window.__warsim!.view!;
    return v.subscription?.tier === 3 && v.individualsShown && v.shares.individuals === 1 && v.elementCount > 0;
  }, null, { timeout: 30_000 });
  expect(await page.evaluate(() => Math.round(window.__warsim!.view!.metresPerPx))).toBe(M_PER_PX);

  await page.evaluate(() => {
    const { hud } = window.__warsim!;
    hud.setSpeedLevel(0);
    (window as unknown as { __hulls: { start: number } }).__hulls.start = performance.now();
    if (hud.paused.value) hud.togglePause();
  });
  await page.waitForFunction(() => (window as unknown as { __hulls: { firstFlame: number } }).__hulls.firstFlame >= 0, null, { timeout: WATCH_MS + 5_000, polling: 100 }).catch(() => undefined);
  // The picture while it burns: a flame lasts 6 s of the render clock, paused or not.
  const framed = await page.evaluate(() => {
    const { hud, view } = window.__warsim!;
    if (!hud.paused.value) hud.togglePause();
    const v = view!;
    const cam = { cx: v.controller.cam.cx, cy: v.controller.cam.cy };
    // On the hull alight, at the same zoom.
    const h = v.hulls.shown.find((b) => b.burns);
    if (h) v.controller.set({ cx: h.x, cy: h.y, scale: v.controller.cam.scale });
    return { cam, hull: h ? [h.x, h.y] : null };
  });
  await page.waitForTimeout(500);
  const seen = await page.evaluate(() => ({ ...(window as unknown as { __hulls: { frames: number; tanks: number; burning: number; flames: number; marks: number; firstFlame: number } }).__hulls }));
  const out = path.join('docs', 'evidence', '7.23');
  mkdirSync(out, { recursive: true });
  await page.screenshot({ path: path.join(out, 'a-burning-hull-x1-spec.png') });
  console.log(`armoured division 41 at ${M_PER_PX} m/px, Speed x1: first flame at ${Math.round(seen.firstFlame)} ms, at most ${seen.tanks} tank hulls on the screen (${seen.burning} burning, ${seen.flames} alight in a frame), ${seen.marks} marks of the fallen apart, in ${seen.frames} frames; the camera at ${framed.cam.cx.toFixed(2)}, ${framed.cam.cy.toFixed(2)} (the division at ${division.x.toFixed(2)}, ${division.y.toFixed(2)}), the hull at ${framed.hull?.map((c) => c.toFixed(2)).join(', ')}`);
  expect(seen.firstFlame, 'a tank hull alight within 45 s at x1').toBeGreaterThanOrEqual(0);
  expect(seen.firstFlame).toBeLessThan(WATCH_MS);
  expect(seen.burning).toBeGreaterThan(0);
});
