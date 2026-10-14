import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 5.11 AT (the critic's R5-B1, third): the air war is read afterwards. A month into
// Germany's war on Poland (seed 1): the ticker and the history have its rows (5.11a), and the
// nation panel a nation's aircraft, its losses and what strikes took of it (5.11b).

const id = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;
const int = (s: string | null): number => Number((s ?? '').replace(/[^0-9]/g, ''));
/** The first number of a text ("399 (21)": 399), its separators dropped. */
const first = (s: string | null): number => Number(((s ?? '').match(/[\d,]+/)?.[0] ?? '').replace(/,/g, ''));

test('a month of war: the air war in the ticker, the history and the nation panel', async ({ page }, info) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/5.11') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.evaluate(({ a, d }) => window.__warsim!.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: id('GER'), d: id('POL') });
  // Past the first month's end (1 February 1938).
  await page.evaluate(() => window.__warsim!.sim.step(24 * 31 + 2));
  await page.waitForFunction(() => window.__warsim!.view!.lastTick >= 24 * 31 + 2);

  // The ticker: the month's largest air war and raids.
  await expect(page.getByText(/fought in the air this month/).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/air force struck .+ this month/).first()).toBeVisible();

  // The nation panel: Germany's aircraft and losses, Poland's toll of the strikes.
  await page.evaluate((n) => window.__warsim!.view!.select(n), id('GER'));
  await expect(page.getByTestId('panel-air')).toBeVisible({ timeout: 20_000 });
  const ger = { aircraft: first(await page.getByTestId('stat-aircraft').textContent()), lost: int(await page.getByTestId('stat-air-lost').textContent()) };
  expect(ger.aircraft, 'Germany\'s aircraft').toBeGreaterThan(0);
  expect(ger.lost, 'Germany\'s aircraft lost').toBeGreaterThan(0);
  await page.screenshot({ path: path.join(out, 'air-panel-germany.png') });
  await page.evaluate((n) => window.__warsim!.view!.select(n), id('POL'));
  await expect(page.getByTestId('panel-air')).toBeVisible({ timeout: 20_000 });
  const bombed = int(await page.getByTestId('stat-bombed').textContent());
  expect(bombed, 'what the strikes took of Poland').toBeGreaterThan(0);

  // The history: its rows, by name and with their numbers.
  await page.evaluate(() => window.__warsim!.hud.toggleHistory());
  const history = page.getByTestId('history-panel');
  await expect(history.getByText(/fought in the air this month: .+ lost [\d,]+ aircraft/).first()).toBeVisible({ timeout: 20_000 });
  await expect(history.getByText(/Germany's air force struck Poland this month: [\d,]+ men, guns and vehicles lost/)).toBeVisible();
  await page.screenshot({ path: path.join(out, 'air-history.png') });
  process.stderr.write(`1 February 1938: Germany ${ger.aircraft} aircraft, ${ger.lost} lost; Poland's toll of the strikes ${bombed}\n`);
});
