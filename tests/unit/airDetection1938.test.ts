import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { AIR_DETECTION } from '../../src/sim/systems/airSuperiority';
import { findSeaBattles, fleetDetection, seaKm } from '../../src/sim/systems/navalCombat';
import { airOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 5.8t2: air superiority on a fleet's detection: × (1 + AIR_DETECTION × (2s − 1)), s its
// side's superiority in its air zone. A battle squadron under its own air sees an enemy it does
// not see under no one's; under the enemy's it sees less.

const [JAP, USA, SWE] = ['JAP', 'USA', 'SWE'].map(nationId) as [number, number, number];
const [SX, SY] = cellOf(-170, 20, SIZE_1938.w, SIZE_1938.h);
const tmpl = (w: World, id: number): string => TEMPLATES_1938[w.formations.cols.template[id]!]!.id;
const fleetOf = (w: World, nation: number, t: string): number => [...w.formations.ids()].find((id) => w.isFleet(id) && w.formations.cols.nation[id] === nation && tmpl(w, id) === t)!;
/** Japan and the United States at war, a battle squadron of each `km` apart in the open Pacific, every other fleet far off; the air over them to `air`. */
function sea(km: number, air: number): { w: World; jap: number; usa: number } {
  const w = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) }).world;
  w.wars.start([JAP], [USA], 0);
  const c = w.formations.cols;
  const jap = fleetOf(w, JAP, 'battle_squadron');
  const usa = fleetOf(w, USA, 'battle_squadron');
  for (const id of w.formations.ids()) if (w.isFleet(id) && id !== jap && id !== usa) [c.x[id], c.y[id]] = [5.5, 5.5];
  [c.x[jap], c.y[jap]] = [SX, SY];
  let dx = 0;
  while (seaKm(w, SX, SY, SX + dx, SY) < km) dx += 0.01;
  [c.x[usa], c.y[usa]] = [SX + dx, SY];
  const zone = airOf(w).zoneOf[Math.floor(SY) * w.cells.w + Math.floor(SX)]!;
  expect(airOf(w).zoneOf[Math.floor(SY) * w.cells.w + Math.floor(SX + dx)]).toBe(zone);
  if (air) w.airPower.set(zone, new Map([[air, 900]]));
  return { w, jap, usa };
}
const fight = (km: number, air: number): boolean => {
  const { w, jap } = sea(km, air);
  return findSeaBattles(w).some((b) => b.fleets.includes(jap));
};

describe('air superiority on a fleet\'s detection (PLAN 5.8t2)', () => {
  it('× 1 + AIR_DETECTION under its own air, × 1 − AIR_DETECTION under the enemy\'s, × 1 under none and a bystander\'s', () => {
    expect(AIR_DETECTION).toBe(0.25);
    const none = sea(100, 0);
    const base = fleetDetection(none.w, none.jap);
    expect(base).toBeGreaterThan(0);
    expect(fleetDetection(sea(100, SWE).w, none.jap)).toBe(base);
    const own = sea(100, JAP);
    expect(fleetDetection(own.w, own.jap)).toBeCloseTo(1.25 * base, 9);
    expect(fleetDetection(own.w, own.usa)).toBeCloseTo(0.75 * fleetDetection(none.w, none.usa), 9);
  });

  it('a pair just beyond what either sees under no one\'s air: in battle under either side\'s', () => {
    // The farthest either sees the other under no air, by the battles found.
    let far = 1;
    while (fight(far + 1, 0)) far++;
    expect(far).toBeGreaterThan(5);
    const beyond = far * 1.1;
    expect(fight(beyond, 0)).toBe(false);
    expect(fight(beyond, JAP)).toBe(true);
    expect(fight(beyond, USA)).toBe(true);
  });
});
