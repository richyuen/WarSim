import { expect, test } from '@playwright/test';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { NUKE_PROGRAMME_INCOME } from '../../src/sim/systems/nuclear';
import { grantTechs, techMask } from '../../src/sim/tech';
import { assets1938 } from '../helpers/earth';
import { open1938 } from './mapView';

// PLAN 7.37i (from 7.37g: Latvia and Lithuania went for the bomb on run 10's seeds 1307 and 8693
// with no word in the game): the day a nation's research gives it the atomic bomb, the history
// panel has a row of it. The world is made in Node as the unit test makes it (Latvia given the
// bomb's prerequisites and NUKE_PROGRAMME_INCOME, its line all but paid) and loaded into the game:
// seven years of play to 1945 would take the spec its hour.

const LAT = NATIONS_1938.findIndex((n) => n.tag === 'LAT') + 1;

function latviaOnTheEve(): string {
  const s = new Sim({ scenario: '1938', seed: 1307, assets: assets1938(SIZE_1938.w) });
  const w = s.world;
  const techs = w.rules!.techs;
  const bomb = techs.findIndex((t) => t.id === 'atomic_bomb');
  grantTechs(w, LAT, techMask(techs.map((t, i) => (t.year <= 1945 && i !== bomb ? i : -1)).filter((i) => i >= 0)));
  w.nations.cols.income[LAT] = NUKE_PROGRAMME_INCOME;
  w.nations.cols.gold[LAT] = 1000;
  const line = w.research.create();
  w.research.cols.nation[line] = LAT;
  w.research.cols.tech[line] = bomb;
  w.research.cols.paid[line] = techs[bomb]!.gold - 1e-4;
  return Buffer.from(s.save()).toString('base64');
}

test('a new nuclear power is in the history: Latvia learns the bomb (PLAN 7.37i)', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await open1938(page, 1307);
  const saved = latviaOnTheEve();
  await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    await window.__warsim!.sim.load(bytes);
  }, saved);
  await page.evaluate(() => window.__warsim!.sim.step(24 * 3));
  await page.getByTestId('history-btn').click();
  await page.getByTestId('history-kind').selectOption({ label: 'New nuclear power' });
  await expect(page.getByTestId('history-row')).toHaveCount(1);
  await expect(page.getByTestId('history-row')).toContainText(/Latvia has learned to build the atomic bomb, with the world's (largest|\d+(st|nd|rd|th) largest) income/);
  await page.screenshot({ path: path.resolve('docs/evidence/7.37/i-nuclear-power-row.png') });
});
