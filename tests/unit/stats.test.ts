import { describe, expect, it } from 'vitest';
import { isMonthStart } from '../../src/shared/calendar';
import { seriesOf, topNations } from '../../src/shared/statSeries';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { ownedAreas } from '../../src/sim/landArea';
import { Sim } from '../../src/sim/sim';
import { STAT_STRIDE, StatSeries } from '../../src/sim/stats';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 1.34b AT (unit part): the statistics series match the sim at the sampled months.

const W = SIZE_1938.w;
const [GER, POL] = ['GER', 'POL'].map(nationId) as number[];

/** What a sample of nation n should hold right now. */
function expected(w: World, n: number, tick: number, area: Float64Array): number[] {
  const nc = w.nations.cols;
  let men = 0;
  w.formations.forEach((f) => {
    // The men of its army: a fleet's crews are not counted (PLAN 4.2b).
    if (w.formations.cols.nation[f] === n && !w.afloat(f)) men += w.formations.cols.strength[f]!;
  });
  const f = Math.fround;
  return [f(tick), n, f(area[n]!), f(nc.income[n]!), f(nc.gold[n]!), f(men), f(nc.casualties[n]!)];
}

describe('statistics series (PLAN 1.34b)', () => {
  it('each month start holds one sample per living nation, equal to the sim at that tick', () => {
    const s = new Sim({ scenario: '1938', seed: 4, assets: assets1938(W) });
    s.command({ kind: 'declareWar', attacker: GER!, defender: POL! });
    let months = 0;
    s.step(24 * 92, (w) => {
      w.out.events.length = 0;
      w.out.fires.length = 0;
      // Systems run with world.tick = T; the after-step hook sees T + 1.
      const t = w.tick - 1;
      if (!isMonthStart(w.startDay, t)) return;
      months++;
      const rows = w.stats.rows;
      const at: number[][] = [];
      for (let i = 0; i < rows.length; i += STAT_STRIDE) if (rows[i] === t) at.push(rows.slice(i, i + STAT_STRIDE));
      let living = 0;
      w.nations.forEach((n) => {
        if (w.nations.cols.living[n] === 1) living++;
      });
      expect(at.length, `tick ${t}`).toBe(living);
      // Sampled by the last system of this tick: the state after it equals the sample. Land is km²
      // of true area (PLAN 1.42d2, ADR-52), not the count of cells.
      const area = ownedAreas(w.cells.owner, w.cells.w, w.cells.h, w.nations.highWater);
      for (const r of at) expect(r.map(Math.fround)).toEqual(expected(w, r[1]!, t, area));
      const ger = at.find((r) => r[1] === GER)!;
      expect(ger[2]).toBeGreaterThan(300_000);
      expect(ger[2]).not.toBe(w.nations.cols.cells[GER!]);
    });
    expect(months).toBeGreaterThanOrEqual(3);
    // A war of three months costs both sides men.
    expect(s.world.nations.cols.casualties[GER!]).toBeGreaterThan(0);
    expect(s.world.nations.cols.casualties[POL!]).toBeGreaterThan(0);
    const pol = seriesOf(s.world.stats.rows, POL!, 'casualties');
    expect(pol.length).toBe(months);
    for (let i = 1; i < pol.length; i++) expect(pol[i]![1]).toBeGreaterThanOrEqual(pol[i - 1]![1]); // cumulative
  }, 180_000);

  it('survives save/load exactly (f32 section) and replays identically', () => {
    const s = new Sim({ scenario: '1938', seed: 4, assets: assets1938(W) });
    s.step(24 * 40);
    const t = new Sim({ scenario: '1938', seed: 5, assets: assets1938(W) });
    t.load(s.save());
    expect(t.world.stats.rows).toEqual(s.world.stats.rows);
    // A save from before PLAN 1.42d2 (land in cells, section `stats.rows`) starts an empty series.
    const old = new StatSeries();
    old.deserialize([{ name: 'stats.rows', dtype: 'f32', data: Float32Array.from([0, 1, 5, 0, 0, 0, 0]) }]);
    expect(old.length).toBe(0);
    s.step(24 * 35);
    t.step(24 * 35);
    expect(t.hash()).toBe(s.hash());
  }, 180_000);

  it('chart helpers: series per nation and top nations at the latest sample', () => {
    // [tick, nation, land, income, gold, men, casualties]
    const rows = [10, 1, 5, 0, 0, 0, 0, 10, 2, 9, 0, 0, 0, 0, 20, 1, 12, 0, 0, 0, 0, 20, 2, 7, 0, 0, 0, 0, 20, 3, 12, 0, 0, 0, 0];
    expect(seriesOf(rows, 1, 'land')).toEqual([
      [10, 5],
      [20, 12],
    ]);
    expect(topNations(rows, 'land', 2)).toEqual([1, 3]); // tie at 12 broken by id
  });
});
