import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { blastRadius, desperationOf, nukeTargets, RESTRIKE_DAYS, RESTRIKE_RADII, TARGET_CAPITAL, targetValue } from '../../src/sim/systems/nuclear';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { grantTechs, techMask } from '../../src/sim/tech';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.18 (critic R8-B1: "France and Poland, given 10 warheads in the editor and overrun, never
// strike in 120 to 150 days"; "some strikes hit near-empty or third-party places"). The critic's
// France (seed 7127, 10 warheads, Germany's war on it): a capital taken is extreme desperation
// (7.18a, ADR-485); the army at its gates is weighed against the men of its theatre (7.18c); France
// strikes while it still has a bomber. No place within RESTRIKE_RADII radii of a recent burst, and a
// small nation's capital is not worth TARGET_CAPITAL (7.18d).

const { w: W, h: H } = SIZE_1938;
const [FRA, GER, LUX] = ['FRA', 'GER', 'LUX'].map(nationId) as [number, number, number];

describe('an overrun holder of warheads strikes (PLAN 7.18)', () => {
  it("the critic's France: it strikes before it loses its last bomber; after the fall it stays in extreme desperation; no strike near a recent burst", () => {
    const s = new Sim({ scenario: '1938', seed: 7127, assets: assets1938(W) });
    const w = s.world;
    s.command({ kind: 'grantWarheads', nation: FRA, count: 10 });
    s.command({ kind: 'declareWar', attacker: GER, defender: FRA });
    const decided: { day: number; x: number; y: number }[] = [];
    let near = 0;
    for (let d = 0; d < 100; d++) {
      s.step(24, (ww) => {
        const ev = ww.out.events;
        for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.NukeDecided && ev[i + 2] === FRA) decided.push({ day: d, x: ev[i + 4]!, y: ev[i + 5]! });
        ww.out.events.length = 0;
        ww.out.fires.length = 0;
      });
      const war = w.wars.list.find((x) => x.sides[1].includes(FRA));
      if (!war) break;
      // No place France weighs lies within RESTRIKE_RADII radii of a burst of the last RESTRIKE_DAYS.
      const r = RESTRIKE_RADII * blastRadius(1);
      for (const [x, y] of nukeTargets(w, FRA, war, 1)) for (const b of w.nukeBursts) if (b.tick > w.tick - RESTRIKE_DAYS * 24 && seaKm(w, x, y, b.x, b.y) <= r) near++;
    }
    process.stderr.write(`France decided ${decided.length} strike(s): ${JSON.stringify(decided)}\n`);
    expect(decided.length, 'France struck').toBeGreaterThan(0);
    expect(decided[0]!.day).toBeLessThan(75);
    expect(near).toBe(0);
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
