import { describe, expect, it } from 'vitest';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { navOf } from '../../src/sim/world';
import type { GameOptions } from '../../src/shared/gameOptions';
import { assets1938 } from '../helpers/earth';

// PLAN 1.39b1 (unit part): new-game options are deterministic per seed and have their effect.

const W = SIZE_1938.w;
const make = (seed: number, options?: GameOptions): Sim => new Sim({ scenario: '1938', seed, assets: assets1938(W), ...(options ? { options } : {}) });
const col = (s: Sim, k: 'aggression' | 'incomeMult' | 'gold'): number[] => {
  const out: number[] = [];
  s.world.nations.forEach((n) => {
    if (s.world.nations.cols.living[n] === 1) out.push(s.world.nations.cols[k][n]!);
  });
  return out;
};

describe('new-game options (PLAN 1.39b1)', () => {
  const base = make(5);

  it('random aggression: 0..100, differs from the scenario, same per seed', () => {
    const a = make(5, { aggression: 'random' });
    const b = make(5, { aggression: 'random' });
    const v = col(a, 'aggression');
    expect(v.every((x) => x >= 0 && x <= 100)).toBe(true);
    expect(v).not.toEqual(col(base, 'aggression'));
    expect(a.hash()).toBe(b.hash());
    expect(make(6, { aggression: 'random' }).hash()).not.toBe(a.hash());
  });

  it('random traits change income multipliers within the trait range', () => {
    const v = col(make(5, { traits: 'random' }), 'incomeMult');
    expect(v).not.toEqual(col(base, 'incomeMult'));
    expect(new Set(v).size).toBeGreaterThan(2);
    expect(v.every((x) => x > 0.5 && x < 1.6)).toBe(true);
  }, 120_000);

  it('gold: equal for all living nations, or 0.25–2× the scenario', () => {
    const eq = col(make(5, { gold: 'equal' }), 'gold');
    expect(new Set(eq).size).toBe(1);
    const g0 = col(base, 'gold');
    const r = col(make(5, { gold: 'random' }), 'gold');
    r.forEach((g, i) => {
      expect(g).toBeGreaterThanOrEqual(g0[i]! * 0.25 - 1e-9);
      expect(g).toBeLessThanOrEqual(g0[i]! * 2 + 1e-9);
    });
    expect(r).not.toEqual(g0);
  }, 120_000);

  it('no looping map: pathing does not wrap, and the setting is saved; CE mode applies', () => {
    const s = make(5, { loopingMap: false, ceMode: 'static' });
    expect(s.world.settings.loopingMap).toBe(false);
    expect(s.world.settings.ceMode).toBe('static');
    expect(navOf(s.world).grid.wrapX).toBe(false);
    expect(navOf(base.world).grid.wrapX).toBe(true);
    const t = make(1);
    t.load(s.save());
    expect(t.world.settings.loopingMap).toBe(false);
    expect(t.hash()).toBe(s.hash());
    s.step(48);
    t.step(48);
    expect(t.hash()).toBe(s.hash());
  }, 120_000);
});
