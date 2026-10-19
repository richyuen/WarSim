import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { nukeStrike } from '../../src/shared/history';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { blastRadius, desperationOf, NUKE_FLOOR, nukeTargets, RESTRIKE_DAYS, RESTRIKE_RADII, STRIKE_GAP_DAYS, TARGET_CAPITAL, targetValue } from '../../src/sim/systems/nuclear';
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
    const decided: { day: number; x: number; y: number; u: number; id: number; short: boolean }[] = [];
    const burstOn: number[] = [];
    let launched = 0;
    /** Whether the first decision's place was Germany's: its cell German, or a German formation within a blast's radius. */
    let firstOnGermany: boolean | null = null;
    let near = 0;
    for (let d = 0; d < 100; d++) {
      s.step(24, (ww) => {
        const ev = ww.out.events;
        for (let i = 0; i < ev.length; i += 6) {
          if (ev[i + 2] !== FRA) continue;
          if (ev[i + 1] === EventKind.NukeLaunched) launched++;
          if (ev[i + 1] === EventKind.NukeDecided && firstOnGermany === null) {
            const [x, y] = [ev[i + 4]!, ev[i + 5]!];
            const c = ww.formations.cols;
            let german = ww.cells.controller[Math.floor(y) * W + Math.floor(x)] === GER;
            ww.formations.forEach((g) => {
              if (c.nation[g] === GER && !ww.offLand(g) && seaKm(ww, x, y, c.x[g]!, c.y[g]!) <= blastRadius(1)) german = true;
            });
            firstOnGermany = german;
          }
          // Its launch the last of the hour (Germany holds no warhead): stopped short or not (PLAN 7.28).
          if (ev[i + 1] === EventKind.NukeDecided) decided.push({ day: d, x: ev[i + 4]!, y: ev[i + 5]!, u: ev[i + 3]! / 1000, id: ww.nextLaunchId - 1, short: false });
          if (ev[i + 1] === EventKind.NukeIntercepted) for (const o of decided) if (o.id === ev[i + 3]) o.short = true;
          if (ev[i + 1] === EventKind.NukeCasualties) burstOn.push(nukeStrike(ev[i + 3]!).nation);
        }
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
    // No decision at or under the floor of utility (PLAN 7.25a): before it, France's third was at
    // about 0 (day 61; its first two at 0.117 and 0.118).
    for (const o of decided) expect(o.u, `France's decision of day ${o.day}`).toBeGreaterThan(NUKE_FLOOR);
    // Its first uses STRIKE_GAP_DAYS apart at least (PLAN 7.25b): before, days 59 and 60 (Germany
    // holds no warhead, so none of them is a strike back); but a launch stopped short starts no gap
    // (PLAN 7.28): its first, on day 46, is shot down by German fighters over France, and its next
    // launch comes the next day and bursts. Before 7.28 the gap held it to day 53, and on an earlier
    // build (PLAN 7.26b, ADR-508) its bomber was lost within that week with 9 warheads unused.
    for (let i = 1; i < decided.length; i++) if (!decided[i - 1]!.short) expect(decided[i]!.day - decided[i - 1]!.day, `France's decisions of days ${decided[i - 1]!.day} and ${decided[i]!.day}`).toBeGreaterThanOrEqual(STRIKE_GAP_DAYS);
    const shot = decided.findIndex((o) => o.short);
    expect(shot, 'a launch of France shot down').toBeGreaterThanOrEqual(0);
    expect(decided[shot + 1], 'France launches again after it').toBeDefined();
    expect(decided[shot + 1]!.day - decided[shot]!.day, 'within the gap of a launch that bursts').toBeLessThan(STRIKE_GAP_DAYS);
    // On the Germans overrunning it (PLAN 7.18j's AT): the aim, and the burst where one comes.
    expect(launched, 'France launched').toBeGreaterThan(0);
    expect(firstOnGermany, "its first decision's place is Germany's").toBe(true);
    if (burstOn.length > 0) expect(burstOn[0], 'its first burst on Germany').toBe(GER);
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
