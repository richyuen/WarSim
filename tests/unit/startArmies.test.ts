import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { HISTORY_STRIDE } from '../../src/sim/history';
import { RULES_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 2.13 (the critic's R2-B3, the first part): in the first tick of a 1938 game the economic
// AI disbanded 228 of the 1,054 formations of the order of battle, the Soviet Union's 34 tank
// formations among them, and no line of the history said so. The world a player looked at while
// the new game was paused was not the one that played.

const W = SIZE_1938.w;
const SOV = nationId('SOV');
const MON = nationId('MON');

/** An armour formation, as the critic counted them: it has tanks and nobody on foot. */
function isArmour(template: number): boolean {
  const cls = (RULES_1938.templates[template]?.elements ?? []).map((e) => RULES_1938.units[e.unit]!.cls);
  return cls.some((c) => c.startsWith('armor')) && !cls.includes('inf');
}

function census(w: World): { all: number; armour: number; soviet: number; byNation: Map<number, number> } {
  const f = w.formations.cols;
  const out = { all: 0, armour: 0, soviet: 0, byNation: new Map<number, number>() };
  w.formations.forEach((id) => {
    // The armies: the fleets of the start are no part of them (PLAN 4.2b, `fleets1938.test.ts`).
    if (w.afloat(id)) return;
    out.all++;
    out.byNation.set(f.nation[id]!, (out.byNation.get(f.nation[id]!) ?? 0) + 1);
    if (!isArmour(f.template[id]!)) return;
    out.armour++;
    if (f.nation[id] === SOV) out.soviet++;
  });
  return out;
}

/** The `FormationsDisbanded` events of `ticks` steps: [nation, how many]. */
function disbandings(s: Sim, ticks: number): [number, number][] {
  const out: [number, number][] = [];
  s.step(ticks, (w) => {
    const ev = w.out.events;
    for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.FormationsDisbanded) out.push([ev[i + 2]!, ev[i + 3]!]);
    ev.length = 0;
    w.out.fires.length = 0;
  });
  return out;
}

describe('the 1938 order of battle after the game begins (PLAN 2.13)', () => {
  for (const seed of [99, 1212, 4242]) {
    it(`seed ${seed}: the armies of the start are there after the first tick, and none is disbanded for want of money in the first month`, () => {
      const s = new Sim({ scenario: '1938', seed, assets: assets1938(W) });
      const w = s.world;
      const start = census(w);
      expect([start.all, start.armour, start.soviet]).toEqual([1054, 72, 34]);

      const first = disbandings(s, 1);
      const after = census(w);
      expect([after.all, after.armour, after.soviet], 'after the first tick').toEqual([1054, 72, 34]);
      expect([...after.byNation]).toEqual([...start.byNation]);

      // Through 1 February, the month's second assessment. (Formations still die in the wars of
      // the start: only the disbanding is counted.)
      const month = [...first, ...disbandings(s, 24 * 31)];
      expect(month, 'disbanded for want of money in the first month: [nation, how many]').toEqual([]);
      const broke: number[] = [];
      w.nations.forEach((n) => void (w.nations.cols.bankrupt[n] === 1 && broke.push(n)));
      expect(broke, 'bankrupt after a month').toEqual([]);
    });
  }

  it('a nation that cannot pay its army disbands, and the history says how many formations', () => {
    const s = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) });
    const w = s.world;
    const before = census(w).byNation.get(MON)!;
    expect(before).toBeGreaterThan(0);
    w.nations.cols.gold[MON] = 0; // Mongolia's army costs eight times its income
    const events = disbandings(s, 1);
    const left = census(w).byNation.get(MON) ?? 0;
    expect(left).toBeLessThan(before);
    expect(events).toEqual([[MON, before - left]]);
    const rows: number[][] = [];
    for (let i = 0; i < w.history.rows.length; i += HISTORY_STRIDE) rows.push(w.history.rows.slice(i, i + 4));
    expect(rows.filter((r) => r[1] === EventKind.FormationsDisbanded)).toEqual([[0, EventKind.FormationsDisbanded, MON, before - left]]);
  });

  it('a treasury that runs low is spared by disbanding a part of the army, not all of it at once', () => {
    const s = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) });
    const w = s.world;
    const CHI = nationId('CHI');
    for (const war of [...w.wars.list]) w.wars.end(war);
    const before = census(w).byNation.get(CHI)!;
    w.nations.cols.gold[CHI] = 150; // a month or so of its deficit
    const events = disbandings(s, 1);
    const left = census(w).byNation.get(CHI)!;
    expect(events.map((e) => e[0])).toEqual([CHI]);
    expect(left).toBeLessThan(before);
    // With no gold at all it had to balance the month: 70 of its 140 went.
    expect(before - left).toBeLessThan(60);
  });
});
