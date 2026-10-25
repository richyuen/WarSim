import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { nukeStrike, nukeToll } from '../../src/shared/history';
import { BUILD_MIX_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { canDeliver } from '../../src/sim/systems/nuclear';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.18f (critic R8-B1, `critic/c8_g_5591.json`: "Poland held its 10 warheads while its forces
// fell from 49 to 0 in 120 days"). The critic's Poland, seed 5591: 10 warheads and a strategic
// bomber group placed at Warsaw by the player's command (`spawnWing`), then Germany's war on it.
// Since 7.18a–e (a capital taken or threatened is extreme desperation, the men of the theatre) it
// strikes within the critic's 120 days while it still has a bomber, and the warhead bursts on the
// land of a nation of the enemy side.

const { w: W } = SIZE_1938;
const [POL, GER] = ['POL', 'GER'].map(nationId) as [number, number];
/** The men a first burst off Germany must kill (ADR-651 a). */
const MASSED_MEN = 50_000;

/** Poland's strategic bomber groups with a base. */
function strategicWings(world: World): number {
  const rules = world.rules!;
  let k = 0;
  for (const [id, base] of world.wingBase) {
    if (base <= 0 || world.formations.cols.nation[id] !== POL || !world.formations.has(id)) continue;
    if (rules.units[rules.templates[world.formations.cols.template[id]!]!.elements[0]!.unit]!.cls === 'bomber_str') k++;
  }
  return k;
}

// PLAN 7.18i: on seeds 7127 and 3929 it struck nothing before its bomber was lost (day 80 to 95):
// every place within reach under German air cover (the chance through 0.2), the costs weighed whole
// against a gain × that chance. With the costs × the chance as well (they fall only on a burst), it
// strikes there too.
// Re-picked at PLAN 7.116a (ADR-701 a: an AI nation's remnants under 500 men folded daily): 7127 and
// 3929 lost the bomber (days 87, 67) with the best place in reach just under NUKE_FLOOR. In their
// place 4010 and 4014, the same case (the place struck under German air cover, through 0.20; the
// bomber lost on days 97 and 98), struck both before and after the fold; of seeds 4001-4020 Poland
// strikes before its bomber is gone on 17 before it and 15 after (`tools/diag/nukePolandGates.ts`).
describe("the critic's Poland strikes (PLAN 7.18f, 7.18i)", () => {
  it.each([5591, 4010, 4014])("seed %i: given 10 warheads and a strategic bomber group at Warsaw, it strikes in Germany's war on it before its bomber is gone", (seed) => {
    const s = new Sim({ scenario: '1938', seed, assets: assets1938(W) });
    const w = s.world;
    const warsaw = w.airbases.find((b) => b.name === 'Warsaw' && w.cells.controller[b.cell] === POL);
    expect(warsaw, 'Warsaw is a Polish airbase').toBeDefined();
    const before = strategicWings(w);
    const [x, y] = w.cellPoint(warsaw!.cell);
    s.command({ kind: 'spawnWing', nation: POL, x, y, template: BUILD_MIX_1938.wings.strategic });
    s.command({ kind: 'grantWarheads', nation: POL, count: 10 });
    s.command({ kind: 'declareWar', attacker: GER, defender: POL });
    s.step(1);
    expect(strategicWings(w), 'the bomber group is placed').toBe(before + 1);
    expect(canDeliver(w, POL)).toBe(true);

    const decided: number[] = [];
    const bursts: { day: number; on: number; dead: number; men: number }[] = [];
    let deliverUntil = -1;
    let enemies = new Set<number>();
    for (let d = 0; d < 120; d++) {
      s.step(24, (ww) => {
        const ev = ww.out.events;
        for (let i = 0; i < ev.length; i += 6) {
          if (ev[i + 2] !== POL) continue;
          if (ev[i + 1] === EventKind.NukeDecided) decided.push(d);
          if (ev[i + 1] === EventKind.NukeCasualties) {
            const st = nukeStrike(ev[i + 3]!);
            bursts.push({ day: d, on: st.nation, dead: st.dead, men: 0 });
          }
          // The men the burst killed, logged right after it (PLAN 7.32b).
          if (ev[i + 1] === EventKind.NukeToll && bursts.length > 0) bursts[bursts.length - 1]!.men = nukeToll(ev[i + 3]!).men;
        }
        ww.out.events.length = 0;
        ww.out.fires.length = 0;
      });
      const war = w.wars.list.find((x) => x.sides[1].includes(POL) && x.sides[0].includes(GER));
      if (!war) break;
      enemies = new Set(war.sides[0]);
      if (canDeliver(w, POL)) deliverUntil = d;
      if (bursts.length > 0) break;
    }
    process.stderr.write(`seed ${seed}: Poland decided on days ${JSON.stringify(decided)}; bursts ${JSON.stringify(bursts)}; could deliver to day ${deliverUntil}\n`);
    expect(decided.length, 'Poland decided a strike').toBeGreaterThan(0);
    expect(decided[0]!, 'while it could still deliver').toBeLessThanOrEqual(deliverUntil + 1);
    expect(bursts.length, 'a warhead of Poland burst').toBeGreaterThan(0);
    expect(enemies.has(bursts[0]!.on), 'on the land of a nation of the enemy side').toBe(true);
    // On the Germans overrunning it, or on an army of their side of at least MASSED_MEN, not a lighter
    // theatre of their side (PLAN 7.18j's AT). ADR-651 a (the user's decision): an army that size before
    // Poland's ally is a fair target by `nukeTargets`; a city of another nation with few men is not.
    const first = bursts[0]!;
    expect(first.on === GER || first.men >= MASSED_MEN, `on Germany, or on at least ${MASSED_MEN} men (on ${first.on}, ${first.men} men)`).toBe(true);
    expect(bursts[0]!.dead).toBeGreaterThan(0);
  }, 600_000);
});
