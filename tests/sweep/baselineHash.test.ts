import { expect, it } from 'vitest';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';

// The pinned state hash of the 1938 world, seed 99, after one year (ADR-55). A change that is
// meant to leave behaviour alone is proved by this test staying green: no hand-run before and
// after. A change of rules, of data or of what the state records moves the hash: update the pin
// in that commit and log the old and the new value with the reason in DECISIONS.md. That is a
// new baseline, not a weakened test; a pin moved without such an entry is a defect.
// `npm run sim -- --scenario 1938 --seed 99 --years 1` prints the same hash.
const BASELINE = '2cb270e6'; // since ADR-53 (PLAN 1.42f); dd3096af before it

it('seed 99 after one year has the pinned state hash', () => {
  const s = new Sim({ scenario: '1938', seed: 99, assets: assets1938(SIZE_1938.w) });
  s.step(24 * 365);
  expect((s.hash() >>> 0).toString(16).padStart(8, '0')).toBe(BASELINE);
}, 600_000);
