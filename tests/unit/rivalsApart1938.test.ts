import { describe, expect, it } from 'vitest';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { greatPowers, RIVAL_GRACE_YEARS, rivalsApart, strengths } from '../../src/sim/ai/strategic';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.53b (ADR-585, the user's decision; ADR-586): the great powers of an alliance but its first
// part from it while they fight no great power together with it, once RIVAL_GRACE_YEARS have passed.
// 1938's Anti-Comintern pact holds three of the six great powers: Germany (its leader), Italy, Japan.

const [GER, ITA, JAP, FRA] = ['GER', 'ITA', 'JAP', 'FRA'].map(nationId) as [number, number, number, number];

function world1938() {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
  const w = s.world;
  for (const war of [...w.wars.list]) w.wars.end(war);
  return w;
}

describe('rivals apart (PLAN 7.53b)', () => {
  it('after the grace, Italy and Japan leave Germany’s alliance in the second month', () => {
    const w = world1938();
    w.tick = 24 * 365 * RIVAL_GRACE_YEARS;
    const str = strengths(w);
    const greats = greatPowers(w, str);
    for (const n of [GER, ITA, JAP]) expect(greats.has(n)).toBe(true);
    const pact = w.alliances.allianceOf(GER)!;
    expect(pact.leader).toBe(GER);
    rivalsApart(w, str, greats);
    expect(w.alliances.allied(GER, ITA)).toBe(true);
    rivalsApart(w, str, greats);
    expect(w.alliances.allied(GER, ITA)).toBe(false);
    expect(w.alliances.allied(GER, JAP)).toBe(false);
  });

  it('a war on a great power fought together keeps them; Japan, not in it, leaves', () => {
    const w = world1938();
    w.tick = 24 * 365 * RIVAL_GRACE_YEARS;
    w.alliances.leave(FRA);
    w.wars.start([GER, ITA], [FRA], w.tick);
    const str = strengths(w);
    const greats = greatPowers(w, str);
    expect(greats.has(FRA)).toBe(true);
    for (let k = 0; k < 3; k++) rivalsApart(w, str, greats);
    expect(w.alliances.allied(GER, ITA)).toBe(true);
    expect(w.alliances.allied(GER, JAP)).toBe(false);
  });

  it('within the grace nobody parts', () => {
    const w = world1938();
    const str = strengths(w);
    const greats = greatPowers(w, str);
    for (let k = 0; k < 3; k++) rivalsApart(w, str, greats);
    expect(w.alliances.allied(GER, ITA)).toBe(true);
    expect(w.alliances.allied(GER, JAP)).toBe(true);
  });
});
