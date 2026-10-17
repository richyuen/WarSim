import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { RANK_LISTS } from '../../src/shared/ranking';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 1.31b AT: the Statistics ranking sorts by each metric and its rows select nations; the
// Statistics button hides it; one war banner per active war, clicking selects its attacker.

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;

test('statistics ranking and war banners', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const ranking = page.getByTestId('stats-ranking');
  if ((await ranking.count()) === 0) await page.getByTestId('stats-btn').click(); // persisted hidden by another test
  await expect(ranking).toBeVisible();

  // Each list: rows sorted by value, highest first (the lists of a life too, PLAN 7.4f28).
  for (const m of RANK_LISTS) {
    await page.getByTestId('rank-metric').selectOption(m);
    await expect(ranking).toHaveAttribute('data-metric', m);
    const values = (await ranking.getByTestId('rank-row').evaluateAll((rows) => rows.map((r) => Number(r.getAttribute('data-value'))))) as number[];
    expect(values.length).toBe(15);
    for (let i = 1; i < values.length; i++) expect(values[i - 1]!).toBeGreaterThanOrEqual(values[i]!);
  }
  // Land: the Soviet Union leads the 1938 world.
  await page.getByTestId('rank-metric').selectOption('land');
  await expect(ranking.getByTestId('rank-row').first()).toHaveAttribute('data-nation', String(id('SOV')));
  await expect(ranking.getByTestId('rank-row').first()).toContainText('1.');
  // Land is km², not cells (ADR-52): the Soviet Union has about 21.2 M km², and Denmark (Greenland,
  // fourth by cells on the Miller map) is not among the largest.
  const sov = Number(await ranking.getByTestId('rank-row').first().getAttribute('data-value'));
  expect(sov).toBeGreaterThan(20.5e6);
  expect(sov).toBeLessThan(21.9e6);
  await expect(ranking.locator(`[data-nation="${id('DEN')}"]`)).toHaveCount(0);
  // A row selects its nation (the nation panel opens).
  await ranking.getByTestId('rank-row').nth(1).click();
  const second = await ranking.getByTestId('rank-row').nth(1).getAttribute('data-nation');
  await expect(page.getByTestId('nation-panel')).toHaveAttribute('data-nation', second ?? '');

  // War banners: the Spanish Civil War (and the Sino-Japanese war) are on at the start; a new war adds one.
  const banners = page.getByTestId('war-banner');
  const before = await banners.count();
  expect(before).toBeGreaterThanOrEqual(1);
  await page.evaluate(({ a, d }) => window.__warsim!.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: id('GER'), d: id('POL') });
  await page.evaluate(() => window.__warsim!.sim.step(1));
  await expect(banners).toHaveCount(before + 1, { timeout: 20_000 });
  const germanWar = banners.filter({ hasText: 'Germany' }).filter({ hasText: 'Poland' });
  await expect(germanWar).toHaveCount(1);
  await germanWar.click();
  await expect(page.getByTestId('nation-panel')).toHaveAttribute('data-nation', String(id('GER')));

  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/1.31') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.screenshot({ path: path.join(out, 'ui-shell.png') });

  // The Statistics button hides and shows the ranking.
  await page.getByTestId('stats-btn').click();
  await expect(ranking).toHaveCount(0);
  await page.getByTestId('stats-btn').click();
  await expect(ranking).toBeVisible();
});

// PLAN 7.4f28 (the critic's N14: AoC marks the dead in its lists): Yugoslavia killed, its land
// split into nations. In "Revolts suffered" it leads, marked dead, without a flag, and a click on
// it opens nothing; in the lists of the present it is not there.
test('a dead nation in the lists of a life, marked', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const ranking = page.getByTestId('stats-ranking');
  if ((await ranking.count()) === 0) await page.getByTestId('stats-btn').click();
  const YUG = id('YUG');
  await page.evaluate(async (n) => {
    const sim = window.__warsim!.sim;
    sim.command({ kind: 'collapseNation', nation: n });
    await sim.step(24);
  }, YUG);
  await expect.poll(() => page.evaluate((n) => window.__warsim!.hud.stats.value!.dead.some((d) => d.id === n), YUG)).toBe(true);
  await page.getByTestId('rank-metric').selectOption('revolts');
  const first = ranking.getByTestId('rank-row').first();
  await expect(first).toHaveAttribute('data-nation', String(YUG));
  await expect(first).toHaveAttribute('data-dead', '1');
  await expect(first.getByTestId('rank-dead')).toBeVisible();
  await expect(first).toContainText('Yugoslavia');
  await expect(first.getByTestId('rank-flag')).toHaveCount(0);
  expect(Number(await first.getAttribute('data-value'))).toBeGreaterThanOrEqual(2);
  // The living below it are not marked.
  expect(await ranking.locator('[data-dead="1"]').count()).toBe(1);
  await page.screenshot({ path: path.join(path.resolve('docs/evidence/7.4'), 'f28-ranking-dead.png') });
  // A click on the dead opens no panel.
  await first.click();
  await expect(page.getByTestId('nation-panel')).toHaveCount(0);
  // Age: the dead among the living, at the years it lived.
  await page.getByTestId('rank-metric').selectOption('age');
  await expect(ranking.getByTestId('rank-row').first()).not.toHaveAttribute('data-dead', '1');
  // A list of the present has no dead.
  await page.getByTestId('rank-metric').selectOption('land');
  await expect(ranking.locator('[data-dead="1"]')).toHaveCount(0);
  await expect(ranking.locator(`[data-nation="${YUG}"]`)).toHaveCount(0);
});
