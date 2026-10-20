import { expect, test } from '@playwright/test';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { EventKind } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { open1938 } from './mapView';

// PLAN 7.37f (critic run 10: three of fourteen worlds never saw a burst while four to six nations
// held 145 to 164 warheads; the user's of 2026-10-20: restraint is believable, and the game says
// why): the nation panel of a holder at war names why it does not strike. Germany, given 20
// warheads and missiles, at war with a Poland given 10 and missiles, fights to the death and has
// lost its land east of the Oder: desperate, but Poland's answer in kind holds it.

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;

test('the nation panel says why a holder at war does not strike: Germany deterred by Poland (PLAN 7.37f)', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await open1938(page, 5309);
  const [GER, POL] = [id('GER'), id('POL')];
  const [bx, by] = cellOf(13.4, 52.52, W, H);
  await page.evaluate(
    async ({ GER, POL, bx, by }) => {
      const s = window.__warsim!.sim;
      s.command({ kind: 'setSetting', key: 'nukesEnabled', value: true });
      s.command({ kind: 'grantWarheads', nation: GER, count: 20 });
      s.command({ kind: 'grantTech', nation: GER, tech: 'ballistic_missiles' });
      s.command({ kind: 'grantWarheads', nation: POL, count: 10 });
      s.command({ kind: 'grantTech', nation: POL, tech: 'ballistic_missiles' });
      s.command({ kind: 'declareWar', attacker: GER, defender: POL });
      await s.step(1);
      const war = (await s.inspect()).wars.find((w) => w.attackers.includes(GER) && w.defenders.includes(POL))!;
      s.command({ kind: 'setWarFightToDeath', war: war.id, side: 0, value: true });
      s.command({ kind: 'paintControl', nation: POL, x: bx, y: by + 20, r: 15 });
      await s.step(1);
    },
    { GER, POL, bx, by },
  );
  await page.evaluate(() => window.__warsim!.sim.step(24));
  await page.evaluate((n) => window.__warsim!.view!.select(n), GER);
  const line = page.getByTestId('nation-restraint');
  await expect(line).toHaveAttribute('data-reason', 'deterred', { timeout: 30_000 });
  await expect(line).toHaveText('Germany is deterred by Poland: a nuclear strike would bring its answer in kind.');
  // No German decision to strike in those days: the panel tells the day's decision.
  const rows = await page.evaluate(() => window.__warsim!.sim.history());
  expect(rows.filter((r) => r.kind === EventKind.NukeDecided && r.a === GER)).toEqual([]);
  await page.screenshot({ path: path.resolve('docs/evidence/7.37/f-restraint-panel.png') });
  // Poland, a holder at war that is winning, is not desperate.
  await page.evaluate((n) => window.__warsim!.view!.select(n), POL);
  await expect(page.getByTestId('nation-restraint')).toHaveAttribute('data-reason', 'notDesperate', { timeout: 30_000 });
});
