import { expect, it } from 'vitest';
import { isMonthStart } from '../../src/shared/calendar';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { deadLand } from '../helpers/deadLand';
import { assets1938 } from '../helpers/earth';

// The pinned state hash of the 1938 world, seed 99, after one year (ADR-55). A change that is
// meant to leave behaviour alone is proved by this test staying green: no hand-run before and
// after. A change of rules, of data or of what the state records moves the hash: update the pin
// in that commit and log the old and the new value with the reason in DECISIONS.md. That is a
// new baseline, not a weakened test; a pin moved without such an entry is a defect.
// `npm run sim -- --scenario 1938 --seed 99 --years 1` prints the same hash.
const BASELINE = '329eedd8'; // since PLAN 3.1a (ADR-127: what a nation knows is state, and a template is refused to the nation that lacks its techs); 7fc8e685 since PLAN 2.16Rf (ADR-112: a dead nation holds no land; what others occupied of it is theirs); 324bc358 since PLAN 2.13 (ADR-86: the armies of the start are not disbanded in the first hour; a treasury is spent before an army is sent home); 4aafc3eb since PLAN 2.11i (ADR-79, fourth addendum: a march between two neighbouring cells is not taken for the seam); 99c1a04e since PLAN 2.9b (ADR-79: they stand where the drawn coast surely has land); f5725b37 since PLAN 2.9a (ADR-79: formations stand on land by the fine mask), f93cb674 since PLAN 1.42e3 (ADR-57), 6569bc8e since PLAN 1.42e2, 23734db3 since PLAN 1.42e1, e5741d70 since ADR-56, 2cb270e6 since ADR-53, dd3096af before it

it('seed 99 after one year has the pinned state hash', () => {
  const s = new Sim({ scenario: '1938', seed: 99, assets: assets1938(SIZE_1938.w) });
  // PLAN 2.16Rf: at every month's end no cell has a dead nation as its owner or its controller
  // (nation 72 died at tick 4006 of this run as the owner of 1,389 cells).
  s.step(24 * 365, (w) => {
    w.out.events.length = 0;
    w.out.fires.length = 0;
    if (isMonthStart(w.startDay, w.tick)) expect(deadLand(w), `tick ${w.tick}: land of the dead`).toEqual([]);
  });
  expect((s.hash() >>> 0).toString(16).padStart(8, '0')).toBe(BASELINE);
}, 600_000);
