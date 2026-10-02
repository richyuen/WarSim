import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { LEAVE_LOYALTY, UNION_AT } from '../../src/sim/systems/alliances';
import { assets1938 } from '../helpers/earth';
import { eventKinds as kinds, nationId, runEvents as run } from '../helpers/sim1938';

// PLAN 1.17: alliances and unions with unity and loyalty; join, leave, dissolve.
// AT: low unity → a member leaves.

const W = SIZE_1938.w;
const [GER, ITA, JAP, POL, FRA, ENG] = ['GER', 'ITA', 'JAP', 'POL', 'FRA', 'ENG'].map(nationId) as [number, number, number, number, number, number];

/** Ticks to the next 00:00 on day 1 of a month, from 1 Jan 1938 + `months`. */
const MONTH_TICKS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31].map((d) => d * 24);

describe('alliances (PLAN 1.17)', () => {
  it('the 1938 alliances and guarantees are seeded', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const ac = s.world.alliances.allianceOf(GER)!;
    expect(ac.nameKey).toBe('alliance.anti_comintern');
    expect(ac.leader).toBe(GER);
    expect(ac.members).toEqual([GER, ITA, JAP]);
    expect(ac.unity).toBe(55);
    expect(s.world.alliances.allied(ENG, FRA)).toBe(true);
    expect(s.world.alliances.guarantorsOf(POL)).toContain(FRA);
  });

  it('low unity: loyalty sinks and the members leave within months; the alliance dissolves', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const ac = s.world.alliances.allianceOf(GER)!;
    s.command({ kind: 'setUnity', alliance: ac.id, value: 5 });
    const ev = run(s, 1 + MONTH_TICKS.slice(0, 6).reduce((a, b) => a + b, 0)); // through 1 July
    expect(kinds(ev, EventKind.AllianceLeft).map((e) => e[0]).sort()).toEqual([ITA, JAP].sort());
    expect(kinds(ev, EventKind.AllianceDissolved)).toEqual([[ac.id, GER]]);
    expect(s.world.alliances.allianceOf(GER)).toBeUndefined();
    expect(s.world.alliances.allied(GER, ITA)).toBe(false);
  });

  it('a disloyal member leaves on its own while the rest stay', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    s.command({ kind: 'setLoyalty', nation: JAP, value: 0 });
    const ev = run(s, 2); // the 1 January assessment runs at tick 0, after the command
    const ev2 = run(s, MONTH_TICKS[0]!); // through 1 February
    const left = [...kinds(ev, EventKind.AllianceLeft), ...kinds(ev2, EventKind.AllianceLeft)].map((e) => e[0]);
    expect(left).toEqual([JAP]);
    expect(s.world.alliances.allied(GER, ITA)).toBe(true);
    expect(LEAVE_LOYALTY).toBeGreaterThan(0);
  });

  it('allies and guarantors join a declared war; fighting together raises unity', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    s.command({ kind: 'declareWar', attacker: GER, defender: POL });
    run(s, 1);
    const war = s.world.wars.between(GER, POL)!.war;
    expect(war.sides[0]).toEqual(expect.arrayContaining([GER, ITA, JAP]));
    expect(war.sides[1]).toEqual(expect.arrayContaining([POL, FRA]));
    expect(war.sides[1]).not.toContain(ENG); // allies of a guarantor are not chained in v1
    // Unity after a month at war vs a twin at peace.
    const peace = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    run(s, MONTH_TICKS[0]!);
    run(peace, 1 + MONTH_TICKS[0]!);
    expect(s.world.alliances.allianceOf(GER)!.unity).toBeGreaterThan(peace.world.alliances.allianceOf(GER)!.unity);
  });

  it('allies cannot declare war on each other; created alliances can be joined and left', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    s.command({ kind: 'declareWar', attacker: GER, defender: ITA });
    const SWE = nationId('SWE');
    const NOR = nationId('NOR');
    const DEN = nationId('DEN');
    for (const n of [SWE, NOR, DEN]) s.world.alliances.leave(n);
    s.command({ kind: 'createAlliance', leader: SWE, members: [NOR], nameKey: 'alliance.nordic' });
    const ev = run(s, 1);
    expect(kinds(ev, EventKind.WarRejected)).toEqual([[GER, ITA]]);
    const nordic = s.world.alliances.allianceOf(SWE)!;
    expect(nordic.members).toEqual([SWE, NOR]);
    s.command({ kind: 'joinAlliance', nation: DEN, alliance: nordic.id });
    s.command({ kind: 'leaveAlliance', nation: SWE }); // the leader leaves: the lead passes on
    run(s, 1);
    expect(nordic.members).toEqual([NOR, DEN]);
    expect(nordic.leader).toBe(NOR);
  });

  it('high unity forms a union', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const ac = s.world.alliances.allianceOf(GER)!;
    s.command({ kind: 'setUnity', alliance: ac.id, value: 95 });
    const ev = run(s, 1);
    expect(kinds(ev, EventKind.UnionFormed)).toEqual([[ac.id, GER]]);
    expect(ac.union).toBe(true);
    expect(ac.unity).toBeGreaterThanOrEqual(UNION_AT);
  });

  it('alliances survive save/load into a live sim', () => {
    const a = new Sim({ scenario: '1938', seed: 3, assets: assets1938(W) });
    a.command({ kind: 'setUnity', alliance: a.world.alliances.allianceOf(GER)!.id, value: 20 });
    run(a, 24 * 20);
    const t = new Sim({ scenario: '1938', seed: 4, assets: assets1938(W) });
    t.step(2);
    t.load(a.save());
    run(a, 24 * 60);
    run(t, 24 * 60);
    expect(t.hash()).toBe(a.hash());
    expect(t.world.alliances.allianceOf(ITA)?.id).toBe(a.world.alliances.allianceOf(ITA)?.id);
  });
});
