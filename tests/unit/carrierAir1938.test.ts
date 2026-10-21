import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { wingRange } from '../../src/sim/systems/air';
import { NAVAL_STRIKE_FIRE, shipEffectiveness } from '../../src/sim/systems/airCombat';
import { hash32, hashToUnit } from '../../src/sim/core/hash';
import { CARRIER_CYCLE, CARRIER_SPOT_SHARE, findSeaBattles, navalCombatSystem, SALT_CARRIER, seaKm } from '../../src/sim/systems/navalCombat';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 5.4d: a carrier's wings see for its fleet and strike the fleets it is in battle with.

const [JAP, USA] = ['JAP', 'USA'].map(nationId) as [number, number];
const [SX, SY] = cellOf(-170, 20, SIZE_1938.w, SIZE_1938.h);
const tmpl = (w: World, id: number): string => TEMPLATES_1938[w.formations.cols.template[id]!]!.id;
const fleetOf = (w: World, nation: number, t: string): number => [...w.formations.ids()].find((id) => w.isFleet(id) && w.formations.cols.nation[id] === nation && tmpl(w, id) === t)!;
/** Japan and the United States at war; a Japanese carrier group and an American battle squadron `km` apart in the open Pacific, every other fleet far off. */
function sea(km: number): { w: World; cv: number; bb: number; wings: number[] } {
  const w = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) }).world;
  w.wars.start([JAP], [USA], 0);
  const c = w.formations.cols;
  const cv = fleetOf(w, JAP, 'carrier_group');
  const bb = fleetOf(w, USA, 'battle_squadron');
  for (const id of w.formations.ids()) if (w.isFleet(id) && id !== cv && id !== bb) [c.x[id], c.y[id]] = [5.5, 5.5];
  [c.x[cv], c.y[cv]] = [SX, SY];
  // East along the row by km.
  let dx = 0;
  while (seaKm(w, SX, SY, SX + dx, SY) < km) dx += 0.01;
  [c.x[bb], c.y[bb]] = [SX + dx, SY];
  const wings = [...w.wingBase].filter(([, b]) => b === -cv).map(([id]) => id);
  return { w, cv, bb, wings };
}
const ships = (w: World, g: number): number => {
  const ec = w.elements.cols;
  let n = 0;
  w.elements.forEach((e) => {
    if (ec.formation[e] === g) n += ec.strength[e]! - ec.wound[e]!;
  });
  return n;
};

describe('carrier air groups in fleet battles (PLAN 5.4d)', () => {
  it('a carrier group sees an enemy fleet 150 km off by its wings, a quarter of their range; without them it does not', () => {
    const { w, cv, bb, wings } = sea(150);
    expect(wings.length).toBe(2);
    expect(CARRIER_SPOT_SHARE * wingRange(w, wings[0]!)).toBe(250);
    const battles = findSeaBattles(w).filter((b) => b.fleets.includes(cv));
    expect(battles).toHaveLength(1);
    expect(battles[0]!.fleets).toContain(bb);
    expect(battles[0]!.km).toBeCloseTo(150, 0);
    // Its wings away on a sortie of their own: it sees by its ships, 18 km at most.
    const v = sea(150);
    for (const id of v.wings) v.w.sorties.set(id, { bx: 0, by: 0, tx: 1, ty: 0, launch: v.w.tick - 1, kmh: 10, km: 100, over: 0 });
    expect(findSeaBattles(v.w).filter((b) => b.fleets.includes(v.cv))).toHaveLength(0);
    // 300 km: beyond them.
    const far = sea(300);
    expect(findSeaBattles(far.w).filter((b) => b.fleets.includes(far.cv))).toHaveLength(0);
  });

  it('its wings strike the battle squadron once in CARRIER_CYCLE hours, by the naval strike\'s rule; the carrier no longer breaks off at once', () => {
    const { w, cv, bb, wings } = sea(150);
    while (w.tick % CARRIER_CYCLE !== 0) w.tick++;
    const ec = w.elements.cols;
    const rules = w.rules!;
    const targets = [...w.elements.ids()].filter((e) => ec.formation[e] === bb && ec.strength[e]! > 0 && rules.units[ec.unit[e]!]!.cls !== 'ss');
    const total = targets.reduce((s, t) => s + rules.units[ec.unit[t]!]!.hpPerUnit * ec.strength[t]!, 0);
    // Each squadron puts its whole fire on one ship, picked by hit points (PLAN 7.60, ADR-605; it
    // was spread over every ship by them): a ship takes at most what it has left.
    const fire = new Map<number, number>();
    for (const wing of wings)
      for (const e of [...w.elements.ids()].filter((x) => ec.formation[x] === wing && ec.strength[x]! > 0)) {
        const u = hashToUnit(hash32(w.seed, w.tick, e, SALT_CARRIER)) * total;
        let acc = 0;
        const t = targets.find((x) => (acc += rules.units[ec.unit[x]!]!.hpPerUnit * ec.strength[x]!) > u)!;
        const ut = rules.units[ec.unit[t]!]!;
        fire.set(t, (fire.get(t) ?? 0) + (ec.strength[e]! * shipEffectiveness(rules.units[ec.unit[e]!]!, ut) * NAVAL_STRIKE_FIRE) / ut.hpPerUnit);
      }
    let want = 0;
    for (const [t, d] of fire) want += Math.min(d, ec.strength[t]! - ec.wound[t]!);
    expect(fire.size, 'ships struck: at most one a squadron').toBeLessThan(targets.length);
    const before = ships(w, bb);
    navalCombatSystem(w);
    expect(before - ships(w, bb)).toBeCloseTo(want, 6);
    expect(want).toBeGreaterThan(0.2);
    // The carrier group is in its battle still: it has a weapon that reaches.
    expect(w.formations.cols.retreat[cv]).toBe(0);
    expect(w.seaBattles.some((r) => r.fleets.includes(cv) && r.fleets.includes(bb))).toBe(true);
    // The next three hours, no strike: the battle squadron's guns do not reach 150 km either.
    const after = ships(w, bb);
    for (let h = 1; h < CARRIER_CYCLE; h++) {
      w.tick++;
      navalCombatSystem(w);
    }
    expect(ships(w, bb)).toBe(after);
    // Its hour again: another strike.
    w.tick++;
    navalCombatSystem(w);
    expect(ships(w, bb)).toBeLessThan(after);
  });
});
