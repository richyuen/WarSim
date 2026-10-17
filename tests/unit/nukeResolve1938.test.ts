import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { aimOf, dayIndustry, industryHeld, nuclearUtility, nukeTargets, RESOLVE, RESOLVE_DAYS, RESOLVE_GAP_DAYS, RESOLVE_STRIKES, RESOLVE_WEIGHT, resolveOf, retaliationRisk, weighWar } from '../../src/sim/systems/nuclear';
import { grantTechs, techMask } from '../../src/sim/tech';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.18e (critic R8-B1: bursts in 4 of seeds 1 to 10 × 30 years; a holder winning a long war
// never struck): a holder of warheads winning or holding its own in a war of RESOLVE_DAYS or more,
// against enemies that cannot strike back, weighs ending it (ADR-488). Germany, with warheads and
// missiles, two years into a war on France: it strikes; France holding warheads too, the war a
// month old, or a strike of Germany's in the last RESOLVE_GAP_DAYS: no resolve.

const { w: W } = SIZE_1938;
const [FRA, GER, ENG, ITA, USA] = ['FRA', 'GER', 'ENG', 'ITA', 'USA'].map(nationId) as [number, number, number, number, number];

function world(): Sim {
  const s = new Sim({ scenario: '1938', seed: 7, assets: assets1938(W) });
  const w = s.world;
  grantTechs(w, GER, techMask([w.rules!.techs.findIndex((t) => t.id === 'ballistic_missiles')]));
  s.command({ kind: 'grantWarheads', nation: GER, count: 5 });
  // Commands apply at the next tick.
  s.step(1);
  return s;
}

function bestUtility(s: Sim, war: ReturnType<Sim['world']['wars']['start']>): number {
  const r = weighWar(s.world, GER, war, 0, dayIndustry(s.world));
  if (!r.shared) return -Infinity;
  return Math.max(-Infinity, ...r.places.map((p) => nuclearUtility({ targetValue: p.value, through: p.through, ...r.shared! })));
}

describe("a winner's resolve to end a long war (PLAN 7.18e)", () => {
  it('two years into a war on France, which cannot strike back, Germany weighs a strike above 0 and decides one', () => {
    const s = world();
    const w = s.world;
    const war = w.wars.start([GER], [FRA], 0);
    war.startTick = w.tick - 800 * 24;
    war.score = 20;
    expect(retaliationRisk(w, war, 0)).toBe(0);
    expect(resolveOf(w, war, 0, 0, false)).toBeCloseTo(RESOLVE);
    const u = bestUtility(s, war);
    process.stderr.write(`Germany's best utility two years into the war ${u.toFixed(3)}\n`);
    expect(u).toBeGreaterThan(0.1);
    let decided = 0;
    s.step(24, (ww) => {
      const ev = ww.out.events;
      for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.NukeDecided && ev[i + 2] === GER) decided++;
      ww.out.events.length = 0;
      ww.out.fires.length = 0;
    });
    expect(decided).toBe(1);
    // The war remembers it: no resolve for RESOLVE_GAP_DAYS.
    expect(war.lastStrike?.[0]).toBeGreaterThan(0);
    expect(resolveOf(w, war, 0, 0, false)).toBe(0);
    // A strike of its resolve, counted (PLAN 7.18h).
    expect(war.resolveStrikes).toEqual([1, 0]);
    w.tick += RESOLVE_GAP_DAYS * 24;
    war.score = 20;
    expect(resolveOf(w, war, 0, 0, false)).toBeGreaterThan(0);
    // A few a war: after RESOLVE_STRIKES, none (PLAN 7.18h: seed 1's Italy struck ten times in one war).
    war.resolveStrikes = [RESOLVE_STRIKES, 0];
    expect(resolveOf(w, war, 0, 0, false)).toBe(0);
    expect(resolveOf(w, war, 1, 0, false)).toBe(0);
    war.score = -20;
    expect(resolveOf(w, war, 1, 0, false)).toBeGreaterThan(0);
  }, 300_000);

  it('no resolve when France can strike back, when the war is young, or when Germany is losing', () => {
    const s = world();
    const w = s.world;
    const war = w.wars.start([GER], [FRA], 0);
    // Young: a month.
    war.startTick = w.tick - 30 * 24;
    expect(resolveOf(w, war, 0, 0, false)).toBe(0);
    expect(bestUtility(s, war)).toBeLessThanOrEqual(0);
    war.startTick = w.tick - (RESOLVE_DAYS + 400) * 24;
    // Losing.
    war.score = -10;
    expect(resolveOf(w, war, 0, 0, false)).toBe(0);
    war.score = 20;
    // France with warheads and missiles: it can strike back.
    grantTechs(w, FRA, techMask([w.rules!.techs.findIndex((t) => t.id === 'ballistic_missiles')]));
    s.command({ kind: 'grantWarheads', nation: FRA, count: 5 });
    s.step(1);
    const r = retaliationRisk(w, war, 0);
    expect(r).toBeGreaterThan(0);
    expect(resolveOf(w, war, 0, r, false)).toBe(0);
    expect(bestUtility(s, war)).toBeLessThanOrEqual(0);
  }, 300_000);

  it('a strike of the resolve falls on a nation of weight to the enemy side (PLAN 7.18h)', () => {
    // Seed 1's Italy struck Mongolia and #114 by its resolve, of 0 and 0.4 % of the side's output.
    // Germany on the United States, Britain, France and Italy: Italy threatens it but holds under
    // RESOLVE_WEIGHT of that side's output.
    const s = world();
    const w = s.world;
    const war = w.wars.start([GER], [USA, ENG, FRA, ITA], 0);
    const held = industryHeld(w);
    const all = [USA, ENG, FRA, ITA].reduce((a, m) => a + held[m]!, 0);
    expect(held[ITA]! / all).toBeLessThan(RESOLVE_WEIGHT);
    // Young, no resolve: Italy is aimed at.
    war.startTick = w.tick - 30 * 24;
    expect([...aimOf(w, GER, war, 0).at].sort()).toEqual([USA, ENG, FRA, ITA].sort());
    // Two years in and winning: the resolve's aim is the nations of weight.
    war.startTick = w.tick - 800 * 24;
    war.score = 20;
    expect(resolveOf(w, war, 0, 0, false)).toBeGreaterThan(0);
    const aim = aimOf(w, GER, war, 0);
    expect(aim.anywhere).toBe(true);
    expect([...aim.at].sort()).toEqual([USA, ENG, FRA].sort());
    for (const m of aim.at) expect(held[m]! / all).toBeGreaterThanOrEqual(RESOLVE_WEIGHT);
    const places = nukeTargets(w, GER, war, 0, aim);
    expect(places.length).toBeGreaterThan(0);
    for (const [x, y] of places) expect(w.cells.owner[Math.floor(y) * w.cells.w + Math.floor(x)]).not.toBe(ITA);
  }, 300_000);
});
