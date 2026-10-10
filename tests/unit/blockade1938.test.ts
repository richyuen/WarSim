import { describe, expect, it } from 'vitest';
import { NATIONS_1938, SIZE_1938, TEMPLATES_1938, ECONOMY_TABLES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { monthlyAccounts } from '../../src/sim/systems/economy';
import { equipFormation } from '../../src/sim/systems/elements';
import { BLOCKADE_SHARE, blockadedCells, blockadedPorts, navalPower, seaControlOf, seaHolder } from '../../src/sim/systems/seaControl';
import { declareWar } from '../../src/sim/systems/war';
import { portSeaOf, seaOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 4.4b: blockade. AT: a blockaded port's income drops by the expected factor: the land of
// its province pays BLOCKADE_SHARE of its income while an enemy holds the zone of its water.

const { w: W } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const template = (t: string): number => TEMPLATES_1938.findIndex((x) => x.id === t);
const GER = id('GER');
const ENG = id('ENG');
const sim = (): Sim => {
  const s = new Sim({ scenario: '1938', seed: 4402, assets: assets1938(W) });
  s.world.settings.aiEnabled = false;
  return s;
};
function fleet(w: World, nation: number, tpl: string, cell: number): number {
  const f = w.formations;
  const fid = f.create();
  f.cols.nation[fid] = nation;
  [f.cols.x[fid], f.cols.y[fid]] = w.seaPoint(cell) ?? [(cell % W) + 0.5, Math.floor(cell / W) + 0.5];
  f.cols.template[fid] = template(tpl);
  f.cols.supply[fid] = 1;
  f.cols.org[fid] = 1;
  equipFormation(w, fid, template(tpl));
  return fid;
}

/** A province of `nation` all of whose ports a ship reaches have their water in one zone that no warship stands in: [province, zone, a port's water]. */
function lonelyProvince(w: World, nation: number): [number, number, number] {
  const water = portSeaOf(w);
  const sea = seaOf(w);
  const power = navalPower(w);
  const zones = new Map<number, Set<number>>();
  const at = new Map<number, number>();
  w.ports.forEach((p, i) => {
    const c = water[i]!;
    const pr = w.cells.province[p.cell]!;
    if (c < 0 || pr === 0 || sea.closed[sea.zoneOf[c]!] === 1) return;
    if (!zones.has(pr)) zones.set(pr, new Set());
    zones.get(pr)!.add(sea.zoneOf[c]!);
    at.set(pr, c);
  });
  for (const [pr, zs] of [...zones].sort((a, b) => a[0] - b[0])) {
    const zone = [...zs][0]!;
    let own = 0;
    for (let c = 0; c < w.cells.owner.length; c++) if (w.cells.province[c] === pr && w.cells.owner[c] === nation && w.cells.controller[c] === nation) own++;
    if (zs.size === 1 && own > 0 && !power.has(zone)) return [pr, zone, at.get(pr)!];
  }
  throw new Error('no such province');
}

/** The economy's land income of `nation` at the hour, as `monthlyAccounts` reckons it. */
const gross = (w: World, nation: number): number => monthlyAccounts(w, ECONOMY_TABLES_1938).gross[nation]!;

describe('blockade (PLAN 4.4b)', () => {
  it('the AT: a German battle squadron holding the zone of a British province\'s ports takes half of that province\'s income', () => {
    const s = sim();
    const w = s.world;
    expect(declareWar(w, GER, ENG, true)).not.toBeNull();
    const [pr, zone, cell] = lonelyProvince(w, ENG);
    s.step(1);
    const free = gross(w, ENG);
    fleet(w, GER, 'battle_squadron', cell);
    s.step(24);
    expect(seaHolder(w, zone)).toBe(GER);
    const ports = blockadedPorts(w);
    const ofProvince = w.ports.map((_, i) => i).filter((i) => w.cells.province[w.ports[i]!.cell] === pr && portSeaOf(w)[i]! >= 0);
    expect(ofProvince.length).toBeGreaterThan(0);
    for (const i of ofProvince) expect(ports[i], `port ${i}`).toBe(1);
    expect(blockadedCells(w)!.provinces.has(pr)).toBe(true);
    // Expected: the province's share of the nation's land income, cut to BLOCKADE_SHARE.
    const { econ, owner, controller, province } = w.cells;
    let all = 0;
    let mine = 0;
    for (let c = 0; c < econ.length; c++) {
      if (controller[c] !== ENG) continue;
      const v = owner[c] === ENG ? econ[c]! : econ[c]! * 0.5;
      all += v;
      if (province[c] === pr) mine += v;
    }
    // Other provinces blockaded too (the zone's other coasts): counted as the economy counts them.
    const shut = blockadedCells(w)!;
    let others = 0;
    for (let c = 0; c < econ.length; c++) if (controller[c] === ENG && province[c] !== pr && (shut.provinces.has(province[c]!) || shut.cells.has(c))) others += owner[c] === ENG ? econ[c]! : econ[c]! * 0.5;
    const expected = free * (1 - ((1 - BLOCKADE_SHARE) * (mine + others)) / all);
    expect(gross(w, ENG)).toBeCloseTo(expected, 6);
    expect(gross(w, ENG)).toBeLessThan(free);
    process.stderr.write(`blockade: province ${pr}, ${(100 * mine / all).toFixed(2)} % of the United Kingdom's land income (${(100 * others / all).toFixed(2)} % more of other provinces on the zone); gross ${free.toFixed(1)} -> ${gross(w, ENG).toFixed(1)} a month\n`);
  });

  it('not blockaded: the zone held by a nation at peace with the port\'s holder, or the zone held by nobody', () => {
    const s = sim();
    const w = s.world;
    const [, zone, cell] = lonelyProvince(w, ENG);
    fleet(w, GER, 'battle_squadron', cell);
    s.step(1);
    expect(seaHolder(w, zone)).toBe(GER);
    // At peace: Germany holds the zone, nothing is blockaded by it.
    expect(blockadedPorts(w).some((b, i) => b === 1 && w.cells.controller[w.ports[i]!.cell] === ENG)).toBe(false);
    // At war and nobody holds it: none.
    expect(declareWar(w, GER, ENG, true)).not.toBeNull();
    seaControlOf(w).holder[zone] = 0;
    expect(blockadedPorts(w).some((b, i) => b === 1 && w.cells.controller[w.ports[i]!.cell] === ENG && seaOf(w).zoneOf[portSeaOf(w)[i]!] === zone)).toBe(false);
  });

  it('a province with a port on another zone that is open is not blockaded', () => {
    const s = sim();
    const w = s.world;
    s.step(1);
    // A province with ports on two zones (the first such, of any nation): one zone given to an
    // enemy of its holder, the other free.
    const water = portSeaOf(w);
    const sea = seaOf(w);
    const zonesOf = new Map<number, Set<number>>();
    w.ports.forEach((p, i) => {
      const pr = w.cells.province[p.cell]!;
      if (water[i]! < 0 || pr === 0 || sea.closed[sea.zoneOf[water[i]!]!] === 1) return;
      if (!zonesOf.has(pr)) zonesOf.set(pr, new Set());
      zonesOf.get(pr)!.add(sea.zoneOf[water[i]!]!);
    });
    const [pr, zs] = [...zonesOf].sort((p, q) => p[0] - q[0]).find(([, z]) => z.size >= 2)!;
    const port = w.ports.find((p) => w.cells.province[p.cell] === pr)!;
    const holder = w.cells.controller[port.cell]!;
    const enemy = holder === GER ? ENG : GER;
    expect(declareWar(w, enemy, holder, true)).not.toBeNull();
    const [a, ...rest] = [...zs].sort((p, q) => p - q);
    const sc = seaControlOf(w);
    for (let z = 1; z < sc.holder.length; z++) sc.holder[z] = 0;
    sc.holder[a!] = enemy;
    expect(blockadedPorts(w).some((x) => x === 1)).toBe(true);
    expect(blockadedCells(w)?.provinces.has(pr) ?? false).toBe(false);
    for (const z of rest) sc.holder[z] = enemy;
    expect(blockadedCells(w)!.provinces.has(pr)).toBe(true);
  });
});
