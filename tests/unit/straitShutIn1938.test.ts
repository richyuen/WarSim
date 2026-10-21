import { describe, expect, it } from 'vitest';
import { exitsOf } from '../../src/sim/nav/crossings';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { HOME_MARCH } from '../../src/sim/systems/movement';
import { navOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 7.49b2 (ADR-589): a formation shut in on a crossing, every exit of it a nation's not in
// its wars, marches home. 8011 year 10: 90 German and Italian divisions at Gibraltar (992,383 at M)
// between Nationalist Spain and #108, a pocket of one cell that the plans reach no front from,
// and nobody's land, so no repatriation took them.

const W = SIZE_1938.w;
const GER = nationId('GER');
const SWI = nationId('SWI');
const SWE = nationId('SWE');
const CROSSING = 383 * W + 992;
const NORTH = 382 * W + 992;
const SOUTH = 384 * W + 992;

/** The 1938 world, no formations, the AI off; the crossing's exits Switzerland's (north) and `south`'s. */
function strait(south: number): Sim {
  const s = new Sim({ scenario: '1938', seed: 4, assets: assets1938(W) });
  const w = s.world;
  w.settings.aiEnabled = false;
  w.formations.ids().forEach((id) => destroyFormation(w, id));
  for (const [c, n] of [
    [NORTH, SWI],
    [SOUTH, south],
  ] as const) {
    w.setOwner(c, n);
    w.setController(c, n);
  }
  return s;
}

const quiet = (w: Sim['world']): void => {
  w.out.events.length = 0;
  w.out.fires.length = 0;
};

describe('shut in on a crossing (PLAN 7.49b2)', () => {
  it('the exits of the Gibraltar crossing are its land 4-neighbours', () => {
    const s = strait(SWE);
    expect([...exitsOf(navOf(s.world).grid).get(CROSSING)!]).toEqual([NORTH, SOUTH]);
  });

  it('a formation shut in between two strangers marches home', () => {
    const s = strait(SWE);
    const w = s.world;
    const id = addDivision(w, GER, 992.5, 383.5);
    s.step(24, quiet);
    expect(w.formations.cols.home[id]).toBe(HOME_MARCH);
    expect(w.formations.cols.moving[id]).toBe(1);
  });

  it('one with its own land at an exit is left alone', () => {
    const s = strait(GER);
    const w = s.world;
    const id = addDivision(w, GER, 992.5, 383.5);
    s.step(24, quiet);
    expect(w.formations.cols.home[id]).toBe(0);
    expect(w.formations.cols.moving[id]).toBe(0);
  });
});
