import { describe, expect, it } from 'vitest';
import { RULES_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { dayIndustry, nukeInputs, nuclearUtility, placeParts, weighWar } from '../../src/sim/systems/nuclear';
import { declareWar } from '../../src/sim/systems/war';
import { grantTechs, techMask } from '../../src/sim/tech';
import { DEFENDERS, type War } from '../../src/sim/wars';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.44 (from 7.38e, `docs/evidence/7.38/measure-e.md`): the yield was chosen by the place's value
// alone, and the dead's cost (7.38c) came off the hydrogen strike: seed 2081's Japan H-bombed a Soviet
// place for 3.3 million dead at utility 0.091 (values 0.828 and 0.810 at fission), where a fission
// strike's was about 0.27. Now each yield is weighed by its strike's utility, its own dead in it. The
// dead weigh (2 − doctrine): the same place may take a hydrogen bomb from a striker of a high
// doctrine and a fission one from a striker of a low one, where the value alone gave both the same.

const { w: W } = SIZE_1938;
const [FRA, GER] = ['FRA', 'GER'].map(nationId) as [number, number];
const THERMO = RULES_1938.techs.findIndex((t) => t.id === 'thermonuclear');
const MISSILES = RULES_1938.techs.findIndex((t) => t.id === 'ballistic_missiles');

/** France at war with Germany with a warhead, knowing `thermonuclear` and missiles, losing (desperation 1, not extreme). */
function franceAtWar(): { s: Sim; war: War } {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
  const w = s.world;
  w.settings.nukesEnabled = true;
  s.command({ kind: 'grantWarheads', nation: FRA, count: 1 });
  grantTechs(w, FRA, techMask([THERMO, MISSILES]));
  s.step(1);
  const war = declareWar(w, GER, FRA, true)!;
  war.score = 100;
  return { s, war };
}

/** `f` with `thermonuclear` unknown to `n` (a fission blast's radius alone), the tech restored. */
function asFission<T>(w: World, n: number, f: () => T): T {
  const col = THERMO < 32 ? w.nations.cols.tech0 : w.nations.cols.tech1;
  const was = col[n]!;
  col[n] = (was & ~((1 << THERMO % 32) >>> 0)) >>> 0;
  try {
    return f();
  } finally {
    col[n] = was;
  }
}

describe('the yield by the strike\'s utility (PLAN 7.44)', () => {
  it('each place takes the yield of the higher utility; a place of a higher hydrogen value and many more dead takes a fission bomb from a low doctrine, a hydrogen one from a high one', () => {
    const { s, war } = franceAtWar();
    const w = s.world;
    const aggr = w.nations.cols.aggression;
    let flipped = 0;
    let weighed = 0;
    for (const a of [100, 0]) {
      aggr[FRA] = a;
      const { places, shared } = weighWar(w, FRA, war, DEFENDERS, dayIndustry(w));
      expect(shared).not.toBeNull();
      for (const p of places) {
        const i = nukeInputs(w, FRA, war, DEFENDERS, p.x, p.y);
        const f = asFission(w, FRA, () => nukeInputs(w, FRA, war, DEFENDERS, p.x, p.y));
        const u = nuclearUtility({ ...i, mad: false });
        const uF = nuclearUtility({ ...f, mad: false });
        // The place as the decision weighs it: the chosen yield's utility at least the fission one's.
        expect(p.value).toBe(i.targetValue);
        expect(p.people).toBe(i.people);
        expect(u).toBeGreaterThanOrEqual(uF);
        if (p.yieldN === 2) expect(u).toBeGreaterThan(uF);
        weighed++;
      }
    }
    // The places whose yield turns on the doctrine (0.5 + aggression / 100): hydrogen at aggression 100, fission at 0.
    for (const [x, y] of weighWar(w, FRA, war, DEFENDERS, dayIndustry(w)).places.map((p) => [p.x, p.y] as const)) {
      aggr[FRA] = 100;
      const hi = placeParts(w, FRA, war, DEFENDERS, x, y);
      aggr[FRA] = 0;
      const lo = placeParts(w, FRA, war, DEFENDERS, x, y);
      const vF = asFission(w, FRA, () => placeParts(w, FRA, war, DEFENDERS, x, y)).value;
      process.stderr.write(`place (${x.toFixed(1)}, ${y.toFixed(1)}): at 100 yield ${hi.yieldN} value ${hi.value.toFixed(3)} dead ${hi.people}; at 0 yield ${lo.yieldN} value ${lo.value.toFixed(3)} dead ${lo.people}; fission value ${vF.toFixed(3)}\n`);
      if (hi.yieldN === 2 && lo.yieldN === 1) {
        // The hydrogen bomb's value is higher, yet a low doctrine takes the fission one for its dead.
        expect(hi.value).toBeGreaterThan(vF);
        expect(hi.people).toBeGreaterThan(lo.people);
        expect(lo.value).toBe(vF);
        flipped++;
      }
    }
    expect(weighed).toBeGreaterThan(0);
    expect(flipped).toBeGreaterThan(0);
  });
});
