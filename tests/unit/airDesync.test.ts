import { describe, expect, it } from 'vitest';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { airSuperiority } from '../../src/sim/systems/airSuperiority';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 5.8i (the eleventh read): air superiority summed each side's power in the order of the
// zone's map: the order of first flight in a running game, by id after a load. A saved game
// played on otherwise than the same game left running.

const [GER, ITA, HUN, POL, FRA] = ['GER', 'ITA', 'HUN', 'POL', 'FRA'].map(nationId) as [number, number, number, number, number];

describe('air superiority after a load (PLAN 5.8i)', () => {
  it('the same zone\'s power gives the same superiority whatever order the nations came in', () => {
    const w = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) }).world;
    w.wars.start([GER, ITA, HUN], [POL, FRA], 0);
    const power: [number, number][] = [[GER, 0.1], [ITA, 0.2], [HUN, 0.3], [POL, 0.7], [FRA, 1e-17]];
    let differ = 0;
    for (let k = 0; k < 50; k++) {
      // Powers of many digits: a sum's rounding is its order's.
      const p = power.map(([n, v], i) => [n, v * (1 + k / 7) + i / 3] as [number, number]);
      w.airPower.set(5, new Map(p));
      const a = [GER, POL].map((n) => airSuperiority(w, n, 5));
      w.airPower.set(5, new Map([...p].reverse()));
      const b = [GER, POL].map((n) => airSuperiority(w, n, 5));
      if (a[0] !== b[0] || a[1] !== b[1]) differ++;
    }
    expect(differ).toBe(0);
  });

  it('a game of Germany\'s air war on Poland, saved on day 2 and loaded, plays its next three days as the one left running', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
    s.command({ kind: 'declareWar', attacker: GER, defender: POL });
    s.step(48);
    const u = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
    u.load(s.save());
    expect(u.hash()).toBe(s.hash());
    for (let d = 0; d < 3; d++) {
      s.step(24);
      u.step(24);
      expect(u.hash(), `day ${d + 3}`).toBe(s.hash());
    }
  });
});
