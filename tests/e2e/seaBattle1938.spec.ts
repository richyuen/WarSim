import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { Weapon } from '../../src/shared/unitLooks';
import { NATIONS_1938 } from '../../src/sim/scenario1938';
import { lookAt, open1938 } from './mapView';

// PLAN 4.7c: a sea battle drawn. The United Kingdom at war with Italy (the naval AI sails its
// fleets for Italian ports, PLAN 4.6c): the first fleet in a sea battle, at T2, shows a ship's
// gunfire (the naval look: a long arc, a splash), and torpedoes and ships going down when it
// comes to them.

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;

test('a sea battle at T2: the ships\' gunfire, torpedo tracks, a ship going down', async ({ page }, info) => {
  test.setTimeout(400_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await open1938(page, 4604);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/4.7') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.evaluate(({ a, d }) => window.__warsim!.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: id('ENG'), d: id('ITA') });
  // An hour at a time, up to 40 days, until a fleet is in a sea battle (one lasts hours).
  const found = await page.evaluate(async () => {
    const w = window.__warsim!;
    const v = w.view!;
    for (let h = 0; h < 40 * 24; h++) {
      const target = v.lastTick + 1;
      await w.sim.step(1);
      await new Promise<void>((done) => {
        const wait = (): void => void (v.lastTick >= target ? done() : setTimeout(wait, 4));
        wait();
      });
      {
        // The fleet of a battle with a row (PLAN 7.19b: two fleets within reach of a ship's weapon;
        // the first engaged fleet was a carrier's, whose wings alone reached): the one nearest its pair.
        const b = v.seaBattles().find((s) => s.pair !== null);
        let best = -1;
        let bd = Infinity;
        for (const f of b ? v.formationIds() : []) {
          const p = v.formationAfloat(f) && v.formationEngaged(f) ? v.formationPos(f) : null;
          const d = p ? Math.hypot(p[0] - b!.pair!.x, p[1] - b!.pair!.y) : Infinity;
          if (d < bd) [best, bd] = [f, d];
        }
        if (best > 0) return { fleet: best, tick: v.lastTick };
      }
    }
    return { fleet: -1, tick: v.lastTick };
  });
  const fleet = found.fleet;
  expect(fleet, `no sea battle by tick ${found.tick}`).toBeGreaterThan(0);
  // The battle at T2, an hour at a time: the shots drawn and the ships going down.
  const weapons = new Set<number>();
  let ships = 0;
  let shot = false;
  for (let h = 0; h < 12; h++) {
    const at = await page.evaluate((f) => window.__warsim!.view!.formationPos(f), fleet);
    if (!at) break;
    await lookAt(page, at[0], at[1], 40);
    await page.evaluate(() => window.__warsim!.sim.step(1));
    await page.waitForTimeout(400);
    const seen = await page.evaluate(() => {
      const v = window.__warsim!.view!;
      return { weapons: v.fire.shots.map((s) => s.weapon), ships: v.wrecks.wrecks.filter((w) => w.kind === 3).length };
    });
    for (const w of seen.weapons) weapons.add(w);
    ships = Math.max(ships, seen.ships);
    if (!shot && seen.weapons.includes(Weapon.naval)) {
      await page.screenshot({ path: path.join(out, 'sea-battle-t2.png') });
      // Closer, the shots in flight: the hour's are drawn over its wall time.
      await lookAt(page, at[0], at[1], 12);
      await page.evaluate(() => window.__warsim!.sim.step(1));
      await page.waitForTimeout(450);
      await page.screenshot({ path: path.join(out, 'sea-battle-close.png') });
      shot = true;
    }
  }
  expect(weapons).toContain(Weapon.naval);
  console.log(`fleet ${fleet} in battle from tick ${found.tick}: weapons drawn ${[...weapons].join(', ')}, ships going down ${ships}`);
});
