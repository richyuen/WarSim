import { expect, it } from 'vitest';
import { isMonthStart } from '../../src/shared/calendar';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';
import { heldWithNoWar } from '../helpers/heldLand';

// PLAN 3.4Rj AT (ADR-147): a 1938 game without commands, two years of two seeds. At every
// month's start no cell is held by a nation that is not at war with its owner. Before the rule
// seed 99 had 3 such cells at the second month's start and up to 312 within the two years,
// seed 7 had 2 at the first and up to 440.
it.each([99, 7])('seed %i: no land is held with no war at any month’s start of two years', (seed) => {
  const s = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
  let months = 0;
  s.step(24 * 730, (w) => {
    w.out.events.length = 0;
    w.out.fires.length = 0;
    if (!isMonthStart(w.startDay, w.tick)) return;
    months++;
    expect(heldWithNoWar(w), `tick ${w.tick}`).toEqual([]);
  });
  expect(months).toBe(24);
}, 900_000);
