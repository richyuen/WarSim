import { describe, expect, it } from 'vitest';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { goesForBomb, NUKE_PROGRAMME_INCOME, nukesAllowed } from '../../src/sim/systems/nuclear';
import { nextTech, researchSystem } from '../../src/sim/systems/research';
import { grantTechs, techMask } from '../../src/sim/tech';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 6.1a: nuclear weapons are allowed where the world allows them (the scenario's
// `nukesEnabled`, God Mode's `setSetting`) and the nation is not barred (God Mode's `setNukes`).
// A nation allowed them with a great power's income goes for the bomb: the `nuclear` category is
// open to its research. A nation barred keeps its line, unpaid.

const [USA, SWI] = ['USA', 'SWI'].map(nationId) as [number, number];
const sim = (): Sim => new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });

/** The world with every tech up to 1939 but the nuclear known to `n`: its next is the chain's or none. */
function readyFor1939(w: World, n: number): number {
  const techs = w.rules!.techs;
  grantTechs(w, n, techMask(techs.map((t, i) => (t.year <= 1939 && t.category !== 'nuclear' ? i : -1)).filter((i) => i >= 0)));
  return techs.findIndex((t) => t.id === 'atomic_research');
}

describe('the nuclear programme and its toggles (PLAN 6.1a)', () => {
  it('a great power allowed nukes takes the chain; a poor nation, a barred one, a world without nukes do not', () => {
    const w = sim().world;
    const nc = w.nations.cols;
    expect(w.settings.nukesEnabled, 'the 1938 scenario allows them').toBe(true);
    const atomic = readyFor1939(w, USA);
    readyFor1939(w, SWI);
    nc.income[USA] = NUKE_PROGRAMME_INCOME * 2;
    nc.income[SWI] = NUKE_PROGRAMME_INCOME / 5;
    expect([goesForBomb(w, USA), goesForBomb(w, SWI)]).toEqual([true, false]);
    expect(nextTech(w, USA, 1939, [])).toBe(atomic);
    expect(nextTech(w, SWI, 1939, []), 'a poor nation').not.toBe(atomic);
    // Barred, then the world's toggle off.
    w.nukesBanned.add(USA);
    expect([nukesAllowed(w, USA), nextTech(w, USA, 1939, []) === atomic]).toEqual([false, false]);
    w.nukesBanned.delete(USA);
    w.settings.nukesEnabled = false;
    expect([nukesAllowed(w, USA), nextTech(w, USA, 1939, []) === atomic]).toEqual([false, false]);
  });

  it('a nuclear line of a nation barred is kept and not paid', () => {
    const w = sim().world;
    const nc = w.nations.cols;
    const atomic = readyFor1939(w, USA);
    const line = w.research.create();
    w.research.cols.nation[line] = USA;
    w.research.cols.tech[line] = atomic;
    nc.research[USA] = 50;
    nc.gold[USA] = 1e6;
    w.nukesBanned.add(USA);
    researchSystem(w);
    expect([w.research.has(line), w.research.cols.paid[line]]).toEqual([true, 0]);
    w.nukesBanned.delete(USA);
    researchSystem(w);
    expect(w.research.cols.paid[line]).toBeGreaterThan(0);
  });

  it('God Mode sets both toggles by command, and a save carries them', () => {
    const s = sim();
    s.command({ kind: 'setNukes', nation: USA, allowed: false });
    s.command({ kind: 'setSetting', key: 'nukesEnabled', value: false });
    s.step(1);
    expect([s.world.nukesBanned.has(USA), s.world.settings.nukesEnabled]).toEqual([true, false]);
    const t = sim();
    t.load(s.save());
    expect([t.world.nukesBanned.has(USA), t.world.settings.nukesEnabled]).toEqual([true, false]);
    expect(t.hash()).toBe(s.hash());
    s.command({ kind: 'setNukes', nation: USA, allowed: true });
    s.step(1);
    expect(s.world.nukesBanned.has(USA)).toBe(false);
  });
});
