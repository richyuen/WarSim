import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { blastRadius, CAPITAL_RESTRIKE_DAYS, detonate, largestYield, nukeTargets, RESTRIKE_DAYS, RESTRIKE_YEAR_MEN } from '../../src/sim/systems/nuclear';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { declareWar } from '../../src/sim/systems/war';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.50b (critic R11-B2): on the critic's seed 2081 Germany struck one Soviet spot on days 9556,
// 9679 and 9863 for 5,181, 3,846 and 4,090 men, each a strike back; the first burst found 8,953 men
// and 11,073 massed there again were ADR-569's new value (`docs/evidence/7.50/measure.md`). Within a
// year of a burst of its side in the war a place of massed men is weighed only with RESTRIKE_YEAR_MEN
// times the men the burst found; after the year, more than it found, as before. Germany at war with
// the United Kingdom strikes twelve divisions in Kent; a week on, more British men than the burst
// found stand there, under twice them.

const { w: W, h: H } = SIZE_1938;
const [ENG, GER] = ['ENG', 'GER'].map(nationId) as [number, number];
const kent = cellOf(0.9, 51.2, W, H);
const inf = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');

const near = (places: [number, number][], at: readonly [number, number]): boolean => places.some(([x, y]) => Math.hypot(x - at[0], y - at[1]) < 1.5);

const mass = (s: Sim, k: number, from = 0): void => {
  for (let i = from; i < from + k; i++) s.command({ kind: 'spawnFormation', nation: ENG, x: kent[0] + (i % 4) * 0.3, y: kent[1] + Math.floor(i / 4) * 0.3, strength: 0, template: inf });
};

/** The British land men within Germany's blast of Kent's middle, as `nukeTargets` masses them. */
function menAtKent(s: Sim): number {
  const w = s.world;
  const c = w.formations.cols;
  const r = blastRadius(largestYield(w, GER));
  const [x, y] = [kent[0] + 0.45, kent[1] + 0.3];
  let men = 0;
  w.formations.forEach((id) => {
    if (c.nation[id] !== ENG || w.isFleet(id) || w.isWing(id) || w.offLand(id)) return;
    if (Math.abs(c.y[id]! - y) <= r / 10 && seaKm(w, c.x[id]!, c.y[id]!, x, y) <= r) men += c.strength[id]!;
  });
  return men;
}

describe('the year\'s restrike (PLAN 7.50b)', () => {
  it('Kent: more men than the burst found, under twice them, not weighed within the year; weighed after it', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    w.settings.nukesEnabled = true;
    s.step(1);
    const war = declareWar(w, GER, ENG, true)!;
    mass(s, 12);
    s.step(1);
    expect(near(nukeTargets(w, GER, war, 0), kent), 'Kent before').toBe(true);
    detonate(w, GER, 1, kent[0] + 0.45, kent[1] + 0.3);
    const found = war.struck![2]!;
    expect(war.struckTick).toEqual([w.tick]);
    // A week and a day on, divisions in Kent to more than the burst found, under twice it.
    s.step((RESTRIKE_DAYS + 1) * 24);
    const left = menAtKent(s);
    const div = 12_460;
    mass(s, Math.ceil((1.3 * found - left) / div));
    s.step(1);
    const now = menAtKent(s);
    process.stderr.write(`Kent: the burst found ${found}, ${left} left a week on, ${now} with the fresh divisions\n`);
    expect(now).toBeGreaterThan(found);
    expect(now).toBeLessThan(RESTRIKE_YEAR_MEN * found);
    expect(near(nukeTargets(w, GER, war, 0), kent), 'Kent within the year').toBe(false);
    // A save carries the burst's tick.
    const c = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    c.load(s.save());
    const cw = c.world.wars.list.find((x) => x.id === war.id)!;
    expect(cw.struckTick).toEqual(war.struckTick);
    expect(near(nukeTargets(c.world, GER, cw, 0), kent), 'Kent within the year, after a load').toBe(false);
    // The burst a year old: ADR-569's more than it found.
    war.struckTick![0]! -= CAPITAL_RESTRIKE_DAYS * 24;
    expect(near(nukeTargets(w, GER, war, 0), kent), 'Kent, the burst a year old').toBe(true);
    // An older save's war has no ticks: its bursts read as a year old.
    delete war.struckTick;
    expect(near(nukeTargets(w, GER, war, 0), kent), 'Kent, no ticks').toBe(true);
  });
});
