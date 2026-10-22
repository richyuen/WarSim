import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { blastRadius, CAPITAL_MEN_MIN, desperationOf, nukeTargets, placeParts, TARGET_CAPITAL, targetValue } from '../../src/sim/systems/nuclear';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { grantTechs, techMask } from '../../src/sim/tech';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.18 (critic R8-B1: "France and Poland, given 10 warheads in the editor and overrun, never
// strike in 120 to 150 days"; "some strikes hit near-empty or third-party places"). The critic's
// France (seed 7127, 10 warheads, Germany's war on it): a capital taken is extreme desperation
// (7.18a, ADR-485); the army at its gates is weighed against the men of its theatre (7.18c); France
// strikes while it still has a bomber. No place within RESTRIKE_RADII radii of a recent burst, and a
// small nation's capital is not worth TARGET_CAPITAL (7.18d). PLAN 7.62 (ADR-629): an empty capital is
// no first strike's target, and the critic's France, whose one strike was an empty Berlin, holds fire.

const { w: W, h: H } = SIZE_1938;
const [FRA, GER, LUX] = ['FRA', 'GER', 'LUX'].map(nationId) as [number, number, number];

describe('an overrun holder of warheads strikes (PLAN 7.18)', () => {
  // Amended by PLAN 7.62 (ADR-629, the user's decision b, 2026-10-22). The claim was "France struck"
  // (before day 75, its first decision on Germany, a launch shot down and the next within the gap):
  // its only strike was an empty Berlin (capital 0.3, men share 0, 334,000 people, days 59-60). With
  // an empty capital no first strike's target, France's best place in reach is an army under the floor
  // (utility 0.005-0.019, NUKE_FLOOR 0.025), and it holds fire. The gap and the launch shot down are
  // `nukeGapShort1938.test.ts`'s and `nukeDelivery1938.test.ts`'s.
  // Restated by PLAN 7.79b (ADR-634): with the army allotted to the threatened sectors first, France
  // finds an army over the floor (day 48, men share 0.063, no capital weighed; with the rule's first
  // form, day 76, Germany's capital moved to the French front with an army in the blast, men share
  // 0.0127). The claim is the rule's: France decides on no empty capital (men share under
  // CAPITAL_MEN_MIN with a capital weighed) in 100 days.
  it("the critic's France: an empty Berlin weighs no capital on a first strike, and France decides on no empty capital in 100 days", () => {
    const s = new Sim({ scenario: '1938', seed: 7127, assets: assets1938(W) });
    const w = s.world;
    s.command({ kind: 'grantWarheads', nation: FRA, count: 10 });
    s.command({ kind: 'declareWar', attacker: GER, defender: FRA });
    const decided: { day: number; x: number; y: number; menShare: number; capital: number }[] = [];
    let launched = 0;
    /** Places France weighs within a blast's radius of Berlin with men share under CAPITAL_MEN_MIN, and of them with the capital weighed. */
    let emptyBerlin = 0;
    let emptyBerlinCapital = 0;
    for (let d = 0; d < 100; d++) {
      s.step(24, (ww) => {
        const ev = ww.out.events;
        for (let i = 0; i < ev.length; i += 6) {
          if (ev[i + 2] !== FRA) continue;
          if (ev[i + 1] === EventKind.NukeLaunched) launched++;
          if (ev[i + 1] !== EventKind.NukeDecided) continue;
          const war = ww.wars.list.find((x) => x.sides[1].includes(FRA));
          const p = war ? placeParts(ww, FRA, war, 1, ev[i + 4]!, ev[i + 5]!) : { menShare: -1, capital: -1 };
          decided.push({ day: d, x: ev[i + 4]!, y: ev[i + 5]!, menShare: p.menShare, capital: p.capital });
        }
        ww.out.events.length = 0;
        ww.out.fires.length = 0;
      });
      const war = w.wars.list.find((x) => x.sides[1].includes(FRA));
      if (!war) break;
      const nc = w.nations.cols;
      for (const [x, y] of nukeTargets(w, FRA, war, 1)) {
        if (seaKm(w, x, y, nc.capitalX[GER]!, nc.capitalY[GER]!) > blastRadius(1)) continue;
        const p = placeParts(w, FRA, war, 1, x, y);
        if (p.menShare >= CAPITAL_MEN_MIN) continue;
        emptyBerlin++;
        if (p.capital > 0) emptyBerlinCapital++;
      }
    }
    process.stderr.write(`France decided ${decided.length} strike(s): ${JSON.stringify(decided)}; empty Berlin weighed ${emptyBerlin} times, its capital ${emptyBerlinCapital}
`);
    expect(emptyBerlin, 'France weighs an empty Berlin').toBeGreaterThan(0);
    expect(emptyBerlinCapital, 'an empty Berlin weighs no capital on a first strike').toBe(0);
    expect(decided.filter((x) => x.menShare < 0 || (x.capital > 0 && x.menShare < CAPITAL_MEN_MIN)), 'France decides on an empty capital').toEqual([]);
    expect(launched, 'France launched').toBeLessThanOrEqual(decided.length);
  }, 600_000);

  // PLAN 7.18a's fall, apart since 7.18i (ADR-491): with its costs × the chance through, France's
  // warhead bursts on Berlin on day 63 and Germany sues for peace before Paris falls. Without
  // warheads the same war takes Paris (about day 79) and goes on.
  it("the critic's France without warheads: after the fall of Paris it stays in extreme desperation", () => {
    const s = new Sim({ scenario: '1938', seed: 7127, assets: assets1938(W) });
    const w = s.world;
    s.command({ kind: 'declareWar', attacker: GER, defender: FRA });
    for (let d = 0; d < 100; d++) {
      s.step(24, (ww) => {
        ww.out.events.length = 0;
        ww.out.fires.length = 0;
      });
    }
    // Paris fell: France is in the war's capitals lost and, desperate, still extreme with no German near its new capital.
    const war = w.wars.list.find((x) => x.sides[1].includes(FRA))!;
    expect(war, 'the war goes on').toBeDefined();
    expect(war.capitalsLost).toContain(FRA);
    const { desperation, extreme } = desperationOf(w, FRA, war, 1);
    expect(desperation).toBeGreaterThanOrEqual(1);
    expect(extreme).toBe(true);
  }, 600_000);

  it("a small nation's capital is not worth TARGET_CAPITAL; a great one's is", () => {
    const s = new Sim({ scenario: '1938', seed: 7, assets: assets1938(W) });
    const w = s.world;
    // Missiles: every warhead gets there, so the value is the place's own.
    grantTechs(w, GER, techMask([w.rules!.techs.findIndex((t) => t.id === 'ballistic_missiles')]));
    const war = w.wars.start([GER], [FRA, LUX], 0);
    const paris = cellOf(2.35, 48.86, W, H);
    const lux = cellOf(6.13, 49.61, W, H);
    const vParis = targetValue(w, GER, war, 0, paris[0] + 0.5, paris[1] + 0.5);
    const vLux = targetValue(w, GER, war, 0, lux[0] + 0.5, lux[1] + 0.5);
    process.stderr.write(`value at Paris ${vParis.toFixed(3)}, at Luxembourg ${vLux.toFixed(3)}\n`);
    expect(vParis).toBeGreaterThanOrEqual(TARGET_CAPITAL);
    expect(vLux).toBeLessThan(TARGET_CAPITAL);
  }, 300_000);
});
