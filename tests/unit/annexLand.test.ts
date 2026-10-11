import { expect, it } from 'vitest';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { annexNation } from '../../src/sim/systems/puppets';
import { assets1938 } from '../helpers/earth';
import { heldWithNoWar } from '../helpers/heldLand';

// ADR-269 (from PLAN 4.6b's ten-year runs): an annexation gave the annexer the annexed nation's
// cells that a third nation held at war with it, and the third held them on with no war with
// their owner (seed 7: Hungary annexed Austria, and Italy held 18 of its cells for good). Such a
// cell is the third nation's, as at a death (ADR-112).
const id = (t: string): number => TAGS_1938.indexOf(t) + 1;

it('a cell of the annexed nation that a third nation holds at war with it is the third\'s; the rest the annexer\'s', () => {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
  const w = s.world;
  s.world.settings.aiEnabled = false;
  const [AUT, HUN, ITA] = [id('AUT'), id('HUN'), id('ITA')];
  const { owner, controller } = w.cells;
  w.wars.start([ITA], [AUT], w.tick);
  const austrian: number[] = [];
  for (let c = 0; c < owner.length; c++) if (owner[c] === AUT && controller[c] === AUT) austrian.push(c);
  expect(austrian.length).toBeGreaterThan(10);
  const taken = austrian.slice(0, 3);
  for (const c of taken) w.setController(c, ITA);
  expect(annexNation(w, HUN, AUT)).toBe(true);
  for (const c of taken) expect([owner[c], controller[c]], `cell ${c}`).toEqual([ITA, ITA]);
  for (const c of austrian.slice(3)) expect([owner[c], controller[c]], `cell ${c}`).toEqual([HUN, HUN]);
  expect(heldWithNoWar(w)).toEqual([]);
});
