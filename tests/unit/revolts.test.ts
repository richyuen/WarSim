import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { DECAY, NON_CORE, OVEREXT_CELLS, OVEREXT_MAX, OVEREXT_SHARE, OVEREXT_UNREST, SUPPRESSION_COST } from '../../src/sim/systems/revolts';
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
    s.world.settings.aiEnabled = false; // isolate the mechanism from the AI (its suppression would calm the neighbours)
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

  it('defection: a restless conquest returns to its living core nation instead of founding a state', () => {
    const s = new Sim({ scenario: '1938', seed: 7, assets: assets1938(W) });
    const w = s.world;
    w.settings.aiEnabled = false;
    const POL = nationId('POL');
    for (const n of [GER, POL]) w.alliances.leave(n);
    const g = navOf(w).graph;
    // A Polish province that is not the capital's, annexed by Germany.
    const capitals = new Set<number>();
    w.cities.forEach((id) => {
      if (w.cities.cols.capitalOf[id] !== 0) capitals.add(w.cells.province[w.cities.cols.cell[id]!]!);
    });
    let p = 0;
    for (let q = 1; q < w.provinces.count && p === 0; q++) if (w.cells.owner[g.centre[q] ?? 0] === POL && w.provinces.core[q] === POL && !capitals.has(q)) p = q;
    expect(p).toBeGreaterThan(0);
    w.cells.owner.forEach((o, c) => {
      if (o === POL && w.cells.province[c] === p) {
        w.setOwner(c, GER);
        w.setController(c, GER);
      }
    });
    const nations = w.nations.count;
    s.command({ kind: 'setUnrest', province: p, value: 100 });
    let ev: number[][] = [];
    for (let m = 0; m < 12 && kinds(ev, EventKind.RevoltSpawned).length === 0; m++) ev = run(s, 24 * 31);
    expect(kinds(ev, EventKind.RevoltSpawned)).toEqual([[POL, GER]]);
    expect(w.nations.count).toBe(nations); // no new nation
    expect(w.cells.owner[g.centre[p]!]).toBe(POL);
    expect(w.cells.controller[g.centre[p]!]).toBe(POL);
    expect(w.provinces.unrest[p]!).toBeLessThan(50);
  });

  it('overextension: the far provinces of an oversized empire grow restless; suppression holds them', () => {
    const unrestAfter = (suppression: number): { far: number; near: number; german: number } => {
      const s = new Sim({ scenario: '1938', seed: 7, assets: assets1938(W) });
      const w = s.world;
      w.settings.aiEnabled = false;
      if (suppression > 0) s.command({ kind: 'setSuppression', nation: SOV, level: suppression });
      run(s, THROUGH_MARCH);
      const g = navOf(w).graph;
      const nc = w.nations.cols;
      const out = { far: 0, near: 0, german: 0 };
      for (let p = 1; p < w.provinces.count; p++) {
        const c = g.centre[p] ?? -1;
        if (c < 0) continue;
        const o = w.cells.owner[c]!;
        const u = w.provinces.unrest[p]!;
        if (o === GER) out.german = Math.max(out.german, u);
        if (o !== SOV) continue;
        const d = Math.hypot((c % W) + 0.5 - nc.capitalX[SOV]!, Math.floor(c / W) + 0.5 - nc.capitalY[SOV]!);
        if (d > OVEREXT_CELLS + 1) out.far = Math.max(out.far, u);
        else if (d < OVEREXT_CELLS - 1) out.near = Math.max(out.near, u);
      }
      return out;
    };
    expect(OVEREXT_UNREST * OVEREXT_MAX).toBeGreaterThan(DECAY); // an empire at the cap strains
    const free = unrestAfter(0);
    expect(free.far).toBeGreaterThan(0); // Siberia stirs (the Soviet Union holds over a quarter of the land)
    expect(free.near).toBe(0); // the heartland stays calm
    expect(free.german).toBe(0); // a nation below OVEREXT_SHARE is not strained
    expect(unrestAfter(1).far).toBe(0);
  });

  // PLAN 1.42e2, ADR-57: the share is a share of km². By cells Canada holds 12.3% of the owned
  // land (strain at the cap) and Brazil 3.7% (none); by km² they hold 6.8% and 6.4%.
  it('overextension counts km²: Canada is not at the cap, and Brazil is above the threshold', () => {
    const CAN = nationId('CAN');
    const BRA = nationId('BRA');
    const ARG = nationId('ARG');
    const s = new Sim({ scenario: '1938', seed: 7, assets: assets1938(W) });
    const w = s.world;
    w.settings.aiEnabled = false;
    const g = navOf(w).graph;
    const nc = w.nations.cols;
    const share = (n: number, land: ArrayLike<number>): number => {
      let owned = 0;
      w.nations.forEach((m) => {
        if (nc.living[m] === 1) owned += land[m]!;
      });
      return land[n]! / owned;
    };
    const factor = (sh: number): number => Math.min(OVEREXT_MAX, Math.max(0, sh / OVEREXT_SHARE - 1));
    const km2 = w.landCounts().owned;
    // The premise: the two measures put these nations on different sides of the rule.
    expect(OVEREXT_UNREST * factor(share(CAN, nc.cells))).toBeGreaterThan(DECAY); // by cells: restless
    expect(OVEREXT_UNREST * factor(share(CAN, km2))).toBeLessThan(DECAY); // by km²: calm
    expect(factor(share(BRA, nc.cells))).toBe(0);
    expect(factor(share(BRA, km2))).toBeGreaterThan(0.5);
    expect(factor(share(ARG, nc.cells))).toBe(0);
    expect(factor(share(ARG, km2))).toBe(0);
    /** The own core provinces of `n`, far from its capital or anywhere. */
    const provinces = (n: number, far: boolean): number[] => {
      const out: number[] = [];
      for (let p = 1; p < w.provinces.count; p++) {
        const c = g.centre[p] ?? -1;
        if (c < 0 || w.cells.owner[c] !== n || w.provinces.core[p] !== n) continue;
        const d = Math.hypot((c % W) + 0.5 - nc.capitalX[n]!, Math.floor(c / W) + 0.5 - nc.capitalY[n]!);
        if (!far || d > OVEREXT_CELLS + 1) out.push(p);
      }
      return out;
    };
    const most = (ps: number[]): number => Math.max(...ps.map((p) => w.provinces.unrest[p]!));
    const [canada, brazil, argentina] = [provinces(CAN, true), provinces(BRA, true), provinces(ARG, false)];
    expect(Math.min(canada.length, brazil.length, argentina.length)).toBeGreaterThan(3);
    // Brazil and Argentina start restless (below the revolt threshold), so the decay shows.
    for (const p of [...brazil, ...argentina]) s.command({ kind: 'setUnrest', province: p, value: 40 });
    const f = factor(share(BRA, km2));
    run(s, THROUGH_MARCH);
    expect(most(canada)).toBe(0); // by cells its far north gained 0.5 a month
    // Argentina decays by DECAY a month; Brazil's far provinces by OVEREXT_UNREST × factor less.
    const months = (40 - most(argentina)) / DECAY;
    expect(months).toBeGreaterThanOrEqual(2);
    expect(Number.isInteger(months)).toBe(true);
    expect(most(brazil) - most(argentina)).toBeCloseTo(months * OVEREXT_UNREST * f, 3);
  });
});
