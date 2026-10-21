import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 7.41a (critic run 11, naval 7: "7 of 11 Germany–UK battles have no ticker row", seed 2081):
// a sea battle whose fleets see each other but are not yet within reach of a weapon (its fleets
// closing: Britain's carrier group 264 km from Germany's battle squadron at hour 42) had no row
// (ADR-542). It now has one, after the battles of ships within reach and the carriers' strikes,
// that flies to its nearest two fleets at war: both on the screen.

const id = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;

/** After a flight of the camera: until it is over, and a snapshot of the new view. */
async function landed(page: Page): Promise<void> {
  await page.waitForTimeout(300);
  await page.waitForFunction(() => !window.__warsim!.view!.controller.animating, null, { timeout: 60_000 });
  await page.waitForTimeout(700);
}

/** Steps the sim `n` hours and waits for the view to have that hour's snapshot. */
async function stepHours(page: Page, n: number): Promise<number> {
  return page.evaluate(async (n) => {
    const { sim, view } = window.__warsim!;
    const t = (await sim.step(n)).tick;
    await new Promise<void>((done) => {
      const wait = (): void => (view!.lastTick >= t ? done() : void setTimeout(wait, 5));
      wait();
    });
    return t;
  }, n);
}

test('a sea battle whose fleets are closing has its row, which shows both fleets (the critic\'s Germany–UK, seed 2081)', async ({ page }, info) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=2081');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/7.41') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.evaluate(({ a, d }) => window.__warsim!.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: id('GER'), d: id('ENG') });
  // The critic's sample at hour 42: Britain's carrier group and Germany's battle squadron.
  let hour = await stepHours(page, 40);
  const closingRow = (): number => {
    const all = window.__warsim!.view!.seaBattles();
    const k = all.filter((b) => b.pair === null && b.strike === null && b.closing !== null).findIndex(() => true);
    return k < 0 ? -1 : all.filter((b) => b.pair !== null || b.strike !== null).length + k;
  };
  while (hour < 120 && (await page.evaluate(closingRow)) < 0) hour = await stepHours(page, 1);
  const k = await page.evaluate(closingRow);
  expect(k, 'a battle no weapon reaches by hour 120').toBeGreaterThanOrEqual(0);
  // Every battle has its row (the ticker beside no panel lists them all).
  const counts = await page.evaluate(() => ({ battles: window.__warsim!.view!.seaBattles().length, rows: document.querySelectorAll('[data-testid=sea-battle-row]').length }));
  expect(counts.rows, 'a row for every sea battle').toBe(counts.battles);
  const battle = await page.evaluate(() => window.__warsim!.view!.seaBattles().find((b) => b.pair === null && b.strike === null)!);
  const near = battle.closing!;
  const row = page.getByTestId('sea-battle-row').nth(k);
  await expect(row).toContainText('Fleets closing');
  await expect(row).toHaveAttribute('title', 'Show the two fleets closing');
  const rowText = await row.innerText();
  await row.click();
  await landed(page);
  // Its two fleets: the pair at war whose middle and span are the row's, each with a ship on the screen.
  const look = await page.evaluate(async (near) => {
    const v = window.__warsim!.view!;
    v.draw(performance.now());
    const cam = v.controller.cam;
    const fleets = (await window.__warsim!.sim.inspect(true)).formations.filter((f) => v.formationAfloat(f.id));
    const w = window.__warsim!.sim.mapLayers!.terrain.w;
    let pair: [number, number] | null = null;
    for (const f of fleets)
      for (const g of fleets) {
        if (f.id >= g.id || f.nation === g.nation) continue;
        const p = v.formationPos(f.id);
        const q = v.formationPos(g.id);
        if (!p || !q) continue;
        let dx = q[0] - p[0];
        if (Math.abs(dx) > w / 2) dx -= Math.sign(dx) * w;
        const mx = (((p[0] + dx / 2) % w) + w) % w;
        if (Math.abs(mx - near.x) < 0.05 && Math.abs((p[1] + q[1]) / 2 - near.y) < 0.05 && Math.abs(Math.abs(dx) - near.w) < 0.05) pair = [f.id, g.id];
      }
    const onScreen = (fid: number): number => {
      let n = 0;
      for (let i = 0; i < v.elementCount; i++) {
        if (v.elementFormation[i] !== fid) continue;
        const x = (v.elementX[i]! - cam.cx) * cam.scale + window.innerWidth / 2;
        const y = (v.elementY[i]! - cam.cy) * cam.scale + window.innerHeight / 2;
        if (x >= 0 && x <= window.innerWidth && y >= 0 && y <= window.innerHeight && document.elementFromPoint(x, y)?.tagName === 'CANVAS') n++;
      }
      return n;
    };
    return { m: v.metresPerPx, pair, ships: pair ? pair.map(onScreen) : [0, 0] };
  }, near);
  await page.screenshot({ path: path.join(out, 'a-closing-row-2081.png') });
  console.log(`seed 2081, hour ${hour}: "${rowText}", ${counts.battles} battles and ${counts.rows} rows; its fleets ${look.pair?.join(' and ')} ${(Math.hypot(near.w, near.h)).toFixed(1)} cells apart, from the row at ${look.m.toFixed(0)} m/px with ${look.ships.join(' and ')} of their ships on the screen`);
  expect(look.pair, "the row's two fleets found").not.toBeNull();
  expect(look.ships[0], "the first fleet's ships on the screen from the row").toBeGreaterThan(0);
  expect(look.ships[1], "the second fleet's ships on the screen from the row").toBeGreaterThan(0);
});
