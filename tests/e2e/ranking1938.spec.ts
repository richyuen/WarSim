import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { RANK_METRICS } from '../../src/shared/ranking';
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

  // Each metric: rows sorted by value, highest first.
  for (const m of RANK_METRICS) {
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
