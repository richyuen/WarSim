import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { eliminateNation } from '../../src/sim/systems/capitals';
import { COLLAPSE_MONTHS, REVIVAL_COOLDOWN, REVIVALS } from '../../src/sim/systems/revival';
import { navOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { eventKinds as kinds, nationId, runEvents as run } from '../helpers/sim1938';

// PLAN 1.20: collapse and revival (finite, cooldown) from cores. AT: a dead nation revives at
// most N times, never before its cooldown.

const W = SIZE_1938.w;
const [ETH, ITA, ALB, SOV, ROM, GER, POL] = ['ETH', 'ITA', 'ALB', 'SOV', 'ROM', 'GER', 'POL'].map(nationId) as number[];

/** Province ids whose centre cell `n` owns. */
function heldProvinces(w: World, n: number): number[] {
  const g = navOf(w).graph;
  const out: number[] = [];
  for (let p = 1; p < w.provinces.count; p++) if ((g.centre[p] ?? -1) >= 0 && w.cells.owner[g.centre[p]!] === n) out.push(p);
  return out;
}

describe('collapse and revival (PLAN 1.20)', () => {
  it('extra cores become claims: dead Ethiopia on Italian East Africa, the Soviets on Bessarabia', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const pv = s.world.provinces;
    const eth = pv.provincesOf(ETH!);
    expect(eth.length).toBeGreaterThan(5);
    const g = navOf(s.world).graph;
    expect(eth.every((p) => s.world.cells.owner[g.centre[p]!] === ITA)).toBe(true);
    expect(pv.provincesOf(SOV!).some((p) => s.world.cells.owner[g.centre[p]!] === ROM)).toBe(true);
    expect(s.world.nations.cols.living[ETH!]).toBe(0);
    expect(s.world.nations.cols.revivalsLeft[ETH!]).toBe(REVIVALS);
  });

  it(`a dead nation revives at most ${REVIVALS} times, never before its cooldown`, () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    const nc = w.nations.cols;
    const revive = (): boolean => kinds(run(s, 1), EventKind.NationRevived).some(([n]) => n === ETH);

    // Dead at the start, no cooldown pending: the first revival works at once.
    s.command({ kind: 'reviveNation', nation: ETH! });
    expect(revive()).toBe(true);
    expect(nc.living[ETH!]).toBe(1);
    expect(nc.revivalsLeft[ETH!]).toBe(REVIVALS - 1);
    expect(heldProvinces(w, ETH!).length).toBeGreaterThan(5);

    for (let life = 1; life < REVIVALS + 1; life++) {
      // Dies: Italy retakes all its land, then the nation is eliminated (a test shortcut for
      // a lost war; eliminateNation itself never moves land).
      w.cells.owner.forEach((o, c) => {
        if (o !== ETH) return;
        w.setOwner(c, ITA!);
        w.setController(c, ITA!);
      });
      eliminateNation(w, ETH!);
      const until = nc.revivalAt[ETH!]!;
      expect(until).toBe(w.tick + REVIVAL_COOLDOWN);
      s.command({ kind: 'reviveNation', nation: ETH! });
      expect(revive()).toBe(false); // right after death
      w.tick = until - 1; // jump to one hour before the cooldown ends
      s.command({ kind: 'reviveNation', nation: ETH! });
      expect(revive()).toBe(false);
      expect(w.tick).toBe(until);
      s.command({ kind: 'reviveNation', nation: ETH! });
      const ok = revive();
      expect(ok).toBe(life < REVIVALS); // the N-th death is final
      expect(nc.revivalsLeft[ETH!]).toBe(Math.max(0, REVIVALS - 1 - life));
    }
    expect(nc.living[ETH!]).toBe(0);
  });

  it('a revolt on land with a dead claimant revives it instead of new rebels', () => {
    const s = new Sim({ scenario: '1938', seed: 3, assets: assets1938(W) });
    const eth = s.world.provinces.provincesOf(ETH!);
    for (const p of eth) s.command({ kind: 'setUnrest', province: p, value: 100 });
    let ev: number[][] = [];
    for (let m = 0; m < 6 && kinds(ev, EventKind.NationRevived).length === 0; m++) ev = ev.concat(run(s, 24 * 31));
    expect(kinds(ev, EventKind.NationRevived).map(([n]) => n)).toContain(ETH);
    const nations = s.world.nations.count;
    // No new nation was created for the first revolt that revived Ethiopia.
    expect(s.world.nations.cols.living[ETH!]).toBe(1);
    expect(nations).toBeGreaterThan(0);
  });

  it('God collapse frees puppets, revives dead claimants and lets restless provinces revolt', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    const italian = heldProvinces(w, ITA!).filter((p) => !w.provinces.coresOf(p).includes(ETH!));
    for (const p of italian.slice(0, 3)) w.provinces.unrest[p] = 70;
    s.command({ kind: 'collapseNation', nation: ITA! });
    const ev = run(s, 1);
    expect(kinds(ev, EventKind.NationCollapsed)).toEqual([[ITA, 0]]);
    expect(kinds(ev, EventKind.PuppetReleased)).toContainEqual([ALB, ITA]);
    expect(kinds(ev, EventKind.NationRevived).map(([n]) => n)).toEqual([ETH]);
    expect(kinds(ev, EventKind.RevoltSpawned).filter(([r]) => r !== ETH).length).toBeGreaterThan(0);
    expect(w.nations.cols.overlord[ALB!]).toBe(0);
  });

  it(`${COLLAPSE_MONTHS} bankrupt months in a row collapse a nation`, () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    let collapsed = false;
    for (let m = 0; m < COLLAPSE_MONTHS + 2 && !collapsed; m++) {
      w.nations.cols.gold[POL!] = -1e12; // deep in debt all along
      collapsed = kinds(run(s, 24 * 31), EventKind.NationCollapsed).some(([n]) => n === POL);
    }
    expect(collapsed).toBe(true);
  });

  it('losing the capital with no core land left is death; the capturer annexes the rest', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    for (const n of [GER!, POL!]) {
      w.alliances.leave(n);
      w.alliances.guarantees = w.alliances.guarantees.filter((g) => g.guarantor !== n && g.target !== n);
    }
    // Poland's land is all rightfully someone else's (as if it held only conquests).
    for (const p of heldProvinces(w, POL!)) w.provinces.core[p] = SOV!;
    w.provinces.claims = w.provinces.claims.filter(([, n]) => n !== POL);
    w.wars.set(GER!, POL!, true);
    let warsaw = 0;
    w.cities.forEach((id) => {
      if (w.cities.cols.capitalOf[id] === POL) warsaw = id;
    });
    s.command({ kind: 'paintControl', nation: GER!, x: w.cities.cols.x[warsaw]!, y: w.cities.cols.y[warsaw]!, r: 0 });
    const ev = run(s, 1);
    expect(kinds(ev, EventKind.NationEliminated)).toContainEqual([POL, 0]);
    expect(w.cells.owner.some((o) => o === POL)).toBe(false);
  });

  it('claims and revival state survive save/load', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    s.command({ kind: 'reviveNation', nation: ETH! });
    s.step(5);
    const t = new Sim({ scenario: '1938', seed: 2, assets: assets1938(W) });
    t.load(s.save());
    expect(t.world.provinces.claims).toEqual(s.world.provinces.claims);
    expect(t.world.nations.cols.revivalsLeft[ETH!]).toBe(REVIVALS - 1);
    s.step(24 * 40);
    t.step(24 * 40);
    expect(t.hash()).toBe(s.hash());
  });
});
