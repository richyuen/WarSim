import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { nukeStrike } from '../../src/shared/history';
import { RULES_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { blastRadius, dayIndustry, placeParts, weighWar } from '../../src/sim/systems/nuclear';
import { declareWar } from '../../src/sim/systems/war';
import { grantTechs, techMask } from '../../src/sim/tech';
import { DEFENDERS, type War } from '../../src/sim/wars';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.38b (critic R10-B1, `docs/evidence/7.38/measure-a.md`): a holder of `thermonuclear` weighed
// every place at the hydrogen bomb's radius and burst one there, where a fission bomb's blast was worth
// as much: the United States H-bombed Paris and Rome (value 1 at both yields) for 3.2 to 3.7 million
// dead, not 172,000 to 183,000. Now each place is weighed at both yields, and a fission warhead goes
// where its value is as high; the place's value is the higher yield's only where it adds.

const { w: W } = SIZE_1938;
const [FRA, GER] = ['FRA', 'GER'].map(nationId) as [number, number];
const THERMO = RULES_1938.techs.findIndex((t) => t.id === 'thermonuclear');
const MISSILES = RULES_1938.techs.findIndex((t) => t.id === 'ballistic_missiles');

/** France at war with Germany with `warheads`, knowing `thermonuclear` and missiles (none stopped short), fighting to the death and losing. */
function franceAtWar(warheads: number): { s: Sim; war: War } {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
  const w = s.world;
  w.settings.nukesEnabled = true;
  s.command({ kind: 'grantWarheads', nation: FRA, count: warheads });
  grantTechs(w, FRA, techMask([THERMO, MISSILES]));
  s.step(1);
  const war = declareWar(w, GER, FRA, true)!;
  war.fightToDeath[DEFENDERS] = true;
  war.score = 100;
  return { s, war };
}

/** The events of kind `k` over `hours`, each [a, b, x, y]; the war kept lost by France. */
function run(s: Sim, war: War, hours: number, k: number): number[][] {
  const out: number[][] = [];
  for (let h = 0; h < hours; h++) {
    war.fightToDeath[DEFENDERS] = true;
    war.score = 100;
    s.step(1, (w: World) => {
      const ev = w.out.events;
      for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === k) out.push([ev[i + 2]!, ev[i + 3]!, ev[i + 4]!, ev[i + 5]!]);
      ev.length = 0;
      w.out.fires.length = 0;
    });
  }
  return out;
}

describe('the yield by the target (PLAN 7.38b)', () => {
  it('each place France weighs takes a fission warhead where its value is as high, the hydrogen bomb only where it adds', () => {
    const { s, war } = franceAtWar(1);
    const w = s.world;
    expect(blastRadius(2)).toBeGreaterThan(blastRadius(1));
    const { places } = weighWar(w, FRA, war, DEFENDERS, dayIndustry(w));
    expect(places.length).toBeGreaterThan(0);
    let fission = 0;
    for (const p of places) {
      // The value at each yield: the thermonuclear tech taken away for a fission blast's radius.
      const bit = THERMO < 32 ? w.nations.cols.tech0 : w.nations.cols.tech1;
      const was = bit[FRA]!;
      bit[FRA] = (was & ~((1 << THERMO % 32) >>> 0)) >>> 0;
      const vF = placeParts(w, FRA, war, DEFENDERS, p.x, p.y).value;
      bit[FRA] = was;
      process.stderr.write(`place (${p.x.toFixed(1)}, ${p.y.toFixed(1)}): value ${p.value.toFixed(3)}, fission ${vF.toFixed(3)}, yield ${p.yieldN}\n`);
      expect(p.value).toBeGreaterThanOrEqual(vF);
      expect(p.yieldN).toBe(vF >= p.value ? 1 : 2);
      if (p.yieldN === 1) fission++;
    }
    expect(fission).toBeGreaterThan(0);
  });

  it('France strikes Germany: the decision\'s place worth as much at a fission yield, its warhead in flight and its burst are fission ones', () => {
    const { s, war } = franceAtWar(1);
    const w = s.world;
    const best = weighWar(w, FRA, war, DEFENDERS, dayIndustry(w)).places.slice().sort((a, b) => b.value - a.value)[0]!;
    expect(best.yieldN).toBe(1);
    // To the hour of the decision: its warhead is then in flight.
    const decided: number[][] = [];
    for (let h = 0; h < 30 && decided.length === 0; h++) decided.push(...run(s, war, 1, EventKind.NukeDecided));
    expect(decided.length).toBe(1);
    expect(w.nukeLaunches.map((l) => l.yieldN)).toEqual([1]);
    // The warhead in flight keeps its yield through a save and a load.
    const c = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    c.load(s.save());
    expect(c.world.nukeLaunches).toEqual(w.nukeLaunches);
    expect(c.hash()).toBe(s.hash());
    // Its burst (or its stop short): a fission one.
    const told: number[][] = [];
    for (let h = 0; h < 24 * 3 && w.nukeLaunches.length > 0; h++) told.push(...run(s, war, 1, EventKind.NukeCasualties));
    const stopped = w.nukeBursts.length === 0;
    process.stderr.write(`France's warhead: ${stopped ? 'stopped short' : `burst, ${JSON.stringify(told.map((t) => nukeStrike(t[1]!)))}`}\n`);
    if (!stopped) {
      expect(w.nukeBursts.map((b) => b.yieldN)).toEqual([1]);
      expect(told.map((t) => nukeStrike(t[1]!).yieldN)).toEqual([1]);
    }
  });
});
