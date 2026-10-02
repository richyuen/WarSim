import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { combatSystem } from '../../src/sim/systems/combat';
import { PEACE_CE, PROGRESSIVE_STEP, RANDOM_MAX, RANDOM_MIN, staticCe, WAR_CE } from '../../src/sim/systems/efficiency';
import { destroyFormation } from '../../src/sim/systems/elements';
import { FIRE_STRIDE } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId, runEvents } from '../helpers/sim1938';

// PLAN 1.22: combat-efficiency modes dynamic / progressive / static / locked / random.
// AT: a unit test of each mode's evolution.

const W = SIZE_1938.w;
const H = SIZE_1938.h;
const [GER, POL, SWE] = ['GER', 'POL', 'SWE'].map(nationId) as [number, number, number];
const MONTH = [31, 28, 31, 30, 31, 30].map((d) => d * 24);

/** CE of `nations` after each of `months` monthly ticks (1 Jan, 1 Feb, …). */
function evolve(mode: string, nations: number[], months: number, setup?: (s: Sim) => void): number[][] {
  const s = new Sim({ scenario: '1938', seed: 5, assets: assets1938(W) });
  s.command({ kind: 'setSetting', key: 'ceMode', value: mode as 'dynamic' });
  setup?.(s);
  const out: number[][] = [];
  runEvents(s, 1); // 1 January
  out.push(nations.map((n) => s.world.nations.cols.efficiency[n]!));
  for (let m = 0; m < months - 1; m++) {
    runEvents(s, MONTH[m]!);
    out.push(nations.map((n) => s.world.nations.cols.efficiency[n]!));
  }
  return out;
}

describe('combat-efficiency modes (PLAN 1.22)', () => {
  it('dynamic: low in peace, high at war, jumping to the target each month', () => {
    const ce = evolve('dynamic', [SWE, GER], 3, (s) => s.world.wars.set(GER, POL, true));
    expect(ce[0]![0]).toBeCloseTo(PEACE_CE, 9); // Sweden at peace, fully supplied
    expect(ce[0]![1]).toBeGreaterThan(WAR_CE - 0.11); // Germany at war (score ≈ 0)
    expect(ce[0]![1]).toBeLessThanOrEqual(WAR_CE + 0.15);
  });

  it('progressive: one step a month toward the target', () => {
    const ce = evolve('progressive', [SWE], 4); // starts at 1.0, target 0.7
    expect(ce.map((r) => r[0])).toEqual([1, 1, 1, 1].map((v, i) => v - PROGRESSIVE_STEP * (i + 1)).map((v) => expect.closeTo(v, 9)));
  });

  it('static: the scenario value, constant', () => {
    const ce = evolve('static', [GER, SWE], 3, (s) => s.world.wars.set(GER, POL, true));
    const agg = (tag: string): number => NATIONS_1938.find((n) => n.tag === tag)!.aggression;
    for (const row of ce) expect(row).toEqual([staticCe(agg('GER')), staticCe(agg('SWE'))]);
  });

  it('locked: every nation at 1.0', () => {
    const ce = evolve('locked', [GER, SWE, POL], 2, (s) => s.world.wars.set(GER, POL, true));
    for (const row of ce) expect(row).toEqual([1, 1, 1]);
  });

  it('random: re-rolled each month within bounds, deterministic per seed', () => {
    const a = evolve('random', [GER, SWE], 4);
    const b = evolve('random', [GER, SWE], 4);
    expect(a).toEqual(b);
    for (const row of a) for (const v of row) expect(v >= RANDOM_MIN && v <= RANDOM_MAX).toBe(true);
    expect(new Set(a.map((r) => r[0])).size).toBeGreaterThan(2); // it changes month to month
    expect(a[0]![0]).not.toBe(a[0]![1]); // and differs between nations
  });

  it('a God-locked nation keeps its CE in every mode', () => {
    const ce = evolve('dynamic', [SWE], 3, (s) => {
      s.command({ kind: 'setEfficiency', nation: SWE, value: 1.3 });
      s.command({ kind: 'lockEfficiency', nation: SWE, locked: true });
    });
    for (const row of ce) expect(row[0]).toBe(1.3);
  });

  it('CE costs gold above the peace level, and scales damage dealt', () => {
    const peace = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const war = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    war.world.wars.set(GER, POL, true);
    runEvents(peace, 1);
    runEvents(war, 1);
    expect(war.world.nations.cols.expenses[GER]!).toBeGreaterThan(peace.world.nations.cols.expenses[GER]!);

    const dealt = (ce: number): number => {
      const s = new Sim({ scenario: '1938', seed: 4, assets: assets1938(W) });
      const w = s.world;
      w.formations.ids().forEach((f) => destroyFormation(w, f));
      w.wars.set(GER, POL, true);
      const [x, y] = cellOf(30, 50, W, H).map(Math.floor) as [number, number];
      const a = addDivision(w, GER, x + 0.5, y + 0.5);
      addDivision(w, POL, x + 1.5, y + 0.5);
      w.nations.cols.efficiency[GER] = ce;
      combatSystem(w);
      let sum = 0;
      for (let i = 0; i < w.out.fires.length; i += FIRE_STRIDE) if (w.elements.cols.formation[w.out.fires[i + 2]!] === a) sum += w.out.fires[i + 5]!;
      return sum;
    };
    expect(dealt(1.2) / dealt(0.6)).toBeCloseTo(2, 9);
  });
});
