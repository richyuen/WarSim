import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 7.160 AT (critic run 20, R20-B1): playing Germany at war with Poland, a click on one of its
// divisions at the front opens the panel of the formation the click selected. The replay of the
// critic's `c20_sx_selpanel.mjs`: seed 4441, day 60, twelve clicks on every third German formation,
// the camera on it; since PLAN 7.163 (ADR-773) on its marker as drawn, not its place in the sim.
// Red on a3edf009 (7 of 12 panels another formation's).

const GER = NATIONS_1938.findIndex((n) => n.tag === 'GER') + 1;

test('playing Germany at the front: each click opens the panel of the formation it selected', async ({ page }, info) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?scenario=1938&paused=1&seed=4441');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 120_000 });

  // Take Germany, declare war on Poland, and run 60 days.
  await page.evaluate((n) => window.__warsim!.view!.select(n), GER);
  await page.getByTestId('take-control').click();
  await page.getByTestId('tab-actions').click();
  await page.locator('.nation-panel select').first().selectOption({ label: 'Poland' });
  await page.getByRole('button', { name: 'Declare war' }).click();
  await page.getByTestId('nation-close').click().catch(() => {});
  await page.evaluate(async (n) => {
    const w = window.__warsim!;
    const target = w.view!.lastTick + n;
    await w.sim.step(n);
    await new Promise<void>((done) => {
      const wait = (): void => void (w.view!.lastTick >= target ? done() : setTimeout(wait, 10));
      wait();
    });
  }, 24 * 60);

  const ger = await page.evaluate((p) => window.__warsim!.view!.formationsOf(p), GER);
  expect(ger.length).toBeGreaterThanOrEqual(34);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/7.160') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const clicks: { id: number; sel: number[]; panel: number | null }[] = [];
  for (let k = 0; k < 12; k++) {
    const id = ger[k * 3]!;
    const p0 = (await page.evaluate((f) => window.__warsim!.view!.formationPos(f), id))!;
    await page.evaluate(() => window.__warsim!.view!.selectedFormations.clear());
    await page.evaluate(([x, y]) => window.__warsim!.view!.controller.set({ cx: x, cy: y, scale: 12 }), p0);
    await page.waitForTimeout(400);
    // The click is on the formation's marker where it is drawn (its stack's, if it is in one), where
    // a player clicks: since PLAN 7.163 (ADR-773) what is drawn under a click wins, and at its
    // position in the sim another nation's marker can be drawn (German 10: Polish 562's).
    const box = await page.evaluate((f) => {
      const v = window.__warsim!.view!;
      const c = (document.getElementById('map') as HTMLCanvasElement).getBoundingClientRect();
      const r = v.markerRects.find((m) => m.alpha > 0.5 && (m.id === f || m.members.includes(f)));
      return r ? ([c.left + r.x + r.w / 2, c.top + r.y + r.h / 2] as [number, number]) : null;
    }, id);
    expect(box, `the marker of formation ${id}`).not.toBeNull();
    await page.mouse.click(box![0], box![1]);
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
      const fp = document.querySelector<HTMLElement>('[data-testid=formation-panel]');
      return { sel: [...window.__warsim!.view!.selectedFormations], panel: fp ? Number(fp.dataset['formation']) : null };
    });
    clicks.push({ id, ...r });
    if (k === 1 || k === 6) await page.screenshot({ path: path.join(out, `click-${k}.png`) });
  }
  // Every click selected one German formation, and its panel is that formation's.
  const matched = clicks.filter((c) => c.sel.length === 1 && c.panel === c.sel[0]).length;
  expect(clicks, JSON.stringify(clicks)).toHaveLength(12);
  expect(matched, JSON.stringify(clicks)).toBe(12);
});
