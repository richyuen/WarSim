import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { HEGEMON_SHARE, neighbourMap, PACIFIST_BELOW, STALEMATE_DAYS } from '../../src/sim/ai/strategic';
import { assets1938 } from '../helpers/earth';
import { eventKinds, nationId, runEvents } from '../helpers/sim1938';

// PLAN 1.24 strategic AI v1: war, peace, alliances, coalitions; aggression drives it.
// (The 10-year, 3-seed AT runs in tests/unit/aiSweep.test.ts.)

const W = SIZE_1938.w;
const [GER, POL, CZS] = ['GER', 'POL', 'CZS'].map(nationId) as [number, number, number];
const aggression = (n: number): number => NATIONS_1938[n - 1]!.aggression;

describe('strategic AI (PLAN 1.24)', () => {
  it('neighbours come from adjacent provinces', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const nb = neighbourMap(s.world);
    expect(nb.get(GER)?.has(POL)).toBe(true);
    expect(nb.get(GER)?.has(CZS)).toBe(true);
    expect(nb.get(POL)?.has(GER)).toBe(true);
    expect(nb.get(GER)?.has(nationId('ESP'))).toBeFalsy();
  });

  it('aggressive nations declare wars; pacifists never start one (6 months)', () => {
    const s = new Sim({ scenario: '1938', seed: 7, assets: assets1938(W) });
    const declared = eventKinds(runEvents(s, 24 * 182), EventKind.WarDeclared);
    expect(declared.length).toBeGreaterThan(0);
    for (const [a] of declared) expect(aggression(a!), NATIONS_1938[a! - 1]?.tag).toBeGreaterThanOrEqual(PACIFIST_BELOW);
    const meanAggression = declared.reduce((m, [a]) => m + aggression(a!), 0) / declared.length;
    expect(meanAggression).toBeGreaterThan(40);
  }, 120_000); // six simulated months with AI wars

  it('with the AI switched off globally, nobody declares war', () => {
    const s = new Sim({ scenario: '1938', seed: 7, assets: assets1938(W) });
    s.command({ kind: 'setSetting', key: 'aiEnabled', value: false });
    expect(eventKinds(runEvents(s, 24 * 120), EventKind.WarDeclared)).toEqual([]);
  });

  it('a nation whose AI is off never declares, even when others do', () => {
    const s = new Sim({ scenario: '1938', seed: 7, assets: assets1938(W) });
    s.command({ kind: 'setAi', nation: GER, enabled: false });
    const declared = eventKinds(runEvents(s, 24 * 182), EventKind.WarDeclared);
    expect(declared.some(([a]) => a === GER)).toBe(false);
  });

  it('a coalition forms against a hegemon', () => {
    const s = new Sim({ scenario: '1938', seed: 3, assets: assets1938(W) });
    // AI off through January (no defensive alliances form first), on for the 1 February assessment.
    s.command({ kind: 'setSetting', key: 'aiEnabled', value: false });
    s.command({ kind: 'setAi', nation: GER, enabled: false });
    s.command({ kind: 'grantBuff', targetKind: 'nation', target: GER, buff: 'income', magnitude: 20, hours: 24 * 400, nameKey: 'buff.test' });
    runEvents(s, 1); // 1 January: the buffed economy makes Germany a hegemon
    let total = 0;
    s.world.nations.forEach((n) => {
      if (s.world.nations.cols.living[n] === 1) total += Math.max(0, s.world.nations.cols.income[n]!);
    });
    expect(s.world.nations.cols.income[GER]! / total).toBeGreaterThan(HEGEMON_SHARE);
    runEvents(s, 24 * 31 - 1); // to the last hour of January
    s.command({ kind: 'setSetting', key: 'aiEnabled', value: true });
    runEvents(s, 1); // 1 February 00:00: the monthly coalition check
    const coalition = s.world.alliances.list.find((a) => a.nameKey === 'alliance.coalition');
    expect(coalition).toBeDefined();
    const nb = neighbourMap(s.world);
    for (const m of coalition!.members) expect(nb.get(GER)?.has(m)).toBe(true);
  });

  it(`a long, even, exhausting war ends in a stalemate peace`, () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    s.command({ kind: 'setSetting', key: 'aiEnabled', value: true });
    const w = s.world;
    for (const n of [GER, POL]) {
      w.alliances.leave(n);
      w.alliances.guarantees = w.alliances.guarantees.filter((g) => g.guarantor !== n && g.target !== n);
    }
    w.wars.set(GER, POL, true);
    const war = w.wars.between(GER, POL)!.war;
    runEvents(s, 24); // into day 1
    war.startTick = w.tick - 24 * (STALEMATE_DAYS + 1);
    war.exhaustion = [50, 50];
    const ev = runEvents(s, 24);
    expect(eventKinds(ev, EventKind.PeaceSigned).some(([a, b]) => (a === GER && b === POL) || (a === POL && b === GER))).toBe(true);
  });
});
