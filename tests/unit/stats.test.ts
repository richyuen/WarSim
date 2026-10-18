import { describe, expect, it } from 'vitest';
import { isMonthStart } from '../../src/shared/calendar';
import { SERIES_STRIDE, seriesOf, topNations } from '../../src/shared/statSeries';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { ownedAreas } from '../../src/sim/landArea';
import { Sim } from '../../src/sim/sim';
import { chartRows, STAT_STRIDE, StatSeries } from '../../src/sim/stats';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';
import { at1938 } from '../helpers/checkpoint';

// PLAN 1.34b AT (unit part): the statistics series match the sim at the sampled months.

const W = SIZE_1938.w;
const [GER, POL] = ['GER', 'POL'].map(nationId) as number[];

/** What a sample of nation n should hold right now. */
function expected(w: World, n: number, tick: number, area: Float64Array): number[] {
  const nc = w.nations.cols;
  let men = 0;
  w.formations.forEach((f) => {
    // The men of its army: a fleet's crews and a wing's aircraft are not counted (PLAN 4.2b, 5.11c);
    // an army aboard transports is (PLAN 4.5a; `offLand` left it out, which no month start of this
    // run met until PLAN 7.26c3a's landings).
    if (w.formations.cols.nation[f] === n && !w.isFleet(f) && !w.isWing(f)) men += w.formations.cols.strength[f]!;
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
    const pol = seriesOf(chartRows(s.world.stats), POL!, 'casualties');
    expect(pol.length).toBe(months);
    for (let i = 1; i < pol.length; i++) expect(pol[i]![1]).toBeGreaterThanOrEqual(pol[i - 1]![1]); // cumulative
  }, 180_000);

  it('survives save/load exactly (f32 section) and replays identically', () => {
    const s = at1938(4, 24 * 40);
    const t = new Sim({ scenario: '1938', seed: 5, assets: assets1938(W) });
    t.load(s.save());
    expect(t.world.stats.rows).toEqual(s.world.stats.rows);
    expect(t.world.stats.air).toEqual(s.world.stats.air);
    expect(t.world.stats.nuke).toEqual(s.world.stats.nuke);
    // A save from before PLAN 1.42d2 (land in cells, section `stats.rows`) starts an empty series.
    const old = new StatSeries();
    old.deserialize([{ name: 'stats.rows', dtype: 'f32', data: Float32Array.from([0, 1, 5, 0, 0, 0, 0]) }]);
    expect(old.length).toBe(0);
    s.step(24 * 35);
    t.step(24 * 35);
    expect(t.hash()).toBe(s.hash());
  }, 180_000);

  it('chart helpers: series per nation and top nations at the latest sample', () => {
    // [tick, nation, land, income, gold, men, casualties, aircraft, airLost, warheads, nukeDead,
    // fallout] (PLAN 5.11c: the air's two joined; PLAN 7.12: the nuclear age's three, SERIES_STRIDE 12)
    const rows = [
      10, 1, 5, 0, 0, 0, 0, 40, 0, 2, 0, 0,
      10, 2, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      20, 1, 12, 0, 0, 0, 0, 35, 9, 1, 650000, 14,
      20, 2, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      20, 3, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ];
    expect(rows.length % SERIES_STRIDE).toBe(0);
    expect(seriesOf(rows, 1, 'land')).toEqual([
      [10, 5],
      [20, 12],
    ]);
    expect(topNations(rows, 'land', 2)).toEqual([1, 3]); // tie at 12 broken by id
    expect(seriesOf(rows, 1, 'aircraft')).toEqual([
      [10, 40],
      [20, 35],
    ]);
    expect(seriesOf(rows, 1, 'airLost')).toEqual([
      [10, 0],
      [20, 9],
    ]);
    expect(seriesOf(rows, 1, 'warheads')).toEqual([
      [10, 2],
      [20, 1],
    ]);
    expect(seriesOf(rows, 1, 'nukeDead')).toEqual([
      [10, 0],
      [20, 650000],
    ]);
    expect(seriesOf(rows, 1, 'fallout')).toEqual([
      [10, 0],
      [20, 14],
    ]);
    expect(topNations(rows, 'nukeDead', 1)).toEqual([1]);
  });

  // PLAN 7.12 (critic run 7: "add warheads, nuclear dead and fallout to the panel and the charts").
  it("the nuclear age's numbers: a nation's warheads, its dead and its land under fallout, sampled, saved and loaded", () => {
    const s = new Sim({ scenario: '1938', seed: 5, assets: assets1938(W) });
    s.command({ kind: 'setSetting', key: 'aiEnabled', value: false });
    s.command({ kind: 'grantWarheads', nation: GER!, count: 4 });
    s.step(1);
    // A warhead of God's on Warsaw: the dead on Poland's land, and fallout over some of it.
    const [wx, wy] = cellOf(21.01, 52.23, W, SIZE_1938.h);
    s.command({ kind: 'godNuke', x: wx, y: wy, thermonuclear: false });
    for (let h = 0; h < 48 && !s.world.nukeDead.has(POL!); h++) s.step(1);
    expect(s.world.nukeDead.get(POL!) ?? 0, 'the dead of the burst on Polish land').toBeGreaterThan(1000);
    const burst = s.world.tick;
    // To the next month's sample after it.
    for (let h = 0; h < 24 * 40 && !(s.world.stats.rows.length > 0 && s.world.stats.rows[s.world.stats.rows.length - STAT_STRIDE]! > burst); h++) s.step(1);
    const rows = chartRows(s.world.stats);
    const last = (n: number, m: 'warheads' | 'nukeDead' | 'fallout'): number => seriesOf(rows, n, m).at(-1)![1];
    expect(last(GER!, 'warheads')).toBe(4);
    expect(last(POL!, 'nukeDead')).toBeGreaterThan(1000);
    expect(last(POL!, 'nukeDead')).toBeCloseTo(Math.fround(s.world.nukeDead.get(POL!)!), 0);
    expect(last(POL!, 'fallout')).toBeGreaterThan(0);
    expect(last(GER!, 'nukeDead')).toBe(0);
    // Saved and loaded: the dead, and the series.
    const u = new Sim({ scenario: '1938', seed: 5, assets: assets1938(W) });
    u.load(s.save());
    expect(u.world.nukeDead).toEqual(s.world.nukeDead);
    expect(u.world.stats.nuke).toEqual(s.world.stats.nuke);
    expect(u.hash()).toBe(s.hash());
    // A save from before it (no section): 0 beside every record.
    const old = new StatSeries();
    old.deserialize([{ name: 'stats.km2', dtype: 'f32', data: Float32Array.from([0, 1, 5, 0, 0, 0, 0]) }]);
    expect(old.nuke).toEqual([0, 0, 0]);
  }, 180_000);
});
