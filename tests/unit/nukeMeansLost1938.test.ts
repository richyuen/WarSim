import { describe, expect, it } from 'vitest';
import cities1938 from '../../data/scenarios/1938/cities.json' with { type: 'json' };
import { EventKind } from '../../src/shared/events';
import { TICKER_KINDS } from '../../src/shared/history';
import { cueOfKind } from '../../src/shared/sound';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { canDeliver } from '../../src/sim/systems/nuclear';
import type { World } from '../../src/sim/world';
import { historyText } from '../../src/ui/historyText';
import { historyRows } from '../../src/worker/historyRows';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.37b3 (critic runs 9 and 10, `c10_g2_5309_CZS.json`: Czechoslovakia, armed in the editor,
// "dies holding all 10 warheads … nothing in play says the means are lost"): seed 5309, a strategic
// bomber group placed at Prague as the editor's tool places one, 10 warheads, Germany's war on it.
// Prague's airbase, its only one, is taken on day 10.8 and its groups are lost with it
// (`docs/evidence/7.37/wingsLost-5309-CZS.jsonl`): the history says so, once, naming Germany and
// Prague. Restated by PLAN 7.79b (ADR-634): the day Prague's airbase falls moves with the land
// war's rules (day 10.8, then 13.4 and later as the allotment changed); the row is told on the
// day the means are lost, whichever it is, within 40 days.

const { w: W } = SIZE_1938;
const [CZS, GER] = ['CZS', 'GER'].map(nationId) as [number, number];
const nationName = (n: number): string => `nation.${NATIONS_1938[n - 1]?.tag ?? ''}`;
const defName = (d: number): string => cities1938.cities[d]?.name ?? '';
const cityName = (w: World) => (v: number): string => defName(w.cities.cols.def[v]!) || (w.cityNames.get(v) ?? '');

function czechoslovakia(warheads: number): Sim {
  const s = new Sim({ scenario: '1938', seed: 5309, assets: assets1938(W) });
  const w = s.world;
  const rules = w.rules!;
  const template = rules.templates.findIndex((t) => t.elements.length > 0 && rules.units[t.elements[0]!.unit]!.cls === 'bomber_str');
  s.command({ kind: 'spawnWing', nation: CZS, x: w.nations.cols.capitalX[CZS]!, y: w.nations.cols.capitalY[CZS]!, template });
  if (warheads > 0) s.command({ kind: 'grantWarheads', nation: CZS, count: warheads });
  s.command({ kind: 'declareWar', attacker: GER, defender: CZS });
  return s;
}

describe("a holder's last means of delivery lost is told (PLAN 7.37b3)", () => {
  it("Czechoslovakia's bomber lost with Prague's airbase: one row, Germany and Prague named, on the day it is lost", () => {
    const s = czechoslovakia(10);
    s.step(24);
    expect(canDeliver(s.world, CZS), 'it can deliver at first').toBe(true);
    let lost = -1;
    for (let d = 1; d < 40 && lost < 0; d++) {
      s.step(24);
      if (!canDeliver(s.world, CZS)) lost = d;
    }
    process.stderr.write(`Czechoslovakia's means lost on day ${lost}
`);
    expect(lost, 'the means lost within 40 days').toBeGreaterThan(0);
    const rows = historyRows(s.world, nationName, cityName(s.world), defName).filter((r) => r.kind === EventKind.NukeMeansLost);
    expect(rows).toHaveLength(1);
    const r = rows[0]!;
    expect([r.a, r.b]).toEqual([CZS, GER]);
    expect(r.tick / 24).toBeGreaterThanOrEqual(lost);
    expect(r.tick / 24).toBeLessThan(lost + 1);
    expect(historyText(r)).toBe('Czechoslovakia lost its last means to deliver its warheads: Germany took its airbase near Prague, and its strategic bombers were lost with it');
    expect(TICKER_KINDS.has(EventKind.NukeMeansLost)).toBe(true);
    expect(cueOfKind(EventKind.NukeMeansLost)).not.toBeNull();
  });

  it('a group lost with its airbase still held: the sentence without a taker', () => {
    const s = czechoslovakia(10);
    s.step(24);
    const w = s.world;
    let group = 0;
    w.formations.forEach((f) => {
      if (w.formations.cols.nation[f] === CZS && w.isWing(f) && w.rules!.units[w.rules!.templates[w.formations.cols.template[f]!]!.elements[0]!.unit]!.cls === 'bomber_str') group = f;
    });
    s.command({ kind: 'removeFormation', id: group });
    s.step(1);
    const rows = historyRows(w, nationName, cityName(w), defName).filter((r) => r.kind === EventKind.NukeMeansLost);
    expect(rows.map((r) => [r.a, r.b])).toEqual([[CZS, 0]]);
    expect(historyText(rows[0]!)).toBe('Czechoslovakia lost its last means to deliver its warheads: its last strategic bomber group near Prague was lost');
  });

  it('no row for a group lost by a nation holding no warhead', () => {
    const s = czechoslovakia(0);
    s.step(24 * 14);
    expect(historyRows(s.world, nationName, cityName(s.world), defName).some((r) => r.kind === EventKind.NukeMeansLost)).toBe(false);
  });
});
