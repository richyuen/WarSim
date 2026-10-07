import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938, NATIONS_1938, RULES_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { economicAi } from '../../src/sim/ai/economic';
import { Sim } from '../../src/sim/sim';
import { eliminateNation } from '../../src/sim/systems/capitals';
import { DAYS_PER_MONTH, MAX_LINES, nextTech, RESEARCH_SHARE, researchCap, researchSystem } from '../../src/sim/systems/research';
import { grantTechs, knowsTechs, techMask } from '../../src/sim/tech';
import { assets1938 } from '../helpers/earth';

// PLAN 3.1b: research. A nation pays for a tech day by day out of its research budget and knows
// it when it is paid for; the year of a tech is a floor (ADR-128).

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const tech = (t: string): number => RULES_1938.techs.findIndex((x) => x.id === t);
const rule = (t: string) => RULES_1938.techs[tech(t)]!;
const knows = (w: Sim['world'], n: number, t: string): boolean => knowsTechs(w, n, techMask([tech(t)]));
/** The 1938 world with no AI: a nation's research budget is what the test gives it. */
const sim1938 = (): Sim => {
  const s = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(SIZE_1938.w) });
  s.world.settings.aiEnabled = false;
  return s;
};
/** The lines of nation `n`: [tech id, gold paid]. */
const linesOf = (w: Sim['world'], n: number): [string, number][] =>
  w.research
    .ids()
    .filter((r) => w.research.cols.nation[r] === n)
    .map((r) => [RULES_1938.techs[w.research.cols.tech[r]!]!.id, w.research.cols.paid[r]!]);
/** Runs the research of `days` days (the system alone: no month is charged) and returns the `TechResearched` events as [day, nation, tech id]. */
function research(w: Sim['world'], days: number): [number, number, string][] {
  const out: [number, number, string][] = [];
  for (let d = 0; d < days; d++) {
    w.out.events.length = 0;
    researchSystem(w);
    const ev = w.out.events;
    for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.TechResearched) out.push([w.tick / 24, ev[i + 2]!, RULES_1938.techs[ev[i + 3]!]!.id]);
    w.tick += 24;
  }
  w.out.events.length = 0;
  return out;
}
/** Everything dated up to `year` but the nuclear techs and `but`. */
const allUpTo = (year: number, but: string[] = []): number[] =>
  RULES_1938.techs.flatMap((t, i) => (t.year <= year && t.category !== 'nuclear' && !but.includes(t.id) ? [i] : []));

describe('research (PLAN 3.1b)', () => {
  it('the next tech is the earliest one whose prerequisites are known and whose year has come; never a nuclear one', () => {
    const w = sim1938().world;
    const LUX = id('LUX');
    // 1938: Luxembourg knows what is dated before 1938. The first of 1938 in the scenario's order.
    const of1938 = RULES_1938.techs.filter((t) => t.year === 1938 && t.category !== 'nuclear').map((t) => t.id);
    expect(of1938).toContain('armor_medium_1');
    expect(RULES_1938.techs[nextTech(w, LUX, 1938, [])]!.id).toBe(of1938[0]);
    expect(RULES_1938.techs[nextTech(w, LUX, 1938, [tech(of1938[0]!)])]!.id).toBe(of1938[1]);
    // Not ahead of the calendar: with all of 1938 known, nothing is left in 1938.
    grantTechs(w, LUX, techMask(allUpTo(1938)));
    expect(nextTech(w, LUX, 1938, [])).toBe(-1);
    expect(RULES_1938.techs[nextTech(w, LUX, 1939, [])]!.year).toBe(1939);
    // The heavy tank waits for 1942, whatever the nation knows.
    grantTechs(w, LUX, techMask(allUpTo(1941)));
    expect(nextTech(w, LUX, 1941, [])).toBe(-1);
    expect(nextTech(w, LUX, 1942, [])).toBe(tech('armor_heavy_1'));
    // And for its prerequisite: a nation without the medium tank does not start on the heavy one.
    const MON = id('MON');
    grantTechs(w, MON, techMask(allUpTo(1960, ['armor_medium_1', 'armor_medium_2', 'armored_doctrine', 'armor_heavy_1', 'armor_mbt'])));
    expect(nextTech(w, MON, 1960, [])).toBe(tech('armor_medium_1'));
    expect(nextTech(w, MON, 1960, [tech('armor_medium_1')])).toBe(-1);
    // With everything else known, the nuclear techs are still nobody's next.
    grantTechs(w, MON, techMask(allUpTo(1960)));
    expect(RULES_1938.techs.some((t) => t.category === 'nuclear' && t.year <= 1960)).toBe(true);
    expect(nextTech(w, MON, 1960, [])).toBe(-1);
  });

  it('a tech is paid by the day out of the treasury and known after its days', () => {
    const w = sim1938().world;
    const nc = w.nations.cols;
    const LUX = id('LUX');
    // One tech to research: the medium tank.
    grantTechs(w, LUX, techMask(allUpTo(1938, ['armor_medium_1'])));
    const r = rule('armor_medium_1');
    nc.gold[LUX] = 1000;
    nc.research[LUX] = researchCap(RULES_1938);
    expect(research(w, 1)).toEqual([]);
    expect(linesOf(w, LUX)).toEqual([['armor_medium_1', r.gold / r.days]]);
    expect(nc.gold[LUX]).toBeCloseTo(1000 - r.gold / r.days, 9);
    // Known on the last of its days, not before; the whole price has left the treasury.
    expect(research(w, r.days - 2)).toEqual([]);
    expect(knows(w, LUX, 'armor_medium_1')).toBe(false);
    expect(research(w, 1)).toEqual([[r.days - 1, LUX, 'armor_medium_1']]);
    expect(knows(w, LUX, 'armor_medium_1')).toBe(true);
    expect(nc.gold[LUX]).toBeCloseTo(1000 - r.gold, 6);
    expect(linesOf(w, LUX)).toEqual([]);
    // Nothing more to research in 1938: nothing more is paid.
    research(w, 30);
    expect(nc.gold[LUX]).toBeCloseTo(1000 - r.gold, 6);
  });

  it('a budget is spent on the first line first: a rich nation works on MAX_LINES techs, a poor one on one and for longer', () => {
    const w = sim1938().world;
    const nc = w.nations.cols;
    const LUX = id('LUX');
    const MON = id('MON');
    nc.gold[LUX] = 1000;
    nc.gold[MON] = 1000;
    nc.research[LUX] = researchCap(RULES_1938);
    const first = RULES_1938.techs[nextTech(w, MON, 1938, [])]!;
    nc.research[MON] = first.gold / first.days / 2;
    research(w, 1);
    expect(linesOf(w, LUX)).toHaveLength(MAX_LINES);
    expect(new Set(linesOf(w, LUX).map((l) => l[0])).size).toBe(MAX_LINES);
    expect(linesOf(w, MON)).toEqual([[first.id, first.gold / first.days / 2]]);
    // Half the tech's pace: twice its days.
    const done = research(w, 2 * first.days - 1).filter((e) => e[1] === MON);
    expect(done).toEqual([[2 * first.days - 1, MON, first.id]]);
    expect(nc.gold[MON]).toBeCloseTo(1000 - first.gold, 6);
  });

  it('research never puts a nation in debt: nothing is paid out of an empty treasury, or by a bankrupt nation, or without a budget', () => {
    const w = sim1938().world;
    const nc = w.nations.cols;
    const [LUX, MON, IRE] = [id('LUX'), id('MON'), id('IRE')];
    for (const n of [LUX, MON, IRE]) nc.research[n] = researchCap(RULES_1938);
    nc.gold[LUX] = 0.01; // less than a day of the first line
    nc.gold[MON] = 1000;
    nc.bankrupt[MON] = 1;
    nc.gold[IRE] = 1000;
    nc.research[IRE] = 0;
    expect(research(w, 400)).toEqual([]);
    expect(nc.gold[LUX]).toBe(0.01);
    expect(nc.gold[MON]).toBe(1000);
    expect(nc.gold[IRE]).toBe(1000);
    for (const n of [LUX, MON, IRE]) expect(linesOf(w, n).reduce((s, l) => s + l[1], 0)).toBe(0);
  });

  it('the lines are saved, loaded and hashed, and a dead nation has none', () => {
    const sim = sim1938();
    const w = sim.world;
    const LUX = id('LUX');
    w.nations.cols.gold[LUX] = 1000;
    const before = sim.hash();
    w.nations.cols.research[LUX] = researchCap(RULES_1938);
    research(w, 3);
    expect(sim.hash()).not.toBe(before);
    const twin = sim1938();
    twin.load(sim.save());
    expect(linesOf(twin.world, LUX)).toEqual(linesOf(w, LUX));
    expect(twin.world.nations.cols.research[LUX]).toBe(w.nations.cols.research[LUX]);
    expect(twin.hash()).toBe(sim.hash());
    eliminateNation(w, LUX);
    expect(linesOf(w, LUX)).toEqual([]);
    expect(w.research.count).toBe(0);
  });

  it('the economic AI sets the budget: a share of income, at most what the lines take, nothing in debt', () => {
    const w = sim1938().world;
    const nc = w.nations.cols;
    const [USA, POR, LUX] = [id('USA'), id('POR'), id('LUX')];
    w.settings.aiEnabled = true;
    nc.gold[LUX] = -1;
    economicAi(ECONOMY_TABLES_1938, BUILD_MIX_1938)(w);
    expect(nc.research[USA]).toBe(researchCap(RULES_1938));
    // Portugal's twentieth is less than the lines would take.
    expect(nc.research[POR]).toBeGreaterThan(0);
    expect(nc.research[POR]).toBeLessThan(researchCap(RULES_1938));
    expect(nc.research[POR]! * DAYS_PER_MONTH).toBeCloseTo(RESEARCH_SHARE * 53, 0);
    expect(nc.research[LUX]).toBe(0);
  });

  // PLAN 3.4Rg (ADR-144): the budget is a rule of the economy, not a choice of the AI.
  it('a nation the player has taken at tick 0 has a budget and a line in its first month, as its AI twin has', () => {
    const twin = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(SIZE_1938.w) });
    const played = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(SIZE_1938.w) });
    // Britain is played; France and Germany have their AI switched off (God Mode).
    const [ENG, FRA, GER] = [id('ENG'), id('FRA'), id('GER')];
    played.command({ kind: 'setPlayer', nation: ENG });
    played.command({ kind: 'setAi', nation: FRA, enabled: false });
    played.command({ kind: 'setAi', nation: GER, enabled: false });
    twin.step(49);
    played.step(49);
    for (const n of [ENG, FRA, GER]) {
      const tag = NATIONS_1938[n - 1]!.tag;
      expect(played.world.nations.cols.aiOff[n], tag).toBe(1);
      expect(played.world.nations.cols.research[n], tag).toBeGreaterThan(0);
      expect(played.world.nations.cols.research[n], tag).toBe(twin.world.nations.cols.research[n]);
      expect(linesOf(played.world, n).length, tag).toBeGreaterThan(0);
      expect(linesOf(played.world, n), tag).toEqual(linesOf(twin.world, n));
    }
  });

  it('with the AI off for the world every living nation still has its budget, and a line', () => {
    const s = sim1938();
    const nc = s.world.nations.cols;
    s.step(49);
    const [USA, POR, FRA] = [id('USA'), id('POR'), id('FRA')];
    expect(nc.research[USA]).toBe(researchCap(RULES_1938));
    expect(nc.research[POR]).toBeGreaterThan(0);
    expect(nc.research[POR]).toBeLessThan(researchCap(RULES_1938));
    for (const n of [USA, POR, FRA]) expect(linesOf(s.world, n).length).toBeGreaterThan(0);
    // The AI itself did nothing: no order, no formation sent home.
    expect(s.world.production.count).toBe(0);
  });

  it('a nation without AI that falls into debt has no budget from the next month on', () => {
    const w = sim1938().world;
    const nc = w.nations.cols;
    const [FRA, POR] = [id('FRA'), id('POR')];
    const system = economicAi(ECONOMY_TABLES_1938, BUILD_MIX_1938);
    system(w);
    expect(nc.research[FRA]).toBeGreaterThan(0);
    expect(nc.research[POR]).toBeGreaterThan(0);
    nc.gold[FRA] = -1;
    system(w);
    expect(nc.research[FRA]).toBe(0);
    expect(nc.research[POR]).toBeGreaterThan(0);
  });
});
