import { describe, expect, it } from 'vitest';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { contactsOf } from '../../src/sim/systems/elements';
import { largestBattle, warsWithBattle } from '../../src/sim/systems/warBattle';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// A fleet in a sea battle is `engaged` as a formation in one of the land is (navalCombat sets the
// flag after findBattles). The land's readers of the flag: the war's largest battle, the wars said
// to have one, and the contacts of a loaded game, read only the land's (ADR-337).

const [GER, POL] = ['GER', 'POL'].map(nationId) as [number, number];

describe('two fleets in a sea battle are no battle of the land (ADR-337)', () => {
  it('the war has no largest battle, is not said to have one, and the fleets have no contact', () => {
    const w = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) }).world;
    w.wars.start([GER], [POL], 0);
    const c = w.formations.cols;
    const fleet = (n: number): number => [...w.formations.ids()].find((id) => w.isFleet(id) && c.nation[id] === n)!;
    const [a, b] = [fleet(GER), fleet(POL)];
    w.formations.forEach((id) => {
      c.engaged[id] = 0;
    });
    [c.x[b], c.y[b]] = [c.x[a]!, c.y[a]!];
    c.engaged[a] = 1;
    c.engaged[b] = 1;
    w.contacts = null;
    const war = w.wars.list.find((x) => x.sides[0].includes(GER) && x.sides[1].includes(POL))!.id;
    expect(largestBattle(w, war)).toBeNull();
    expect(warsWithBattle(w).has(war)).toBe(false);
    expect(contactsOf(w).has(a)).toBe(false);
    expect(contactsOf(w).has(b)).toBe(false);
  });
});
