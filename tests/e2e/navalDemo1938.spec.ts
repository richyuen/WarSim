import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { isShipFrame, Weapon } from '../../src/shared/unitLooks';
import { NATIONS_1938 } from '../../src/sim/scenario1938';
import { lookAt, open1938 } from './mapView';

// PLAN 4.7e, the AT of PLAN 4.7: the naval battle demo. The United Kingdom declares war on
// Italy (seed 4604, as 4.7c): the naval AI sails the fleets of both for each other's ports
// (PLAN 4.6c), and the first sea battle of the war is looked at in the three tiers:
//   T1 (1,000 m/px): the fleets' markers, engaged, and the sea control about them;
//   T2 (40 m/px): the ships by class, under way, firing (the naval look: a long arc, a splash);
//   T3 (15 m/px): a few ships at their length, their wakes, the shots, a ship going down.

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;

/** Steps an hour and waits for its snapshot. */
async function hour(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const w = window.__warsim!;
    const target = w.view!.lastTick + 1;
    await w.sim.step(1);
    await new Promise<void>((done) => {
      const wait = (): void => void (w.view!.lastTick >= target ? done() : setTimeout(wait, 4));
      wait();
    });
  });
}

/**
 * Over the wall time of the hour just stepped, the picture with the most of the battle drawn
 * (shots in flight, flashes and splashes): an hour's shots are over in a second of the page's.
 * Returns that count.
 */
async function busiest(page: Page, file: string): Promise<number> {
  let best = 0;
  for (let k = 0; k < 15; k++) {
    // What the page's own last frame drew.
    const n = await page.evaluate(() => {
      const f = window.__warsim!.view!.fire;
      return f.tracers.length + f.flashes + f.impacts;
    });
    if (n > best) {
      best = n;
      await page.screenshot({ path: file });
    }
    await page.waitForTimeout(50);
  }
  return best;
}

test('the naval battle demo: the first sea battle of a war at T1, T2 and T3', async ({ page }, info) => {
  test.setTimeout(500_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await open1938(page, 4604);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/4.7') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.evaluate(({ a, d }) => window.__warsim!.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: id('ENG'), d: id('ITA') });
  // An hour at a time, up to 40 days, until a fleet is in a sea battle.
  let fleet = -1;
  for (let h = 0; h < 40 * 24 && fleet < 0; h++) {
    await hour(page);
    fleet = await page.evaluate(() => {
      const v = window.__warsim!.view!;
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
      return best;
    });
  }
  expect(fleet, 'a sea battle in the first 40 days').toBeGreaterThan(0);
  const tick = await page.evaluate(() => window.__warsim!.view!.lastTick);
  const at = (await page.evaluate((f) => window.__warsim!.view!.formationPos(f), fleet))!;

  // T1: the markers of the fleets in the battle, engaged; then the sea control about them.
  await lookAt(page, at[0], at[1], 1000);
  const t1 = await page.evaluate((f) => {
    const v = window.__warsim!.view!;
    v.draw();
    const near = v.formationIds().filter((g) => v.formationAfloat(g) && v.formationEngaged(g));
    return { drawn: v.markerRects.some((r) => r.members.includes(f)), engaged: near.length };
  }, fleet);
  expect(t1.drawn, 'the fleet\'s marker at T1').toBe(true);
  expect(t1.engaged).toBeGreaterThanOrEqual(2);
  await page.screenshot({ path: path.join(out, 'naval-demo-t1.png') });
  await page.evaluate(() => window.__warsim!.hud.setMapMode('seaControl'));
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(out, 'naval-demo-t1-sea-control.png') });
  await page.evaluate(() => window.__warsim!.hud.setMapMode('political'));

  // T2 (40 m/px) and T3 (15 m/px) by turns, an hour at a time while the battle lasts: the ships
  // by class, the shots, the wrecks; each picture the busiest moment of its hour.
  const weapons = new Set<number>();
  let [ships, sunk, t2, t3] = [0, 0, 0, 0];
  for (let h = 0; h < 12 && !(t2 > 0 && t3 > 0 && sunk > 0); h++) {
    const pos = await page.evaluate((f) => window.__warsim!.view!.formationPos(f), fleet);
    if (!pos) break;
    // The two tiers by turns from the battle's first hour, while each still has no picture.
    const close = t2 > 0 && t3 === 0 ? true : t3 > 0 && t2 === 0 ? false : h % 2 === 1;
    await lookAt(page, pos[0], pos[1], close ? 15 : 40);
    await hour(page);
    const drawn = await busiest(page, path.join(out, close ? 'naval-demo-t3-try.png' : 'naval-demo-t2-try.png'));
    const seen = await page.evaluate(() => {
      const v = window.__warsim!.view!;
      return { weapons: v.fire.shots.map((s) => s.weapon), sunk: v.wrecks.wrecks.filter((w) => w.kind === 3).length, frames: Array.from({ length: v.elementCount }, (_, i) => v.elementFrame(i)) };
    });
    for (const w of seen.weapons) weapons.add(w);
    ships = Math.max(ships, seen.frames.filter((f) => isShipFrame(f)).length);
    sunk = Math.max(sunk, seen.sunk);
    // T2's picture: its first hour with a shot drawn (both sides are in it at the start); T3's:
    // its busiest hour.
    if (!close && drawn > 0 && t2 === 0) {
      t2 = drawn;
      renameSync(path.join(out, 'naval-demo-t2-try.png'), path.join(out, 'naval-demo-t2.png'));
    } else if (close && drawn > t3) {
      t3 = drawn;
      renameSync(path.join(out, 'naval-demo-t3-try.png'), path.join(out, 'naval-demo-t3.png'));
    }
    rmSync(path.join(out, 'naval-demo-t2-try.png'), { force: true });
    rmSync(path.join(out, 'naval-demo-t3-try.png'), { force: true });
  }
  console.log(`naval demo: fleet ${fleet} in battle from tick ${tick}; ${t1.engaged} fleets engaged; ${ships} ships drawn; weapons ${[...weapons].join(', ')}; ships going down ${sunk}; shots, flashes and splashes in the pictures: T2 ${t2}, T3 ${t3}`);
  expect(t2, 'the battle firing at T2').toBeGreaterThan(0);
  expect(t3, 'the battle firing at T3').toBeGreaterThan(0);
  expect(ships).toBeGreaterThan(3);
  expect(weapons).toContain(Weapon.naval);
});
