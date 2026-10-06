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
const BASELINE = '80e8050a'; // since PLAN 3.4d (ADR-142: armour's fire at a target with no armour on plains, grassland or desert whose side has no AT gun alive in the battle is × 1.25); 78650f1b since PLAN 3.4c (ADR-141: an AT gun whose enemy has artillery alive in the battle fires × 0.7); 13e0a82d since PLAN 3.4b (ADR-140: armour on forest or urban ground whose side has no infantry alive in the battle takes × 1.3); 50b337c6 since PLAN 3.4a (ADR-139: a side of a battle with infantry, artillery and armour alive in it fires × 1.15); 5bb98ff4 since PLAN 3.3b (ADR-138: a template crosses a cell at the least `terrainMods.speed` of its manoeuvre elements for that ground); 037e1db2 since PLAN 3.3a (ADR-137: a unit type's own figures for the ground, `terrainMods`, are in a volley beside its class's); 9dd4093d since PLAN 3.2d (ADR-136: with no supply and no org a formation on engines loses its vehicles and towed guns, a tenth a day besides); 3fad5d18 since PLAN 3.2c (ADR-135: org, a formation column; what moves on engines loses it with no supply, and a formation's fire falls with it); 8498494a since PLAN 3.2b (ADR-134: off its network the march burns a formation's supply by its fuel, and what moves on engines slows as it runs dry); 0eb1fb78 since PLAN 3.1b (ADR-128: research, a daily payment out of a budget the economic AI sets); 329eedd8 since PLAN 3.1a (ADR-127: what a nation knows is state, and a template is refused to the nation that lacks its techs); 7fc8e685 since PLAN 2.16Rf (ADR-112: a dead nation holds no land; what others occupied of it is theirs); 324bc358 since PLAN 2.13 (ADR-86: the armies of the start are not disbanded in the first hour; a treasury is spent before an army is sent home); 4aafc3eb since PLAN 2.11i (ADR-79, fourth addendum: a march between two neighbouring cells is not taken for the seam); 99c1a04e since PLAN 2.9b (ADR-79: they stand where the drawn coast surely has land); f5725b37 since PLAN 2.9a (ADR-79: formations stand on land by the fine mask), f93cb674 since PLAN 1.42e3 (ADR-57), 6569bc8e since PLAN 1.42e2, 23734db3 since PLAN 1.42e1, e5741d70 since ADR-56, 2cb270e6 since ADR-53, dd3096af before it

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
