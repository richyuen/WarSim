import { describe, expect, it } from 'vitest';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { WARHEAD_DAYS, WARHEAD_MAX, WARHEAD_UPKEEP, warheadsOf } from '../../src/sim/systems/nuclear';
import { grantTechs, techMask } from '../../src/sim/tech';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 6.1 AT (6.1b): with nukes disabled the warhead count is always 0; enabled, a nation builds
// warheads. The United States, a great power, given the bomb on 1 January 1938 (its year 1945 by
// the chain: the rule asks only that it be known).

const USA = nationId('USA');
const withBomb = (nukes: boolean): Sim => {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
  const w = s.world;
  w.settings.nukesEnabled = nukes;
  grantTechs(w, USA, techMask([w.rules!.techs.findIndex((t) => t.id === 'atomic_bomb')]));
  w.nations.cols.gold[USA] = 1e6;
  return s;
};

describe('warheads (PLAN 6.1b)', () => {
  it('nukes disabled: no nation has a warhead on any day; enabled: the United States builds them', () => {
    const off = withBomb(false);
    let most = 0;
    for (let d = 0; d < WARHEAD_DAYS + 40; d++) {
      off.step(24);
      off.world.nations.forEach((n) => (most = Math.max(most, warheadsOf(off.world, n))));
    }
    expect(most).toBe(0);
    expect(off.world.warheads.size).toBe(0);
    const on = withBomb(true);
    on.step(24 * (WARHEAD_DAYS + 40));
    expect(warheadsOf(on.world, USA), 'a warhead in the first 90 days of paying').toBeGreaterThanOrEqual(1);
  });

  it('a stockpile is kept at WARHEAD_UPKEEP a warhead a month; God Mode grants warheads, to WARHEAD_MAX; a save carries them', () => {
    const a = withBomb(true);
    const b = withBomb(true);
    a.command({ kind: 'grantWarheads', nation: USA, count: 10 });
    a.step(1);
    b.step(1);
    expect(warheadsOf(a.world, USA)).toBe(10);
    // The month's accounts: the same but the stockpile's upkeep.
    a.step(24 * 32);
    b.step(24 * 32);
    const extra = a.world.nations.cols.expenses[USA]! - b.world.nations.cols.expenses[USA]!;
    expect(extra).toBeCloseTo(WARHEAD_UPKEEP * (warheadsOf(a.world, USA) - warheadsOf(b.world, USA)), 6);
    a.command({ kind: 'grantWarheads', nation: USA, count: 1000 });
    a.step(1);
    expect(warheadsOf(a.world, USA)).toBe(WARHEAD_MAX);
    const c = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
    c.load(a.save());
    expect(warheadsOf(c.world, USA)).toBe(WARHEAD_MAX);
    expect(c.hash()).toBe(a.hash());
  });
});
