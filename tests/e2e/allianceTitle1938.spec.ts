import { expect, test } from '@playwright/test';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';
import { open1938 } from './mapView';

// PLAN 7.4f4 (the critic's N10: "seven alliances are all named Defensive Pact"): the nation panel
// tells one Defensive Pact from another by its founder, as the history does.

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;

test('two Defensive Pacts in the nation panel: each by its founder', async ({ page }) => {
  test.setTimeout(120_000);
  await open1938(page, 1938);
  await page.evaluate(({ swe, nor, por, ire }) => {
    const sim = window.__warsim!.sim;
    sim.command({ kind: 'createAlliance', leader: swe, members: [nor], nameKey: 'alliance.defensive' });
    sim.command({ kind: 'createAlliance', leader: por, members: [ire], nameKey: 'alliance.defensive' });
  }, { swe: id('SWE'), nor: id('NOR'), por: id('POR'), ire: id('IRE') });
  await page.evaluate(() => window.__warsim!.sim.step(1));
  await page.evaluate((n) => window.__warsim!.view!.select(n), id('NOR'));
  await expect(page.getByTestId('alliance-title')).toHaveText('Defensive Pact of Sweden');
  await page.evaluate((n) => window.__warsim!.view!.select(n), id('IRE'));
  await expect(page.getByTestId('alliance-title')).toHaveText('Defensive Pact of Portugal');
});
