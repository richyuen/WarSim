import { describe, expect, it } from 'vitest';
import cities1938 from '../../data/scenarios/1938/cities.json' with { type: 'json' };
import { EventKind } from '../../src/shared/events';
import { TICKER_KINDS } from '../../src/shared/history';
import { cueOfKind } from '../../src/shared/sound';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { NUKE_PROGRAMME_INCOME } from '../../src/sim/systems/nuclear';
import { incomeRankOf, nextTech, researchSystem } from '../../src/sim/systems/research';
import { grantTechs, knowsTechs, techMask } from '../../src/sim/tech';
import type { World } from '../../src/sim/world';
import { historyText, incomeRank } from '../../src/ui/historyText';
import { historyRows } from '../../src/worker/historyRows';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.37i (from 7.37g: Latvia and Lithuania went for the bomb on run 10's seeds 1307 and 8693
// with no word in the game): the day a nation's research gives it the atomic bomb, the history
// says so, with its income's rank. Latvia here, given the bomb's prerequisites and
// NUKE_PROGRAMME_INCOME, its line opened as `nextTech` opens it in 1945 and nearly paid.

const [LAT, GER] = ['LAT', 'GER'].map(nationId) as [number, number];
const nationName = (n: number): string => `nation.${NATIONS_1938[n - 1]?.tag ?? ''}`;
const defName = (d: number): string => cities1938.cities[d]?.name ?? '';
const cityName = (w: World) => (v: number): string => defName(w.cities.cols.def[v]!) || (w.cityNames.get(v) ?? '');

/** Latvia a day from the bomb: its prerequisites known, a great power's income, its line all but paid. */
function latviaOnTheEve(): { s: Sim; bomb: number } {
  const s = new Sim({ scenario: '1938', seed: 1307, assets: assets1938(SIZE_1938.w) });
  const w = s.world;
  const nc = w.nations.cols;
  const techs = w.rules!.techs;
  const bomb = techs.findIndex((t) => t.id === 'atomic_bomb');
  grantTechs(w, LAT, techMask(techs.map((t, i) => (t.year <= 1945 && i !== bomb ? i : -1)).filter((i) => i >= 0)));
  nc.income[LAT] = NUKE_PROGRAMME_INCOME;
  expect(nextTech(w, LAT, 1945, []), 'the bomb is its next tech in 1945').toBe(bomb);
  const line = w.research.create();
  w.research.cols.nation[line] = LAT;
  w.research.cols.tech[line] = bomb;
  w.research.cols.paid[line] = techs[bomb]!.gold - 0.5;
  nc.research[LAT] = 1;
  nc.gold[LAT] = 1000;
  return { s, bomb };
}

describe('the game tells a new nuclear power (PLAN 7.37i)', () => {
  it('Latvia learns the bomb: one row on that day, with its income rank', () => {
    const { s, bomb } = latviaOnTheEve();
    const w = s.world;
    const rank = incomeRankOf(w, LAT);
    researchSystem(w);
    expect(knowsTechs(w, LAT, techMask([bomb])), 'the bomb learned').toBe(true);
    const rows = historyRows(w, nationName, cityName(w), defName).filter((r) => r.kind === EventKind.NuclearPower);
    expect(rows).toHaveLength(1);
    const r = rows[0]!;
    expect([r.tick, r.a, r.b]).toEqual([w.tick, LAT, rank]);
    expect(rank, 'NUKE_PROGRAMME_INCOME among the 1938 incomes').toBeGreaterThan(1);
    expect(historyText(r)).toBe(`Latvia has learned to build the atomic bomb, with the world's ${incomeRank(rank)}`);
    expect(TICKER_KINDS.has(EventKind.NuclearPower)).toBe(true);
    expect(cueOfKind(EventKind.NuclearPower)).toBe('nuke');
    // Paid in full: no second row on the next day.
    researchSystem(w);
    expect(historyRows(w, nationName, cityName(w), defName).filter((r) => r.kind === EventKind.NuclearPower)).toHaveLength(1);
  });

  it('no row for another tech learned, nor for the bomb given by God Mode', () => {
    const { s } = latviaOnTheEve();
    const w = s.world;
    w.research.cols.tech[[...w.research.ids()][0]!] = w.rules!.techs.findIndex((t) => t.id === 'rocketry');
    researchSystem(w);
    s.command({ kind: 'grantTech', nation: GER, tech: 'atomic_bomb' });
    s.step(1);
    expect(historyRows(w, nationName, cityName(w), defName).some((r) => r.kind === EventKind.NuclearPower)).toBe(false);
  });

  it('income ranks in words', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(incomeRank)).toEqual([
      'largest income',
      '2nd largest income',
      '3rd largest income',
      '4th largest income',
      '11th largest income',
      '12th largest income',
      '13th largest income',
      '21st largest income',
      '22nd largest income',
      '23rd largest income',
      '101st largest income',
    ]);
  });
});
