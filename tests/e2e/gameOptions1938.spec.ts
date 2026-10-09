import { expect, test, type Page } from '@playwright/test';
import type {} from '../../src/app/testApi';
import type { Inspection } from '../../src/shared/protocol';
import { SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 1.39b1 AT: e2e starts games with each new-game option and verifies the effect in the sim
// (looping map, random aggression, random traits, starting gold, combat-efficiency mode). The
// options are chosen in the settings panel; New game reloads with them in the URL.

const inspect = (page: Page): Promise<Inspection> => page.evaluate(() => window.__warsim!.sim.inspect());
async function ready(page: Page): Promise<void> {
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
}
const living = (s: Inspection) => s.nations.filter((n) => n.living);

test('new-game options from the settings panel take effect in the sim', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=77');
  await ready(page);
  const plain = await inspect(page);
  expect(plain.settings.loopingMap).toBe(true);

  // Every option off its default, then New game.
  await page.getByTestId('settings-btn').click();
  await page.getByTestId('opt-looping').selectOption('off');
  await page.getByTestId('opt-aggression').selectOption('random');
  await page.getByTestId('opt-traits').selectOption('random');
  await page.getByTestId('opt-gold').selectOption('equal');
  await page.getByTestId('opt-ce').selectOption('static');
  await Promise.all([page.waitForURL(/looping=0/), page.getByTestId('settings-new-game').click()]);
  expect(page.url()).toMatch(/seed=77/);
  for (const p of ['looping=0', 'aggr=random', 'traits=random', 'gold=equal', 'ce=static']) expect(page.url()).toContain(p);
  await ready(page);

  const s = await inspect(page);
  expect(s.seed).toBe(77);
  expect(s.settings.loopingMap).toBe(false);
  expect(s.settings.ceMode).toBe('static');
  // Equal starting gold for every living nation.
  expect(new Set(living(s).map((n) => n.gold)).size).toBe(1);
  // Aggression and income multipliers differ from the plain game of the same seed.
  const byId = new Map(plain.nations.map((n) => [n.id, n]));
  expect(living(s).filter((n) => n.aggression !== byId.get(n.id)!.aggression).length).toBeGreaterThan(10);
  expect(living(s).filter((n) => n.incomeMult !== byId.get(n.id)!.incomeMult).length).toBeGreaterThan(10);
  // The map renders without wrap copies: far east of the map shows no land again.
  expect(await page.evaluate(() => window.__warsim!.view!.wrapsX)).toBe(false);
  // Zoomed out as far as it goes the view is wider than the map, and the points beside it are
  // no cell (PLAN 3.12Rse2: folded, a click there was a click on the other edge of the map).
  await page.mouse.move(700, 400);
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 2000);
  const row = await page.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 500));
    const v = window.__warsim!.view!;
    const xs: (number | null)[] = [];
    for (let sx = 1; sx < 1400; sx += 2) xs.push(v.cellAt(sx, 400)?.[0] ?? null);
    return { xs, nations: [v.nationAt(1, 400), v.nationAt(1399, 400)] };
  });
  const on = row.xs.filter((x): x is number => x !== null);
  expect([row.xs[0], row.xs[row.xs.length - 1]]).toEqual([null, null]);
  expect(row.nations).toEqual([0, 0]);
  expect(on.length).toBeGreaterThan(300);
  // From the first column to the last, once: no column comes twice.
  expect(on[0]).toBeLessThan(8);
  expect(on[on.length - 1]).toBeGreaterThan(SIZE_1938.w - 9);
  for (let i = 1; i < on.length; i++) expect(on[i]!).toBeGreaterThanOrEqual(on[i - 1]!);

  // The panel starts from this game's options; a new game with the scenario's options again.
  await page.getByTestId('settings-btn').click();
  await expect(page.getByTestId('opt-looping')).toHaveValue('off');
  await page.getByTestId('opt-looping').selectOption('on');
  await page.getByTestId('opt-aggression').selectOption('scenario');
  await page.getByTestId('opt-traits').selectOption('scenario');
  await page.getByTestId('opt-gold').selectOption('scenario');
  await page.getByTestId('opt-ce').selectOption('scenario');
  await Promise.all([page.waitForURL((u) => !u.search.includes('looping')), page.getByTestId('settings-new-game').click()]);
  await ready(page);
  const back = await inspect(page);
  expect(back.settings.loopingMap).toBe(true);
  expect(living(back).map((n) => n.gold)).toEqual(living(plain).map((n) => n.gold));
});
