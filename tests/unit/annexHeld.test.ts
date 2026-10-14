import { describe, expect, it } from 'vitest';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { annexNation } from '../../src/sim/systems/puppets';
import type { World } from '../../src/sim/world';
import { heldWithNoWar } from '../helpers/heldLand';
import { assets1938 } from '../helpers/earth';

// PLAN 5.8w2 (seed 7, `heldYears`): a nation annexed holds a cell of a third nation's (a revolt
// that took Soviet land, annexed by a nation at peace with the Soviet Union). The annexer took it
// and held it with no war with its owner. Now such a cell goes back to its owner, unless the
// annexer is at war with it.

const id = (t: string): number => TAGS_1938.indexOf(t) + 1;
const [GER, AUT, ITA] = [id('GER'), id('AUT'), id('ITA')];
/** An Italian cell held by Austria. */
function world(): { w: World; cell: number } {
  const w = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) }).world;
  for (const war of [...w.wars.list]) w.wars.end(war);
  const cell = w.cells.owner.findIndex((o, c) => o === ITA && w.cells.controller[c] === ITA);
  w.setController(cell, AUT);
  return { w, cell };
}

describe('a cell of a third nation\'s held by a nation annexed (PLAN 5.8w2)', () => {
  it('the annexer at peace with its owner: it is the owner\'s again; at war with it, the annexer\'s', () => {
    const peace = world();
    // What the start held with the wars ended (Japan's Chinese land) is no annexation's.
    const before = heldWithNoWar(peace.w).filter((x) => !x.startsWith(`nation ${AUT} `));
    expect(annexNation(peace.w, GER, AUT)).toBe(true);
    expect(peace.w.cells.controller[peace.cell]).toBe(ITA);
    expect(heldWithNoWar(peace.w)).toEqual(before);
    const war = world();
    war.w.wars.start([GER], [ITA], 0);
    expect(annexNation(war.w, GER, AUT)).toBe(true);
    expect(war.w.cells.controller[war.cell]).toBe(GER);
  });
});
