import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { retaliationRisk } from '../../src/sim/systems/nuclear';
import { declareWar } from '../../src/sim/systems/war';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 6.12d (critic R6-B2): a strike back is not deterred by the striker's second strike. Struck
// at London twice by the Soviet Union (seed 6619), the United Kingdom, winning its war, with 35
// warheads and missiles, never struck back: its strike's utility was the bonus 1 less the Soviet
// retaliation risk 0.96, the outrage 0.1 and the taboo 0.18. Deterrence failed when it was struck;
// a nation of retaliation doctrine striking back does not weigh it.
// Germany (aggression 90, five warheads, missiles) strikes London; the United Kingdom, winning,
// five warheads and missiles, strikes German land within days.

const { w: W, h: H } = SIZE_1938;
const [ENG, GER] = ['ENG', 'GER'].map(nationId) as [number, number];
const london = cellOf(-0.12, 51.5, W, H);

describe('a strike back is not deterred (PLAN 6.12d)', () => {
  it('struck at London by Germany, a winning United Kingdom strikes German land', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    w.settings.nukesEnabled = true;
    w.nations.cols.aiOff[GER] = 1;
    for (const n of [ENG, GER]) {
      s.command({ kind: 'grantWarheads', nation: n, count: 5 });
      s.command({ kind: 'grantTech', nation: n, tech: 'ballistic_missiles' });
    }
    s.step(1);
    const war = declareWar(w, GER, ENG, true)!;
    expect(war.sides[1]).toContain(ENG);
    // Germany's second strike weighs more than the bonus of a strike back.
    expect(retaliationRisk(w, war, 1)).toBeGreaterThan(1);
    s.command({ kind: 'launchNuke', nation: GER, x: london[0], y: london[1], missile: true });
    const decided: number[][] = [];
    for (let h = 0; h < 24 * 10; h++) {
      war.score = -50; // the defenders, the United Kingdom, winning
      s.step(1, (x: World) => {
        const ev = x.out.events;
        for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.NukeDecided) decided.push([ev[i + 2]!, ev[i + 3]!, ev[i + 4]!, ev[i + 5]!]);
        ev.length = 0;
        x.out.fires.length = 0;
      });
    }
    process.stderr.write(`decided: ${JSON.stringify(decided)}\n`);
    const back = decided.filter((d) => d[0] === ENG);
    expect(back.length).toBe(1);
    expect(w.cells.owner[Math.floor(back[0]![3]!) * W + Math.floor(back[0]![2]!)]).toBe(GER);
  });
});
