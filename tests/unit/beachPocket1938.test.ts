import { describe, expect, it } from 'vitest';
import { neighbours4 } from '../../src/sim/nav/grid';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { CONTROL_DAYS, seaControlOf } from '../../src/sim/systems/seaControl';
import { BEACH_SUPPLY, SUPPLY_REFRESH_HOURS, blocOf, refreshBeaches, refreshSupplyNetwork } from '../../src/sim/systems/supply';
import { declareWar } from '../../src/sim/systems/war';
import { navOf, seaOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 7.75 (ADR-630, the user's decision, ADR-622's scope b): from 7.70a a coast cell was a beach
// source only on a land where its bloc owned and controlled no city, so a pocket on a land with a
// city of the bloc's starved: Britain's bloc holds India, and a British division ashore in France
// or Norway, beyond the reach of its network, was dry in 8 hours. Since, a held coast cell the
// network does not reach is a beach source wherever it lies. The United Kingdom in 1938, a British
// division put ashore on an enemy coast with no port near, on a land where Britain's bloc holds a
// city, far from every cell of the bloc's: fed for 30 days at a beach's rate; a British formation in
// the network on that land fed whole; the enemy holding the zones by that land, dry. Before, the
// pocket dry in each. And the beach's layer a refresh in full gives is the one the hours gave.

const { w: W, h: H } = SIZE_1938;
const ENG = NATIONS_1938.findIndex((n) => n.tag === 'ENG') + 1;
const DAYS = 30;

/** The world at war, the landed division, a British formation in the network on its land, its enemy, and the zones beside the beach. */
function landed(): { s: Sim; div: number; home: number; enemy: number; zones: number[] } {
  const s = new Sim({ scenario: '1938', seed: 7701, assets: assets1938(W) });
  const w = s.world;
  s.command({ kind: 'setSetting', key: 'aiEnabled', value: false });
  s.step(1);
  const comp = navOf(w).grid.component;
  const z = seaOf(w);
  const ctl = w.cells.controller;
  const c = w.formations.cols;
  const bloc = blocOf(w, ENG);
  // The lands where Britain's bloc holds a city, the cells it controls, the ports, and where formations stand.
  const british = new Set<number>();
  w.cities.forEach((city) => {
    const at = w.cities.cols.cell[city]!;
    if (ctl[at] !== 0 && blocOf(w, ctl[at]!) === bloc) british.add(comp[at]!);
  });
  const held = new Set<number>();
  for (let k = 0; k < W * H; k++) if (ctl[k] !== 0 && blocOf(w, ctl[k]!) === bloc) held.add(k);
  const ports = new Set(w.ports.map((p) => p.cell));
  const standing = new Set<number>();
  w.formations.forEach((f) => {
    if (!w.offLand(f)) standing.add(Math.floor(c.y[f]!) * W + Math.floor(c.x[f]!));
  });
  const near = (k: number, r: number, set: Set<number>): boolean => {
    const kx = k % W;
    const ky = Math.floor(k / W);
    for (let y = Math.max(0, ky - r); y <= Math.min(H - 1, ky + r); y++) for (let x = Math.max(0, kx - r); x <= Math.min(W - 1, kx + r); x++) if (set.has(y * W + x)) return true;
    return false;
  };
  // The first coast cell of a nation outside Britain's bloc, not its ally, on a land where the bloc
  // holds a city, by an open zone, no port within 4 cells, no formation within 8, and no cell of the
  // bloc's within 8 (beyond its network's reach).
  let beach = -1;
  for (let k = 0; k < W * H && beach < 0; k++) {
    const l = comp[k]!;
    const n = ctl[k]!;
    if (l === 0 || n === 0 || blocOf(w, n) === bloc || w.wars.sameSide(n, ENG) || !british.has(l)) continue;
    if (!neighbours4(k, W, H, w.settings.loopingMap, []).some((q) => z.zoneOf[q]! !== 0 && z.closed[z.zoneOf[q]!] !== 1)) continue;
    if (near(k, 4, ports) || near(k, 8, standing) || near(k, 8, held)) continue;
    beach = k;
  }
  expect(beach).toBeGreaterThanOrEqual(0);
  const enemy = ctl[beach]!;
  expect(declareWar(w, ENG, enemy, true)).not.toBeNull();
  const land = comp[beach]!;
  // A British land formation in the network on that land (India's), and another to land.
  let home = -1;
  let div = -1;
  w.formations.forEach((f) => {
    if (c.nation[f] !== ENG || w.offLand(f) || w.isWing(f)) return;
    const at = Math.floor(c.y[f]!) * W + Math.floor(c.x[f]!);
    if (home < 0 && comp[at] === land && w.cells.supply[at] === bloc) home = f;
    else if (div < 0 && comp[at] !== land) div = f;
  });
  expect(home).toBeGreaterThan(0);
  expect(div).toBeGreaterThan(0);
  [c.x[div], c.y[div]] = w.cellPoint(beach);
  c.moving[div] = 0;
  c.supply[div] = 1;
  w.paths.delete(div);
  // The hour before a refresh of the network (every SUPPLY_REFRESH_HOURS): from then on it counts.
  s.step(SUPPLY_REFRESH_HOURS - 1 - (w.tick % SUPPLY_REFRESH_HOURS));
  [c.x[div], c.y[div]] = w.cellPoint(beach);
  c.supply[div] = 1;
  w.setController(beach, ENG);
  const zones = neighbours4(beach, W, H, w.settings.loopingMap, [])
    .map((q) => z.zoneOf[q]!)
    .filter((zone) => zone !== 0);
  return { s, div, home, enemy, zones };
}

describe('supply over the beach on any land (PLAN 7.75)', () => {
  it('a division ashore beyond its network, on a land with a city of its bloc, is fed for 30 days at a beach rate; the network there whole', () => {
    const { s, div, home } = landed();
    const w = s.world;
    const c = w.formations.cols;
    let least = 1;
    let most = 0;
    let homeLeast = 1;
    for (let h = 0; h < DAYS * 24; h++) {
      s.step(1);
      least = Math.min(least, c.supply[div]!);
      if (h >= 24) most = Math.max(most, c.supply[div]!);
      homeLeast = Math.min(homeLeast, c.supply[home]!);
    }
    process.stderr.write(`pocket: least ${least.toFixed(3)}, most ${most.toFixed(3)}; in the network: least ${homeLeast.toFixed(3)}; beach layer ${w.supplyBeach.size} cells\n`);
    expect(w.formations.has(div)).toBe(true);
    expect(least).toBeGreaterThanOrEqual(0.5);
    expect(most).toBe(BEACH_SUPPLY);
    expect(homeLeast).toBe(1);
    // The beach's layer a refresh in full makes is the one the partial refreshes left.
    const layer = [...w.supplyBeach].sort((a, b) => a[0] - b[0]);
    const network = w.cells.supply.slice();
    w.supplyDirty = true;
    refreshSupplyNetwork(w);
    refreshBeaches(w);
    expect(w.cells.supply).toEqual(network);
    expect([...w.supplyBeach].sort((a, b) => a[0] - b[0])).toEqual(layer);
    // Saved and loaded, the layer is the same.
    const t = new Sim({ scenario: '1938', seed: 7701, assets: assets1938(W) });
    t.load(s.save());
    expect(t.hash()).toBe(s.hash());
    expect([...t.world.supplyBeach].sort((a, b) => a[0] - b[0])).toEqual(layer);
  });

  it('the enemy holding the zones by the beach, it is not fed', () => {
    const { s, div, enemy, zones } = landed();
    const w = s.world;
    const c = w.formations.cols;
    const sc = seaControlOf(w);
    const hold = (): void => {
      for (const zone of zones) {
        sc.holder[zone] = blocOf(w, enemy);
        sc.days[zone] = CONTROL_DAYS;
      }
    };
    hold();
    let dryHours = 0;
    for (let h = 0; h < DAYS * 24; h++) {
      s.step(1);
      hold();
      if (w.formations.has(div) && c.supply[div] === 0) dryHours++;
    }
    expect(dryHours).toBeGreaterThan((DAYS - 1) * 24);
  });
});
