import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { declareWar } from '../../src/sim/systems/war';
import { nukeInputs, nuclearUtility, TABOO_AFTER, TABOO_RECOVERY, TABOO_WEIGHT, type NukeInputs } from '../../src/sim/systems/nuclear';
import { ATTACKERS, DEFENDERS } from '../../src/sim/wars';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 6.4 AT (6.4a): table-driven tests of the use decision's utility. A MAD pair makes no first
// use; a desperate nation fighting to the death against an enemy without the bomb uses it; after
// the first use anywhere the taboo drops and others' utility rises.

const { w: W, h: H } = SIZE_1938;
const [ENG, FRA, GER, SOV] = ['ENG', 'FRA', 'GER', 'SOV'].map(nationId) as [number, number, number, number];
const berlin = cellOf(13.4, 52.52, W, H);
const moscow = cellOf(37.62, 55.75, W, H);
const london = cellOf(-0.13, 51.5, W, H);

const base: NukeInputs = { targetValue: 0.8, desperation: 1, doctrine: 1, retaliation: 0.2, allianceCost: 0, outrage: 0, taboo: TABOO_AFTER, mad: false, extreme: false, retaliating: false };

describe('the nuclear use utility (PLAN 6.4a)', () => {
  it.each([
    ['the control: worth it without MAD', {}, '>'],
    ['MAD, not extreme: no first use', { mad: true }, '<='],
    ['MAD, extreme desperation: used', { mad: true, extreme: true }, '>'],
    ['MAD, striking back: not first use', { mad: true, retaliating: true }, '>'],
    ['no target worth a warhead', { targetValue: 0 }, '<='],
    ['a strong second strike against it', { retaliation: 1 }, '<='],
    ['the taboo whole, no desperation', { taboo: 1, desperation: 0.3 }, '<='],
  ] as const)('%s', (_, change, sign) => {
    const u = nuclearUtility({ ...base, ...change });
    if (sign === '>') expect(u).toBeGreaterThan(0);
    else expect(u).toBeLessThanOrEqual(0);
  });

  it('the taboo: its drop raises a strike\'s utility by TABOO_WEIGHT × the drop', () => {
    const before = nuclearUtility({ ...base, taboo: 1 });
    const after = nuclearUtility({ ...base, taboo: TABOO_AFTER });
    expect(after - before).toBeCloseTo(TABOO_WEIGHT * (1 - TABOO_AFTER), 12);
  });

  it('from the world: a MAD pair (England and the Soviet Union, five warheads each, bombers both) makes no first use, losing or not', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    w.settings.nukesEnabled = true;
    s.command({ kind: 'grantWarheads', nation: ENG, count: 5 });
    s.command({ kind: 'grantWarheads', nation: SOV, count: 5 });
    s.step(1);
    const war = declareWar(w, ENG, SOV, true)!;
    war.score = -100;
    const i = nukeInputs(w, ENG, war, ATTACKERS, ...moscow);
    process.stderr.write(`MAD: ${JSON.stringify(i)} U ${nuclearUtility(i).toFixed(3)}\n`);
    expect(i.mad).toBe(true);
    expect(i.extreme).toBe(false);
    expect(nuclearUtility(i)).toBeLessThanOrEqual(0);
    // The Soviet side the same against London.
    const j = nukeInputs(w, SOV, war, DEFENDERS, ...london);
    expect(j.mad).toBe(true);
    expect(nuclearUtility(j)).toBeLessThanOrEqual(0);
  });

  it('from the world: France fighting to the death and losing, Germany without the bomb: a warhead on Berlin is worth it', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    w.settings.nukesEnabled = true;
    s.command({ kind: 'grantWarheads', nation: FRA, count: 1 });
    s.step(1);
    const war = declareWar(w, GER, FRA, true)!;
    war.fightToDeath[DEFENDERS] = true;
    war.score = 100;
    const i = nukeInputs(w, FRA, war, DEFENDERS, ...berlin);
    process.stderr.write(`desperate: ${JSON.stringify(i)} U ${nuclearUtility(i).toFixed(3)}\n`);
    expect(i.retaliation).toBe(0);
    expect(i.mad).toBe(false);
    expect(i.extreme).toBe(true);
    expect(nuclearUtility(i)).toBeGreaterThan(0);
    // Not fighting to the death nor losing: not worth it while the taboo is whole.
    war.fightToDeath[DEFENDERS] = false;
    war.score = 0;
    expect(nuclearUtility(nukeInputs(w, FRA, war, DEFENDERS, ...berlin))).toBeLessThanOrEqual(0);
  });

  it('from the world: the first burst anywhere drops the taboo, and France\'s utility against Berlin rises; it recovers a day at a time; a save carries it', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    w.settings.nukesEnabled = true;
    s.command({ kind: 'grantWarheads', nation: FRA, count: 1 });
    s.command({ kind: 'grantWarheads', nation: ENG, count: 1 });
    s.step(1);
    const war = declareWar(w, GER, FRA, true)!;
    war.score = 60;
    const before = nuclearUtility(nukeInputs(w, FRA, war, DEFENDERS, ...berlin));
    expect(w.nukeTaboo).toBe(1);
    // England strikes elsewhere (Hamburg); the burst is the world's first.
    s.command({ kind: 'launchNuke', nation: ENG, x: cellOf(10.0, 53.55, W, H)[0], y: cellOf(10.0, 53.55, W, H)[1], missile: false });
    for (let h = 0; h < 48 && w.nukeTaboo === 1; h++) s.step(1);
    expect(w.nukeTaboo).toBe(TABOO_AFTER);
    war.score = 60;
    const after = nuclearUtility(nukeInputs(w, FRA, war, DEFENDERS, ...berlin));
    process.stderr.write(`taboo: before ${before.toFixed(3)}, after ${after.toFixed(3)}\n`);
    expect(after).toBeGreaterThan(before);
    // A day on, a day's recovery.
    while (w.tick % 24 !== 0) s.step(1);
    const t = w.nukeTaboo;
    s.step(24);
    expect(w.nukeTaboo).toBeCloseTo(t + TABOO_RECOVERY, 12);
    const c = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    c.load(s.save());
    expect(c.world.nukeTaboo).toBe(w.nukeTaboo);
  });
});
