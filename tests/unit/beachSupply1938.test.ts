import { describe, expect, it } from 'vitest';
import { neighbours4 } from '../../src/sim/nav/grid';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { CONTROL_DAYS, seaControlOf } from '../../src/sim/systems/seaControl';
import { seaBeaches } from '../../src/sim/systems/seaSupply';
import { BEACH_SUPPLY, SUPPLY_REFRESH_HOURS, blocOf } from '../../src/sim/systems/supply';
import { declareWar } from '../../src/sim/systems/war';
import { navOf, seaOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 7.70a: supply's sources were cities their bloc owns and controls, spread over held land
// alone, so a division ashore on an enemy's coast with no port, on a land where its nation holds
// no city, starved: dry in 8 hours, bled from then on. Since, a coast cell its bloc holds on such
// a land is a source while a zone of the water beside it is reached from home by a sea no enemy
// holds. The United Kingdom in 1938, a British division put ashore on a coast with no port near,
// on a land of 50 cells or more where Britain holds no city and nobody stands near, at war with
// the coast's nation: fed for 30 days (at a beach's rate, at BEACH_SUPPLY); with that enemy
// holding the zones by that land, dry. Before, dry in both.

const { w: W, h: H } = SIZE_1938;
const ENG = NATIONS_1938.findIndex((n) => n.tag === 'ENG') + 1;
const DAYS = 30;

/** The world at war, the landed division, its enemy, its land, and the zones beside that land. */
function landed(): { s: Sim; div: number; enemy: number; land: number; zones: number[] } {
  const s = new Sim({ scenario: '1938', seed: 7701, assets: assets1938(W) });
  const w = s.world;
  s.command({ kind: 'setSetting', key: 'aiEnabled', value: false });
  s.step(1);
  const comp = navOf(w).grid.component;
  const z = seaOf(w);
  const ctl = w.cells.controller;
  const c = w.formations.cols;
  const bloc = blocOf(w, ENG);
  // The lands where Britain's bloc holds a city, the cells of the ports, and where formations stand.
  const british = new Set<number>();
  w.cities.forEach((city) => {
    const at = w.cities.cols.cell[city]!;
    if (ctl[at] !== 0 && blocOf(w, ctl[at]!) === bloc) british.add(comp[at]!);
  });
  const size = new Map<number, number>();
  for (let k = 0; k < W * H; k++) if (comp[k]! > 0) size.set(comp[k]!, (size.get(comp[k]!) ?? 0) + 1);
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
  // The first coast cell of a nation outside Britain's bloc, not its ally, on a land of 50 cells or
  // more with no British city, by an open zone, no port within 4 cells and no formation within 8.
  let beach = -1;
  for (let k = 0; k < W * H && beach < 0; k++) {
    const l = comp[k]!;
    const n = ctl[k]!;
    if (l === 0 || n === 0 || blocOf(w, n) === bloc || w.wars.sameSide(n, ENG) || british.has(l) || size.get(l)! < 50) continue;
    if (!neighbours4(k, W, H, w.settings.loopingMap, []).some((q) => z.zoneOf[q]! !== 0 && z.closed[z.zoneOf[q]!] !== 1)) continue;
    if (near(k, 4, ports) || near(k, 8, standing)) continue;
    beach = k;
  }
  expect(beach).toBeGreaterThanOrEqual(0);
  const enemy = ctl[beach]!;
  expect(declareWar(w, ENG, enemy, true)).not.toBeNull();
  const land = comp[beach]!;
  // A British division, ashore there as a landing puts it (the cell its nation's).
  let div = -1;
  w.formations.forEach((f) => {
    if (div < 0 && c.nation[f] === ENG && !w.offLand(f) && !w.isWing(f)) div = f;
  });
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
  const zones = new Set<number>();
  for (let k = 0; k < W * H; k++) {
    if (comp[k] !== land) continue;
    for (const q of neighbours4(k, W, H, w.settings.loopingMap, [])) if (z.zoneOf[q]! !== 0) zones.add(z.zoneOf[q]!);
  }
  return { s, div, enemy, land, zones: [...zones] };
}

describe('supply over the beach (PLAN 7.70a)', () => {
  it('a division ashore on an enemy coast with no port, on a land with no city of its nation, is fed for 30 days', () => {
    const { s, div, land } = landed();
    const w = s.world;
    const c = w.formations.cols;
    let least = 1;
    let most = 0;
    for (let h = 0; h < DAYS * 24; h++) {
      s.step(1);
      least = Math.min(least, c.supply[div]!);
      // At a beach's rate: no higher than BEACH_SUPPLY once it has fallen to it (a day on).
      if (h >= 24) most = Math.max(most, c.supply[div]!);
    }
    expect(w.formations.has(div)).toBe(true);
    expect(least).toBeGreaterThanOrEqual(0.5);
    expect(most).toBe(BEACH_SUPPLY);
    // The beach is a source of Britain's.
    expect((seaBeaches(w).get(blocOf(w, ENG)) ?? []).some((k) => navOf(w).grid.component[k] === land)).toBe(true);
  });

  it('the enemy holding the zones by that land, it is not fed', () => {
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
