import { describe, expect, it } from 'vitest';
import cities1938 from '../../data/scenarios/1938/cities.json' with { type: 'json' };
import { EventKind } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { declareWar } from '../../src/sim/systems/war';
import { RETALIATION_DAYS, warheadsOf } from '../../src/sim/systems/nuclear';
import { DEFENDERS, type War } from '../../src/sim/wars';
import type { World } from '../../src/sim/world';
import { historyText } from '../../src/ui/historyText';
import { historyRows } from '../../src/worker/historyRows';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 6.4b: the daily decision. An AI nation at war with a warhead strikes its best target when
// the utility is above 0, and tells it (`NukeDecided`, its utility × 1000); a nation struck, of
// retaliation doctrine, strikes back at who struck it, MAD or not; its answer gives England no
// grievance (PLAN 6.12e).

const { w: W, h: H } = SIZE_1938;
const [ENG, FRA, GER] = ['ENG', 'FRA', 'GER'].map(nationId) as [number, number, number];
const paris = cellOf(2.35, 48.86, W, H);

/** The events of kind `k` over `hours`, each [a, b, x, y]. */
function run(s: Sim, hours: number, k: number, score?: () => void): number[][] {
  const out: number[][] = [];
  for (let h = 0; h < hours; h++) {
    score?.();
    s.step(1, (w: World) => {
      const ev = w.out.events;
      for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === k) out.push([ev[i + 2]!, ev[i + 3]!, ev[i + 4]!, ev[i + 5]!]);
      ev.length = 0;
      w.out.fires.length = 0;
    });
  }
  return out;
}

/** France at war with Germany, given `warheads`; Germany has none. */
function franceAtWar(warheads: number): { s: Sim; war: War } {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
  const w = s.world;
  w.settings.nukesEnabled = true;
  s.command({ kind: 'grantWarheads', nation: FRA, count: warheads });
  s.step(1);
  const war = declareWar(w, GER, FRA, true)!;
  return { s, war };
}

describe('the nuclear decision (PLAN 6.4b)', () => {
  it('France, fighting to the death and losing, strikes Germany by bomber on the next day, and tells why', () => {
    const { s, war } = franceAtWar(1);
    const decided = run(s, 30, EventKind.NukeDecided, () => {
      war.fightToDeath[DEFENDERS] = true;
      war.score = 100;
    });
    expect(decided.length).toBe(1);
    const [n, u] = decided[0]!;
    expect(n).toBe(FRA);
    expect(u).toBeGreaterThan(0);
    expect(warheadsOf(s.world, FRA)).toBe(0);
    process.stderr.write(`France decided: utility ${u! / 1000} at (${decided[0]![2]!.toFixed(1)}, ${decided[0]![3]!.toFixed(1)})\n`);
    // PLAN 7.25c: the history tells the decision by its place and in words, no engine number in it.
    const w = s.world;
    const nation = (v: number): string => `nation.${NATIONS_1938[v - 1]!.tag}`;
    const city = (v: number): string => cities1938.cities[w.cities.cols.def[v]!]?.name ?? '';
    const rows = historyRows(w, nation, city).filter((r) => r.kind === EventKind.NukeDecided);
    expect(rows.length).toBe(1);
    const text = historyText(rows[0]!);
    process.stderr.write(`${text}\n`);
    expect(text).toMatch(/^France decided on a nuclear strike near [^,\d]+, (after long hesitation|after weighing it|without hesitation)$/);
  });

  it('France neither losing nor fighting to the death, or its AI off: no strike in ten days', () => {
    const a = franceAtWar(1);
    expect(run(a.s, 240, EventKind.NukeDecided, () => (a.war.score = 0))).toEqual([]);
    expect(warheadsOf(a.s.world, FRA)).toBe(1);
    const b = franceAtWar(1);
    b.s.world.nations.cols.aiOff[FRA] = 1;
    expect(run(b.s, 240, EventKind.NukeDecided, () => {
      b.war.fightToDeath[DEFENDERS] = true;
      b.war.score = 100;
    })).toEqual([]);
  });

  it('struck by England, France (MAD: both armed, bombers both) strikes back within days; not struck, it does not', () => {
    const make = (): { s: Sim; war: War } => {
      const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
      const w = s.world;
      w.settings.nukesEnabled = true;
      w.nations.cols.aiOff[ENG] = 1;
      w.nations.cols.aggression[FRA] = Math.max(w.nations.cols.aggression[FRA]!, 20);
      s.command({ kind: 'grantWarheads', nation: ENG, count: 5 });
      s.command({ kind: 'grantWarheads', nation: FRA, count: 5 });
      s.step(1);
      // Allies in 1938: France leaves its alliance, that the two may be at war.
      w.alliances.leave(FRA);
      const war = declareWar(w, ENG, FRA, true);
      expect(war).not.toBeNull();
      return { s, war: war! };
    };
    const calm = make();
    expect(run(calm.s, 24 * 5, EventKind.NukeDecided)).toEqual([]);
    const hit = make();
    // England's burst on Paris: France's grievance against it, for RETALIATION_DAYS from then.
    // Its bomber may be stopped short over Paris, BOMBER_INTERCEPT × (1 − its superiority there):
    // since ADR-560's zones no one has flown in Paris's (0.4; before, England's own patrols over
    // Britain were in it), and it is: England launches again until one bursts, four at most.
    let g: { by: number; until: number } | undefined;
    let launches = 0;
    let tick0 = 0;
    for (let h = 0; h < 4 * 48 && !g; h++) {
      if (hit.s.world.nukeLaunches.length === 0 && launches < 4) {
        hit.s.command({ kind: 'launchNuke', nation: ENG, x: paris[0], y: paris[1], missile: false });
        launches++;
        tick0 = hit.s.world.tick;
      }
      run(hit.s, 1, EventKind.NukeDecided);
      g = hit.s.world.nukeGrievance.get(FRA);
    }
    process.stderr.write(`England's launches on Paris until one burst: ${launches}\n`);
    expect(g?.by).toBe(ENG);
    expect(g!.until).toBeGreaterThan(tick0 + (RETALIATION_DAYS - 1) * 24);
    expect(g!.until).toBeLessThanOrEqual(tick0 + (RETALIATION_DAYS + 2) * 24);
    // A save carries a grievance: France's, against England.
    const c = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    c.load(hit.s.save());
    expect(c.world.nukeGrievance.get(FRA)).toEqual(hit.s.world.nukeGrievance.get(FRA));
    // One strike back for one hit, the grievance spent; then MAD again: no more in ten days.
    const back = run(hit.s, 24 * 10, EventKind.NukeDecided);
    process.stderr.write(`France strikes back: ${JSON.stringify(back)}
`);
    expect(back.length).toBe(1);
    expect(back[0]![0]).toBe(FRA);
    expect(back[0]![1]).toBeGreaterThan(0);
    expect(hit.s.world.nukeGrievance.has(FRA)).toBe(false);
    // France's answer settles the score (PLAN 6.12e): England holds no grievance from it.
    expect(hit.s.world.nukeGrievance.has(ENG)).toBe(false);
  });
});
