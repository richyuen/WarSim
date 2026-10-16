import { describe, expect, it } from 'vitest';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { STOCKPILE_SHARE, WARHEAD_DAYS, WARHEAD_MAX, WARHEAD_UPKEEP, warheadsOf } from '../../src/sim/systems/nuclear';
import { grantTechs, techMask } from '../../src/sim/tech';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 6.1 AT (6.1b): with nukes disabled the warhead count is always 0; enabled, a nation builds
// warheads. The United States, a great power, given the bomb on 1 January 1938 (its year 1945 by
// the chain: the rule asks only that it be known).

const USA = nationId('USA');
const FRA = nationId('FRA');
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
  }, 300_000);

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

  // PLAN 7.3g (ADR-439): seeds 501 and 506 × 50 years, the Soviet Union's and France's 66–77
  // warheads cost more than their gross; with no army left they were bankrupt and collapsed.
  it('a warhead is built only while the stockpile with it stays under STOCKPILE_SHARE of the income', () => {
    const a = withBomb(true);
    const room = Math.floor((STOCKPILE_SHARE * a.world.nations.cols.income[USA]!) / WARHEAD_UPKEEP);
    expect(room, 'the United States has room for some').toBeGreaterThan(1);
    a.command({ kind: 'grantWarheads', nation: USA, count: room });
    const b = withBomb(true);
    b.command({ kind: 'grantWarheads', nation: USA, count: room - 1 });
    a.step(24 * (WARHEAD_DAYS + 40));
    b.step(24 * (WARHEAD_DAYS + 40));
    const cap = Math.floor((STOCKPILE_SHARE * a.world.nations.cols.income[USA]!) / WARHEAD_UPKEEP);
    expect(warheadsOf(a.world, USA), 'at the share: none more').toBeLessThanOrEqual(Math.max(room, cap));
    expect(warheadsOf(b.world, USA), 'under it: one more').toBe(room);
  }, 300_000);

  it('a nation short of money scraps the warheads over the share before it sends its army home', () => {
    const make = (count: number, gold: number): Sim => {
      const s = withBomb(true);
      s.command({ kind: 'grantWarheads', nation: FRA, count });
      s.step(1);
      s.world.nations.cols.gold[FRA] = gold;
      return s;
    };
    const a = make(WARHEAD_MAX, 0);
    const b = make(0, 0);
    const rich = make(WARHEAD_MAX, 1e6);
    const army = (s: Sim): number => s.world.formations.ids().filter((id) => s.world.formations.cols.nation[id] === FRA).length;
    // To the next month's start: the AI runs before the economy charges it.
    for (const s of [a, b, rich]) s.step(24 * 31);
    expect(WARHEAD_UPKEEP * WARHEAD_MAX, 'the stockpile is over the share').toBeGreaterThan(STOCKPILE_SHARE * a.world.nations.cols.income[FRA]!);
    expect(warheadsOf(rich.world, FRA), 'a treasury that carries it keeps it').toBe(WARHEAD_MAX);
    expect(warheadsOf(a.world, FRA), 'short: scrapped').toBeLessThan(WARHEAD_MAX);
    // The army as without warheads: the scrapping paid for it.
    expect(army(a)).toBeGreaterThan(0);
    expect(army(a)).toBe(army(b));
  }, 300_000);
});
