import { expect, test } from '@playwright/test';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { EventKind } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { open1938 } from './mapView';

// PLAN 7.37b3 (critic runs 9 and 10, `c10_g2_5309_CZS.json`: Czechoslovakia, armed in the editor,
// dies holding its 10 warheads and "nothing in play says the means are lost"): the critic's set-up
// on seed 5309, a strategic bomber group placed at Prague and 10 warheads in the editor, Germany's
// war on it. Prague's airbase falls (day 10 or 11 then, day 15 at `9ffb0274`) and its bombers
// with it: the history says so.

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;

test("a holder's last means of delivery lost is in the history: Czechoslovakia's bombers lost with Prague (PLAN 7.37b3)", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await open1938(page, 5309);
  const [CZS, GER] = [id('CZS'), id('GER')];
  await page.getByTestId('editor-btn').click();
  await page.getByTestId('editor-nation').selectOption(String(CZS));
  await page.getByTestId('editor-tool-wing').click();
  await page.getByTestId('editor-template').selectOption({ label: 'Strategic bomber group' });
  const [x, y] = cellOf(14.42, 50.08, W, H);
  await page.evaluate(({ x, y }) => window.__warsim!.view!.controller.set({ cx: x + 0.5, cy: y + 0.5, scale: 3 }), { x, y });
  await page.waitForTimeout(200);
  await page.mouse.click(700, 400);
  await expect(page.getByTestId('editor-means')).toHaveCount(0);
  await page.getByTestId('editor-warheads').fill('10');
  await page.getByTestId('editor-warheads-add').click();
  await expect(page.getByTestId('editor-means')).toContainText('strategic bomber group at Prague');
  await page.getByTestId('editor-btn').click();
  await page.evaluate(({ a, d }) => window.__warsim!.sim.command({ kind: 'declareWar', attacker: a, defender: d }, true), { a: GER, d: CZS });
  // The day the airbase falls moves with the world's rules (13 days at 7.37b3, 14 at ADR-634, 15 at `9ffb0274`):
  // the war is stepped a day at a time until the row is in the history, within 30 days.
  const day = await page.evaluate(async (KIND) => {
    const sim = window.__warsim!.sim;
    for (let d = 1; d <= 30; d++) {
      await sim.step(24);
      if ((await sim.history()).some((r) => r.kind === KIND)) return d;
    }
    return -1;
  }, EventKind.NukeMeansLost);
  expect(day, "the day Czechoslovakia's means are lost, within 30 days of the war").toBeGreaterThan(0);
  await page.getByTestId('history-btn').click();
  await page.getByTestId('history-kind').selectOption({ label: 'Nuclear means lost' });
  await expect(page.getByTestId('history-row')).toHaveCount(1);
  await expect(page.getByTestId('history-row')).toContainText('Czechoslovakia lost its last means to deliver its warheads: Germany took its airbase near Prague, and its strategic bombers were lost with it');
  await page.screenshot({ path: path.resolve('docs/evidence/7.37/b3-means-lost-row.png') });
});
