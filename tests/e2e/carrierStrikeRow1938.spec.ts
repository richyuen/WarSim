import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 7.35a (critic run 9, naval 6: "Italy–UK: 25 six-hour samples with a live battle on days 6
// to 12, none with a row"): a battle a carrier's wings fight alone had no ticker row (PLAN 7.19b,
// ADR-494), and on seed 2251 its strikes sank 74 of the 207 ships lost in 12 days. Such a battle
// now has a row of its own, after the battles of ships within reach, that flies to the fleet the
// wings strike: its ships on the screen, and the strike's bombs burst on them in its hours.

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

test("a carrier's strike has its row, which shows the struck ships and the bombs on them (the critic's Italy–UK, seed 2251)", async ({ page }, info) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=2251');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/7.35') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.evaluate(({ a, d }) => window.__warsim!.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: id('ITA'), d: id('ENG') });
  // The British carriers' first battle (Germany's war on Britain joins Italy's) is at hour 41.
  let hour = await stepHours(page, 36);
  const strikeRow = (): number => {
    const all = window.__warsim!.view!.seaBattles();
    const k = all.filter((b) => b.pair === null && b.strike !== null).findIndex(() => true);
    return k < 0 ? -1 : all.filter((b) => b.pair !== null).length + k;
  };
  while (hour < 200 && (await page.evaluate(strikeRow)) < 0) hour = await stepHours(page, 1);
  const k = await page.evaluate(strikeRow);
  expect(k, "a battle of a carrier's wings alone by hour 200").toBeGreaterThanOrEqual(0);
  const battle = await page.evaluate(() => window.__warsim!.view!.seaBattles().find((b) => b.pair === null && b.strike !== null)!);
  const strike = battle.strike!;
  const row = page.getByTestId('sea-battle-row').nth(k);
  await expect(row).toContainText('Carrier strike');
  // PLAN 7.35c (left by 7.35a): its tooltip says what it shows; since PLAN 7.84a the carrier and the struck fleet.
  await expect(row).toHaveAttribute('title', 'Show the carrier and the struck fleet');
  const rowText = await row.innerText();
  await row.click();
  await landed(page);
  // The struck fleet: the enemy's fleets standing at the strike's place, their ships on the screen.
  const look = (s: { x: number; y: number; by: number }): Promise<{ m: number; ships: number; bombs: number; hits: number; planes: number }> =>
    page.evaluate(async (s) => {
      const v = window.__warsim!.view!;
      v.draw(performance.now());
      const cam = v.controller.cam;
      const struck = new Set<number>();
      for (const f of (await window.__warsim!.sim.inspect(true)).formations) {
        const p = v.formationPos(f.id);
        if (f.nation !== s.by && v.formationAfloat(f.id) && p && Math.hypot(p[0] - s.x, p[1] - s.y) < 0.3) struck.add(f.id);
      }
      let ships = 0;
      for (let i = 0; i < v.elementCount; i++) {
        if (!struck.has(v.elementFormation[i]!)) continue;
        const x = (v.elementX[i]! - cam.cx) * cam.scale + window.innerWidth / 2;
        const y = (v.elementY[i]! - cam.cy) * cam.scale + window.innerHeight / 2;
        if (x >= 0 && x <= window.innerWidth && y >= 0 && y <= window.innerHeight && document.elementFromPoint(x, y)?.tagName === 'CANVAS') ships++;
      }
      return { m: v.metresPerPx, ships, bombs: v.airFx.shown[1]!, hits: v.airFx.shown[3]!, planes: v.sortieMarks.length };
    }, s);
  const first = await look(strike);
  await page.screenshot({ path: path.join(out, 'a-strike-row-2251.png') });
  // Its hours: a strike every CARRIER_CYCLE (4) hours while the battle goes on.
  let bombs = 0;
  let planes = 0;
  let shot = false;
  for (let h = 0; h < 8; h++) {
    hour = await stepHours(page, 1);
    const r = await look(strike);
    bombs = Math.max(bombs, r.bombs + r.hits);
    planes = Math.max(planes, r.planes);
    if (!shot && r.bombs + r.hits > 0) {
      await page.screenshot({ path: path.join(out, 'a-strike-bombs-2251.png') });
      shot = true;
    }
  }
  console.log(`seed 2251, hour ${hour}: "${rowText}", the struck fleet at (${strike.x.toFixed(1)}, ${strike.y.toFixed(1)}), from the row at ${first.m.toFixed(0)} m/px with ${first.ships} of its ships on the screen; in the next 8 hours at most ${bombs} strikes' bombs and ${planes} sorties drawn`);
  expect(first.ships, 'the struck ships on the screen from the row').toBeGreaterThan(0);
  expect(bombs, "the strike's bombs drawn on them in its hours").toBeGreaterThan(0);
});
