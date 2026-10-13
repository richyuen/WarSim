import { expect, test, type Page } from '@playwright/test';
import type {} from '../../src/app/testApi';
import type { Command } from '../../src/shared/commands';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 4.9 AT (the critic's R4-B2): a player can invade, and a refused order says why. Britain,
// played, at war with Germany: a division in London ordered onto the German coast embarks at
// London, sails and lands, or is thrown back with a row on the screen. Then each refusal the
// page can cause from this game is told within a second: aboard, no water by the target, a
// fleet sent onto land, a fleet sent to water no way leads to, no transports. (No port: the
// Swiss case, `orderNews1938.spec.ts`. No way by land and a march barred on its way: by the same
// path, `rejectReasons1938.test.ts`.)

const { w: W, h: H } = SIZE_1938;
const ENG = NATIONS_1938.findIndex((n) => n.tag === 'ENG') + 1;
const GER = NATIONS_1938.findIndex((n) => n.tag === 'GER') + 1;
const cell = (lon: number, lat: number): [number, number] => cellOf(lon, lat, W, H).map((v) => Math.floor(v) + 0.5) as [number, number];
const CUXHAVEN = cell(8.7, 53.87);
const KASSEL = cell(9.5, 51.3);
const CASPIAN = cell(50.5, 42.0);

const command = (page: Page, cmd: Command): Promise<void> => page.evaluate((c) => window.__warsim!.hud.command(c), cmd);
const order = (page: Page, id: number, [x, y]: [number, number]): Promise<void> => command(page, { kind: 'moveFormation', id, x, y, nation: ENG });
/** The newest row of order news; it says `text` within a second. */
async function told(page: Page, kind: string, text: string): Promise<void> {
  const row = page.getByTestId('order-news').last();
  await expect(row).toHaveAttribute('data-order', kind, { timeout: 1000 });
  await expect(row).toContainText(text, { timeout: 1000 });
}

/** British formations, the nearest to (lon, lat) first: fleets or land ones. */
function british(page: Page, fleets: boolean, [x, y]: [number, number]): Promise<number[]> {
  return page.evaluate(({ ENG, fleets, x, y }) => {
    const v = window.__warsim!.view!;
    return v
      .formationsOf(ENG)
      .filter((id) => v.formationAfloat(id) === fleets)
      .map((id) => [id, Math.hypot(v.formationPos(id)![0] - x, v.formationPos(id)![1] - y)] as const)
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => id);
  }, { ENG, fleets, x, y });
}

test('a British division in London ordered onto the German coast lands, or is thrown back and says so; each refusal says why', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=2207');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.waitForFunction((n) => window.__warsim!.view!.formationsOf(n).length > 3, ENG, { timeout: 60_000 });
  await page.evaluate((n) => window.__warsim!.view!.select(n), ENG);
  await page.getByTestId('take-control').click();
  await expect(page.getByTestId('release-control')).toBeVisible();
  await command(page, { kind: 'declareWar', attacker: ENG, defender: GER });

  // A British division in London (God Mode: none stands there on this seed), by its port.
  const LONDON = cell(-0.12, 51.5);
  await command(page, { kind: 'spawnFormation', nation: ENG, x: LONDON[0], y: LONDON[1], strength: 1, template: 0 });
  await page.evaluate(() => window.__warsim!.sim.step(1));
  await page.waitForFunction(({ ENG, x, y }) => window.__warsim!.view!.formationsOf(ENG).some((id) => !window.__warsim!.view!.formationAfloat(id) && Math.hypot(window.__warsim!.view!.formationPos(id)![0] - x, window.__warsim!.view!.formationPos(id)![1] - y) < 1), { ENG, x: LONDON[0], y: LONDON[1] }, { timeout: 10_000 });
  const [div] = await british(page, false, LONDON);
  expect(div, 'a British division in London').toBeGreaterThan(0);
  await order(page, div!, CUXHAVEN);
  await page.evaluate(() => window.__warsim!.sim.step(3));
  // Aboard: a second order is refused, and says so (it proves the embarking too).
  await order(page, div!, KASSEL);
  await told(page, 'refused', 'aboard transports');

  // The voyage: it lands near Cuxhaven, or is thrown back (and then comes ashore elsewhere), told.
  // The order's news (all kept by the page; beside the panel the ticker shows the newest).
  const news = (): Promise<string[]> => page.evaluate((id) => window.__warsim!.hud.orderNews.value.filter((n) => n.id === id).map((n) => n.kind), div!);
  let ashore = false;
  let kinds: string[] = [];
  for (let d = 0; d < 10 && !ashore && !kinds.includes('landedAway'); d++) {
    await page.evaluate(() => window.__warsim!.sim.step(24));
    kinds = await news();
    const at = await page.evaluate((id) => window.__warsim!.view!.formationPos(id), div!);
    ashore = at !== null && Math.hypot(at[0] - CUXHAVEN[0], at[1] - CUXHAVEN[1]) < 8 && !kinds.includes('repulsed');
  }
  console.log(`the landing: ${ashore ? 'ashore by Cuxhaven' : kinds.join(', ')}`);
  expect(ashore || kinds.includes('repulsed') || kinds.includes('landedAway'), 'ashore by Cuxhaven, or thrown back or brought back, told').toBe(true);
  if (!ashore) await expect(page.getByTestId('order-news').last()).toHaveAttribute('data-order', kinds.at(-1)!);

  // No water by the target: a new division at London, where the transports are back, to Kassel.
  const before = new Set(await british(page, false, LONDON));
  await command(page, { kind: 'spawnFormation', nation: ENG, x: LONDON[0], y: LONDON[1], strength: 1, template: 0 });
  await page.evaluate(() => window.__warsim!.sim.step(1));
  await page.waitForFunction((n) => window.__warsim!.view!.formationsOf(n).length > 0, ENG);
  await expect.poll(async () => (await british(page, false, LONDON)).filter((id) => !before.has(id)).length).toBe(1);
  const [div2] = (await british(page, false, LONDON)).filter((id) => !before.has(id));
  await order(page, div2!, KASSEL);
  await told(page, 'refused', 'no water near the target');
  // A fleet onto land, and to water no way leads to.
  const [fleet] = await british(page, true, LONDON);
  await order(page, fleet!, KASSEL);
  await told(page, 'refused', 'only to water or a port');
  await order(page, fleet!, CASPIAN);
  await told(page, 'refused', 'no way over the water');
  // No transports: every British fleet removed (God Mode), a division at Birmingham to Cuxhaven.
  for (const f of await british(page, true, LONDON)) await command(page, { kind: 'removeFormation', id: f });
  const [inland] = await british(page, false, cell(-1.9, 52.48));
  await order(page, inland!, CUXHAVEN);
  await told(page, 'refused', 'no transports');
});
