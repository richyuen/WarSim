import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { declareWar } from '../../src/sim/systems/war';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 6.12e (critic R6-B2): a strike back settles the score. With 6.12d (a strike back weighs no
// second strike), each answer gave its target a grievance, and from seed 6619's checkpoint of year
// 17 the Soviet Union and the United Kingdom struck each other every day for weeks. Now an answer's
// burst gives no grievance (`world.nukeAnswers`, the answering launches in flight, saved).
// England strikes Paris; France answers once (both with missiles, as seed 6619's two); England, of retaliation doctrine and its AI on, holds
// no grievance and strikes no more in ten days (MAD bars its first use).

const { w: W, h: H } = SIZE_1938;
const [ENG, FRA] = ['ENG', 'FRA'].map(nationId) as [number, number];
const paris = cellOf(2.35, 48.86, W, H);

describe('a strike back settles the score (PLAN 6.12e)', () => {
  it('England strikes Paris, France answers, and England does not answer the answer', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    w.settings.nukesEnabled = true;
    expect(w.nations.cols.aggression[ENG]!).toBeGreaterThanOrEqual(20);
    expect(w.nations.cols.aggression[FRA]!).toBeGreaterThanOrEqual(20);
    for (const n of [ENG, FRA]) {
      s.command({ kind: 'grantWarheads', nation: n, count: 5 });
      s.command({ kind: 'grantTech', nation: n, tech: 'ballistic_missiles' });
    }
    s.step(1);
    w.alliances.leave(FRA);
    expect(declareWar(w, ENG, FRA, true)).not.toBeNull();
    s.command({ kind: 'launchNuke', nation: ENG, x: paris[0], y: paris[1], missile: true });
    const decided: number[][] = [];
    let checked = false;
    for (let h = 0; h < 24 * 12; h++) {
      s.step(1, (x: World) => {
        const ev = x.out.events;
        for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.NukeDecided) decided.push([ev[i + 2]!, ev[i + 3]!, ev[i + 4]!, ev[i + 5]!]);
        ev.length = 0;
        x.out.fires.length = 0;
      });
      // France's answer in flight: it is an answer, and a save carries it.
      if (!checked && w.nukeAnswers.size > 0) {
        checked = true;
        expect(w.nukeLaunches.some((l) => l.nation === FRA && w.nukeAnswers.has(l.id))).toBe(true);
        const c = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
        c.load(s.save());
        expect([...c.world.nukeAnswers]).toEqual([...w.nukeAnswers]);
      }
    }
    process.stderr.write(`decided: ${JSON.stringify(decided)}\n`);
    expect(checked).toBe(true);
    expect(decided.map((d) => d[0])).toEqual([FRA]);
    expect(w.nukeAnswers.size).toBe(0);
    expect(w.nukeGrievance.has(ENG)).toBe(false);
  });
});
