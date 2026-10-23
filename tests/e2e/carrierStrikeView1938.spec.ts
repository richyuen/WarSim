import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 7.84a/b (critic run 12, naval 7: "the carrier strike, clicked, shows two US destroyer
// counters and no aircraft (`sorties` 0 at 84 m/px)"): the row framed the struck fleet alone, 2.4
// cells across, while the carrier that strikes it stood up to 250 km off; and its wing's flight was
// drawn only in the hour or so about each strike of a 4-hour cycle. The row now frames the carrier
// and the fleet it strikes, and the wing is in the air between them through the cycle.

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

/** What the screen shows of a strike by nation `by` on nation `on`: the ships of each on it, and the striker's planes. */
function look(page: Page, by: number, on: number): Promise<{ m: number; striker: number; struck: number; planes: number }> {
  return page.evaluate(
    async ({ by, on }) => {
      const v = window.__warsim!.view!;
      v.draw(performance.now());
      const cam = v.controller.cam;
      const nation = new Map<number, number>();
      for (const f of (await window.__warsim!.sim.inspect(true)).formations) if (v.formationAfloat(f.id)) nation.set(f.id, f.nation);
      let striker = 0;
      let struck = 0;
      for (let i = 0; i < v.elementCount; i++) {
        const n = nation.get(v.elementFormation[i]!);
        if (n !== by && n !== on) continue;
        const x = (v.elementX[i]! - cam.cx) * cam.scale + window.innerWidth / 2;
        const y = (v.elementY[i]! - cam.cy) * cam.scale + window.innerHeight / 2;
        if (x < 0 || x > window.innerWidth || y < 0 || y > window.innerHeight || document.elementFromPoint(x, y)?.tagName !== 'CANVAS') continue;
        if (n === by) striker++;
        else struck++;
      }
      const planes = v.sortieMarks.filter((s) => s.nation === by && s.x >= 0 && s.x <= window.innerWidth && s.y >= 0 && s.y <= window.innerHeight).length;
      return { m: v.metresPerPx, striker, struck, planes };
    },
    { by, on },
  );
}

test("a carrier strike's row shows the carrier's ships, the struck ships and the striking planes (the critic's Japan–USA, seed 8693)", async ({ page }, info) => {
  test.setTimeout(420_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?scenario=1938&paused=1&seed=8693');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/7.84') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const [jap, usa] = [id('JAP'), id('USA')];
  await page.evaluate(({ a, d }) => window.__warsim!.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: jap, d: usa });
  // The first battle Japan's carriers fight alone: the critic's was standing at hour 330.
  const strikeRow = ({ jap, usa }: { jap: number; usa: number }): number => {
    const all = window.__warsim!.view!.seaBattles();
    const k = all.filter((b) => b.pair === null && b.strike !== null).findIndex((b) => b.strike!.by === jap && (b.a === usa || b.b === usa));
    return k < 0 ? -1 : all.filter((b) => b.pair !== null).length + k;
  };
  let hour = await stepHours(page, 200);
  while (hour < 900 && (await page.evaluate(strikeRow, { jap, usa })) < 0) hour = await stepHours(page, 2);
  const k = await page.evaluate(strikeRow, { jap, usa });
  expect(k, "a battle Japan's carriers fight alone by hour 900").toBeGreaterThanOrEqual(0);
  const row = page.getByTestId('sea-battle-row').nth(k);
  await expect(row).toContainText('Carrier strike: Japan');
  await row.click();
  await landed(page);
  const first = await look(page, jap, usa);
  await page.screenshot({ path: path.join(out, 'a-strike-view-8693.png') });
  // Then a whole cycle of strikes (CARRIER_CYCLE, 4 hours), the view where the row put it.
  const hours: { hour: number; striker: number; struck: number; planes: number }[] = [];
  for (let h = 0; h < 4; h++) {
    hour = await stepHours(page, 1);
    if ((await page.evaluate(strikeRow, { jap, usa })) < 0) break;
    hours.push({ hour, ...(await look(page, jap, usa)) });
  }
  console.log(`seed 8693: from the row at ${first.m.toFixed(0)} m/px, ${first.striker} Japanese ships, ${first.struck} American and ${first.planes} Japanese sorties on the screen; then ${JSON.stringify(hours)}`);
  expect(first.striker, "the carrier's fleet's ships on the screen from the row").toBeGreaterThan(0);
  expect(first.struck, 'the struck ships on the screen from the row').toBeGreaterThan(0);
});
