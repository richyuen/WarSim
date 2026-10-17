import { describe, expect, it } from 'vitest';
import { RESTLESS, RESTLESS_YEARS, restlessOf } from '../../src/sim/ai/strategic';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { FRONTLESS_DAYS } from '../../src/sim/systems/war';
import { warsWithFront } from '../../src/sim/systems/warFront';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.14 (critic run 7, diplomacy 6: "in the late game wars are few and endless"; ADR-480,
// ADR-481): a war with no land front between its sides ends on its score after FRONTLESS_DAYS
// running; one with a front goes on. A nation at peace grows restless.

const { w: W } = SIZE_1938;
const [ARG, AST, GER, POL] = ['ARG', 'AST', 'GER', 'POL'].map(nationId) as [number, number, number, number];

describe('a war with no land front ends (PLAN 7.14)', () => {
  it('Argentina on Australia: no front, peace at FRONTLESS_DAYS; Germany on Poland: a front, still at war', () => {
    const s = new Sim({ scenario: '1938', seed: 11, assets: assets1938(W) });
    s.command({ kind: 'setSetting', key: 'aiEnabled', value: false });
    s.step(1);
    s.command({ kind: 'declareWar', attacker: ARG, defender: AST });
    s.command({ kind: 'declareWar', attacker: GER, defender: POL });
    s.step(24);
    const w = s.world;
    const far = w.wars.list.find((x) => x.sides[0][0] === ARG)!;
    const near = w.wars.list.find((x) => x.sides[0][0] === GER)!;
    expect(far && near).toBeTruthy();
    const fronts = warsWithFront(w);
    expect(fronts.has(far.id)).toBe(false);
    expect(fronts.has(near.id)).toBe(true);
    // A day short of the bound, both at war; at it, the far one has ended, the near one has not.
    s.step(24 * (FRONTLESS_DAYS - 3));
    expect(w.wars.list.includes(far)).toBe(true);
    expect(far.frontless).toBeGreaterThanOrEqual(FRONTLESS_DAYS - 3);
    // A save and a load keep the count.
    const t = new Sim({ scenario: '1938', seed: 11, assets: assets1938(W) });
    t.load(s.save());
    expect(t.world.wars.list.find((x) => x.id === far.id)!.frontless).toBe(far.frontless);
    expect(t.hash()).toBe(s.hash());
    s.step(24 * 4);
    expect(w.wars.list.some((x) => x.id === far.id)).toBe(false);
    expect(w.wars.atWar(ARG, AST)).toBe(false);
    expect(w.wars.list.some((x) => x.id === near.id)).toBe(true);
    expect(near.frontless).toBe(0);
  }, 300_000);

  it('restlessness: 0 for a nation that fought today, growing to RESTLESS over RESTLESS_YEARS of peace; saved', () => {
    const s = new Sim({ scenario: '1938', seed: 11, assets: assets1938(W) });
    s.command({ kind: 'setSetting', key: 'aiEnabled', value: false });
    s.command({ kind: 'declareWar', attacker: GER, defender: POL });
    s.step(48);
    const w = s.world;
    expect(w.wars.lastFought.get(GER)).toBe(24);
    expect(restlessOf(w, GER)).toBeCloseTo(RESTLESS * (24 / (24 * 365 * RESTLESS_YEARS)), 9);
    // Argentina, never at war: at peace since the start.
    expect(w.wars.lastFought.has(ARG)).toBe(false);
    expect(restlessOf(w, ARG)).toBeCloseTo((RESTLESS * w.tick) / (24 * 365 * RESTLESS_YEARS), 9);
    w.wars.lastFought.set(ARG, w.tick - 24 * 365 * 5);
    expect(restlessOf(w, ARG)).toBeCloseTo(RESTLESS / 2, 9);
    w.wars.lastFought.set(ARG, w.tick - 24 * 365 * 30);
    expect(restlessOf(w, ARG)).toBe(RESTLESS);
    const t = new Sim({ scenario: '1938', seed: 11, assets: assets1938(W) });
    t.load(s.save());
    expect(t.world.wars.lastFought).toEqual(w.wars.lastFought);
  }, 300_000);
});
