import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { DECAY, NON_CORE, SUPPRESSION_COST } from '../../src/sim/systems/revolts';
import { navOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { eventKinds as kinds, nationId, runEvents as run } from '../helpers/sim1938';

// PLAN 1.19: revolts (per province / per region), suppression spending, rebel nation spawn.
// AT: high unrest → revolt within the expected window; suppression lowers the probability
// (statistical test over many provinces with fixed seeds).

const W = SIZE_1938.w;
const SOV = nationId('SOV');
const GER = nationId('GER');
/** 00:00 on 1 March 1938 is tick 24 × (31 + 28); stepping one more runs its assessment. */
const THROUGH_MARCH = 24 * (31 + 28) + 1;


/** Soviet provinces held and controlled by the Soviets, pairwise non-adjacent, no capital. */
function sampleProvinces(s: Sim, n: number): number[] {
  const g = navOf(s.world).graph;
  const { owner, controller } = s.world.cells;
  const capitals = new Set<number>();
  s.world.cities.forEach((id) => {
    if (s.world.cities.cols.capitalOf[id] !== 0) capitals.add(s.world.cells.province[s.world.cities.cols.cell[id]!]!);
  });
  const out: number[] = [];
  const blocked = new Set<number>();
  for (let p = 1; p < s.world.provinces.count && out.length < n; p++) {
    const c = g.centre[p] ?? -1;
    if (c < 0 || owner[c] !== SOV || controller[c] !== SOV || capitals.has(p) || blocked.has(p)) continue;
    out.push(p);
    blocked.add(p);
    for (const q of g.adj[p] ?? []) blocked.add(q);
  }
  return out;
}

function revoltsBy(s: Sim, provinces: number[], suppression: number): number {
  s.world.settings.aiEnabled = false; // the economic AI would reset the suppression level
  for (const p of provinces) s.command({ kind: 'setUnrest', province: p, value: 100 });
  if (suppression > 0) s.command({ kind: 'setSuppression', nation: SOV, level: suppression });
  const ev = run(s, THROUGH_MARCH);
  return kinds(ev, EventKind.RevoltSpawned).filter(([, holder]) => holder === SOV).length;
}

describe('revolts (PLAN 1.19)', () => {
  it('1938 provinces start calm with their owners as cores', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const pv = s.world.provinces;
    expect(pv.count).toBeGreaterThan(4000);
    expect(pv.unrest.every((u) => u === 0)).toBe(true);
    const g = navOf(s.world).graph;
    let germanCores = 0;
    for (let p = 1; p < pv.count; p++) if (pv.core[p] === GER && s.world.cells.owner[g.centre[p]!] === GER) germanCores++;
    expect(germanCores).toBeGreaterThan(10);
  });

  it('unrest 100 revolts within three months in most provinces; full suppression cuts the rate', () => {
    const a = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
    const b = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(W) });
    const provinces = sampleProvinces(a, 40);
    expect(provinces.length).toBe(40);
    const free = revoltsBy(a, provinces, 0);
    const suppressed = revoltsBy(b, provinces, 1);
    const log = process.env['REVOLT_LOG'];
    if (log) writeFileSync(log, JSON.stringify({ free, suppressed }));
    // Expected 84% and 29% of 40 (module constants); bands allow sampling spread.
    expect(free).toBeGreaterThanOrEqual(26);
    expect(suppressed).toBeLessThanOrEqual(20);
    expect(suppressed).toBeLessThan(free);
  });

  it('a revolt spawns a rebel nation on the province with militia and its own core', () => {
    const s = new Sim({ scenario: '1938', seed: 7, assets: assets1938(W) });
    s.world.settings.aiEnabled = false; // isolate the mechanism from the AI (PLAN 1.24–1.26)
    const [p] = sampleProvinces(s, 1);
    s.command({ kind: 'setUnrest', province: p!, value: 100 });
    let ev: number[][] = [];
    for (let m = 0; m < 12 && kinds(ev, EventKind.RevoltSpawned).length === 0; m++) ev = run(s, 24 * 31);
    const [rebel, holder] = kinds(ev, EventKind.RevoltSpawned)[0]!;
    expect(holder).toBe(SOV);
    const w = s.world;
    expect(w.nations.cols.living[rebel!]).toBe(1);
    expect(w.nations.cols.origin[rebel!]).toBe(p);
    expect(w.provinces.core[p!]).toBe(rebel);
    const cells = w.cells.owner.reduce((n, o, c) => n + (o === rebel && w.cells.province[c] === p ? 1 : 0), 0);
    expect(cells).toBeGreaterThan(0);
    expect(w.cells.owner.every((o, c) => o !== rebel || w.cells.province[c] === p)).toBe(true); // province mode
    expect(w.formations.ids().some((id) => w.formations.cols.nation[id] === rebel)).toBe(true);
    const declared = kinds(ev, EventKind.WarDeclared).some(([a, d]) => a === SOV && d === rebel);
    expect(w.wars.atWar(SOV, rebel!)).toBe(declared);
  });

  it('region mode: the revolt carries restless neighbours of the same holder and core', () => {
    const s = new Sim({ scenario: '1938', seed: 7, assets: assets1938(W) });
    const g = navOf(s.world).graph;
    const [p] = sampleProvinces(s, 1);
    const neighbours = (g.adj[p!] ?? []).filter((q) => q < s.world.provinces.count && s.world.cells.owner[g.centre[q]!] === SOV);
    expect(neighbours.length).toBeGreaterThan(0);
    s.command({ kind: 'setSetting', key: 'revoltMode', value: 'region' });
    s.command({ kind: 'setUnrest', province: p!, value: 100 });
    for (const q of neighbours) s.command({ kind: 'setUnrest', province: q, value: 49 }); // revolt-proof alone, joins at ≥ 40
    let ev: number[][] = [];
    for (let m = 0; m < 12 && kinds(ev, EventKind.RevoltSpawned).length === 0; m++) ev = run(s, 24 * 31);
    const rebel = kinds(ev, EventKind.RevoltSpawned)[0]![0]!;
    const provincesTaken = new Set<number>();
    s.world.cells.owner.forEach((o, c) => o === rebel && provincesTaken.add(s.world.cells.province[c]!));
    expect(provincesTaken.size).toBeGreaterThan(1);
    expect(provincesTaken.has(p!)).toBe(true);
  });

  it('unrest builds in non-core land; suppression costs gold', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    s.world.settings.aiEnabled = false; // isolate the mechanism from the AI (PLAN 1.24–1.26)
    const [p] = sampleProvinces(s, 1);
    s.world.provinces.core[p!] = GER; // as if Soviet-held land were rightfully German
    s.command({ kind: 'setSuppression', nation: GER, level: 1 });
    const twin = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    twin.world.settings.aiEnabled = false;
    run(s, 1);
    run(twin, 1);
    expect(s.world.provinces.unrest[p!]).toBe(NON_CORE - DECAY);
    const cost = twin.world.nations.cols.gold[GER]! - s.world.nations.cols.gold[GER]!;
    expect(cost).toBeCloseTo(SUPPRESSION_COST * s.world.nations.cols.income[GER]!, 6);
  });

  it('revolt state survives save/load into a live sim', () => {
    const run2 = (split: boolean): number => {
      const s = new Sim({ scenario: '1938', seed: 9, assets: assets1938(W) });
      for (const p of sampleProvinces(s, 10)) s.command({ kind: 'setUnrest', province: p, value: 90 });
      s.step(24 * 20);
      if (!split) {
        s.step(24 * 50);
        return s.hash();
      }
      const t = new Sim({ scenario: '1938', seed: 2, assets: assets1938(W) });
      t.step(2);
      t.load(s.save());
      t.step(24 * 50);
      return t.hash();
    };
    expect(run2(true)).toBe(run2(false));
  });
});
