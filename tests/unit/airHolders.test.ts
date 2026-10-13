import { describe, expect, it } from 'vitest';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { AIR_CONTESTED, airHolders } from '../../src/sim/systems/airSuperiority';
import { airOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 5.7c: who holds each air zone's air, for its map mode: the nation that flew the most
// there where its superiority is 0.6 or more; contested where it is less; none where no one flew.

const [GER, POL, ITA, SWE] = ['GER', 'POL', 'ITA', 'SWE'].map(nationId) as [number, number, number, number];

describe('air holders (PLAN 5.7c)', () => {
  it('held, contested, open; an ally\'s power on its side; a nation outside the war is its own', () => {
    const w = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) }).world;
    w.wars.start([GER, ITA], [POL], 0);
    const count = airOf(w).count;
    w.airPower.set(3, new Map([[GER, 900]]));
    w.airPower.set(4, new Map([[GER, 500], [POL, 500]]));
    w.airPower.set(5, new Map([[GER, 300], [ITA, 400], [POL, 300]]));
    w.airPower.set(6, new Map([[SWE, 100], [POL, 50]]));
    const h = airHolders(w, count);
    expect(h).toHaveLength(count + 1);
    expect([h[3], h[4], h[5], h[6], h[7]]).toEqual([GER, AIR_CONTESTED, ITA, SWE, 0]);
    // Germany flies more over zone 4: 0.6 of it, held.
    w.airPower.get(4)!.set(GER, 750);
    expect(airHolders(w, count)[4]).toBe(GER);
  });
});
