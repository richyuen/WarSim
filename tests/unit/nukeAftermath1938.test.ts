import { describe, expect, it } from 'vitest';
import cities1938 from '../../data/scenarios/1938/cities.json' with { type: 'json' };
import { EventKind } from '../../src/shared/events';
import { nukeStrike } from '../../src/shared/history';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { aftermath, NUKE_GOLD, NUKE_SHOCK, NUKE_SHOCK_DECAY, NUKE_SHOCK_MAX, NUKE_UNITY, NUKE_UNREST } from '../../src/sim/systems/nuclear';
import { declareWar, EXHAUSTED } from '../../src/sim/systems/war';
import { DEFENDERS } from '../../src/sim/wars';
import type { World } from '../../src/sim/world';
import { historyText } from '../../src/ui/historyText';
import { historyRows, tickerRows } from '../../src/worker/historyRows';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 6.5 AT (6.5a): a test per consequence of a burst, on the nation whose land it burst on: its
// war exhaustion (and a side that reaches EXHAUSTED sues for peace), its treasury, its provinces'
// unrest; the striker's alliance's unity. The history log has the strike, its yield and its dead.

const { w: W, h: H } = SIZE_1938;
const [FRA, GER] = ['FRA', 'GER'].map(nationId) as [number, number];
const berlin = cellOf(13.4, 52.52, W, H);
const sim = (): Sim => new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
/** Steps through the next day's first hour (its tick 24 k run: the world's tick then 24 k + 1). */
const toDay = (s: Sim): void => {
  s.step(1);
  while (s.world.tick % 24 !== 1) s.step(1);
};

describe('a burst\'s consequences (PLAN 6.5a)', () => {
  it('on Germany, struck at Berlin by France: a tenth of its gold, the shock to NUKE_SHOCK_MAX, unrest about Berlin, France\'s alliance less united', () => {
    const w = sim().world;
    const nc = w.nations.cols;
    const gold = nc.gold[GER]!;
    const cell = Math.floor(berlin[1]) * W + Math.floor(berlin[0]);
    const p = w.cells.province[cell]!;
    expect(p).toBeGreaterThan(0);
    const unrest = w.provinces.unrest[p]!;
    const ally = w.alliances.allianceOf(FRA);
    expect(ally, 'France in an alliance in 1938').toBeTruthy();
    const unity = ally!.unity;
    aftermath(w, FRA, 1, ...berlin, { men: 0, people: 1000, guns: 0, tanks: 0 });
    expect(nc.gold[GER]).toBeCloseTo(gold - Math.max(0, gold) * NUKE_GOLD, 6);
    expect(w.nukeShock.get(GER)).toBe(NUKE_SHOCK);
    expect(w.provinces.unrest[p]).toBeCloseTo(Math.min(100, unrest + NUKE_UNREST), 9);
    expect(ally!.unity).toBeCloseTo(Math.max(0, unity - NUKE_UNITY), 9);
    expect(w.nukeShock.has(FRA)).toBe(false);
    aftermath(w, FRA, 1, ...berlin, { men: 0, people: 1000, guns: 0, tanks: 0 });
    aftermath(w, FRA, 1, ...berlin, { men: 0, people: 1000, guns: 0, tanks: 0 });
    expect(w.nukeShock.get(GER)).toBe(NUKE_SHOCK_MAX);
    // A burst on the striker's own land: no shock to it.
    aftermath(w, GER, 1, ...berlin, { men: 0, people: 1000, guns: 0, tanks: 0 });
    expect(w.nukeShock.get(GER)).toBe(NUKE_SHOCK_MAX);
  });

  it('war exhaustion: Germany\'s side NUKE_SHOCK (less a day\'s decay) more than without the strike, the shock decaying', () => {
    const make = (): { s: Sim; war: ReturnType<typeof declareWar> } => {
      const s = sim();
      s.step(1);
      return { s, war: declareWar(s.world, GER, FRA, true) };
    };
    const a = make();
    const b = make();
    expect(a.war && b.war).toBeTruthy();
    aftermath(a.s.world, FRA, 1, ...berlin, { men: 0, people: 1000, guns: 0, tanks: 0 });
    toDay(a.s);
    toDay(b.s);
    expect(a.war!.exhaustion[0] - b.war!.exhaustion[0]).toBeCloseTo(NUKE_SHOCK - NUKE_SHOCK_DECAY, 9);
    expect(a.war!.exhaustion[DEFENDERS]).toBeCloseTo(b.war!.exhaustion[DEFENDERS], 9);
    toDay(a.s);
    expect(a.s.world.nukeShock.get(GER)).toBeCloseTo(NUKE_SHOCK - 2 * NUKE_SHOCK_DECAY, 9);
  });

  it('the peace response: Germany, a long war behind it, struck, reaches EXHAUSTED and sues; without the strike the war goes on', () => {
    const make = (): { s: Sim; w: World; id: number } => {
      const s = sim();
      s.step(1);
      const war = declareWar(s.world, GER, FRA, true)!;
      war.fightToDeath = [false, false];
      // 520 days of war: 52 points of exhaustion each, the days' alone.
      war.startTick = s.world.tick - 520 * 24;
      return { s, w: s.world, id: war.id };
    };
    const a = make();
    const b = make();
    aftermath(a.w, FRA, 1, ...berlin, { men: 0, people: 1000, guns: 0, tanks: 0 });
    toDay(a.s);
    toDay(b.s);
    expect(EXHAUSTED).toBeLessThanOrEqual(52 + NUKE_SHOCK - NUKE_SHOCK_DECAY);
    expect(a.w.wars.list.some((x) => x.id === a.id), 'struck: peace').toBe(false);
    expect(b.w.wars.list.some((x) => x.id === b.id), 'not struck: still at war').toBe(true);
  });

  it('the history log: France\'s strike on Berlin, its yield and its dead, told in a sentence; a save carries the shock', () => {
    const s = sim();
    const w = s.world;
    w.settings.nukesEnabled = true;
    w.nations.cols.aiOff[FRA] = 1;
    s.command({ kind: 'grantWarheads', nation: FRA, count: 1 });
    s.step(1);
    s.command({ kind: 'launchNuke', nation: FRA, x: berlin[0], y: berlin[1], missile: false });
    for (let h = 0; h < 48 && !w.nukeShock.has(GER); h++) s.step(1);
    const rows = historyRows(w, (n) => `nation.${NATIONS_1938[n - 1]!.tag}`, () => '').filter((r) => r.kind === EventKind.NukeCasualties);
    expect(rows.length).toBe(1);
    const strike = nukeStrike(rows[0]!.b);
    expect(rows[0]!.a).toBe(FRA);
    expect(strike.nation).toBe(GER);
    expect(strike.yieldN).toBe(1);
    expect(strike.dead).toBeGreaterThan(100_000);
    const text = historyText(rows[0]!);
    process.stderr.write(`${text}\n`);
    // PLAN 7.32b: the civilians killed and the forces lost, as the toll logged after the strike has them.
    const toll = rows[0]!.toll!;
    expect(toll).toBeDefined();
    expect(text).toMatch(new RegExp(`^France struck Germany with an atomic bomb: ${(strike.dead - toll.men).toLocaleString('en-US')} civilians killed; `));
    expect(text).toMatch(/^France struck Germany with an atomic bomb: [\d,]+ civilians killed; (?:no troops in the blast|[\d,]+ m[ae]n(?:, [\d,]+ guns?)?(?: and [\d,]+ (?:guns?|tanks?))? lost)$/);
    // PLAN 6.11c: named by place, the city nearest the burst, in the history and in the ticker (the alert's row).
    const nation = (n: number): string => `nation.${NATIONS_1938[n - 1]!.tag}`;
    const city = (v: number): string => cities1938.cities[w.cities.cols.def[v]!]?.name ?? '';
    const named = historyRows(w, nation, city).filter((r) => r.kind === EventKind.NukeCasualties);
    expect(historyText(named[0]!)).toMatch(/^France struck Germany with an atomic bomb near Berlin: [\d,]+ civilians killed; (?:no troops in the blast|[\d,]+ m[ae]n(?:, [\d,]+ guns?)?(?: and [\d,]+ (?:guns?|tanks?))? lost)$/);
    const ticked = tickerRows(w, nation, city).filter((r) => r.kind === EventKind.NukeCasualties);
    expect(ticked.map(historyText)).toEqual([historyText(named[0]!)]);
    const c = sim();
    c.load(s.save());
    expect(c.world.nukeShock.get(GER)).toBe(w.nukeShock.get(GER));
  });
});
