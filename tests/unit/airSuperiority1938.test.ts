import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { orderMission } from '../../src/sim/systems/air';
import { AIR_POWER_DECAY, airPowerSystem, airSuperiority } from '../../src/sim/systems/airSuperiority';
import { destroyFormation } from '../../src/sim/systems/elements';
import { airOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 5.3c: per air zone, the air power each nation flew there, fading by half in a day; a
// nation's superiority is its side's share of its side's and its enemies' power there.

const [GER, FRA, ITA, ENG, SWE] = ['GER', 'FRA', 'ITA', 'ENG', 'SWE'].map(nationId) as [number, number, number, number, number];
const STRASBOURG = cellOf(7.75, 48.58, SIZE_1938.w, SIZE_1938.h);
/** The 1938 world with the AI off: the missions here are the test's, not the air AI's (PLAN 5.6). */
const sim = (): Sim => {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
  s.world.settings.aiEnabled = false;
  return s;
};
const wingOf = (w: World, nation: number, t: string): number =>
  [...w.wingBase].find(([id, b]) => w.formations.cols.nation[id] === nation && b > 0 && TEMPLATES_1938[w.formations.cols.template[id]!]!.id === t)![0];
const zoneAt = (w: World, [x, y]: readonly number[]): number => airOf(w).zoneOf[Math.floor(y!) * w.cells.w + Math.floor(x!)]!;

describe('air superiority (PLAN 5.3c)', () => {
  it('a half where no one flew; the side that alone flew there has it all; allies share it; a nation outside the war is not counted', () => {
    const w = sim().world;
    expect(w.airPower.size).toBe(0);
    expect(airSuperiority(w, GER, 5)).toBe(0.5);
    w.wars.start([GER, ITA], [FRA, ENG], 0);
    const [g, i, f, s] = [wingOf(w, GER, 'fighter_group'), wingOf(w, ITA, 'fighter_group'), wingOf(w, FRA, 'fighter_group'), wingOf(w, SWE, 'fighter_group')];
    airPowerSystem(w, new Map([[5, [g]]]));
    expect(w.airPower.get(5)!.get(GER)).toBe(36 * 25);
    expect(airSuperiority(w, GER, 5)).toBe(1);
    expect(airSuperiority(w, ITA, 5)).toBe(1);
    expect(airSuperiority(w, FRA, 5)).toBe(0);
    expect(airSuperiority(w, ENG, 5)).toBe(0);
    expect(airSuperiority(w, SWE, 5)).toBe(0.5);
    expect(airSuperiority(w, GER, 6)).toBe(0.5);
    // France flies as much, Italy and Sweden too: two to one for the Axis; Sweden is no one's.
    airPowerSystem(w, new Map([[5, [f, i, s]]]));
    const p = (n: number): number => w.airPower.get(5)!.get(n)!;
    expect(p(GER)).toBeCloseTo(36 * 25 * AIR_POWER_DECAY, 9);
    expect(airSuperiority(w, GER, 5)).toBeCloseTo((p(GER) + p(ITA)) / (p(GER) + p(ITA) + p(FRA)), 12);
    expect(airSuperiority(w, FRA, 5)).toBeCloseTo(1 - airSuperiority(w, GER, 5), 12);
    expect(airSuperiority(w, SWE, 5)).toBe(1);
  });

  it('it fades by half in a day, and a zone no one flies over leaves the state', () => {
    const w = sim().world;
    const g = wingOf(w, GER, 'fighter_group');
    airPowerSystem(w, new Map([[5, [g]]]));
    for (let h = 0; h < 24; h++) airPowerSystem(w, new Map());
    expect(w.airPower.get(5)!.get(GER)! / (36 * 25)).toBeCloseTo(0.5, 4);
    for (let h = 0; h < 24 * 11; h++) airPowerSystem(w, new Map());
    expect(w.airPower.size).toBe(0);
  });

  it('it fades in a game with no wing left, and leaves the state (PLAN 5.8k)', () => {
    const s = sim();
    const w = s.world;
    for (const [id] of [...w.wingBase]) destroyFormation(w, id);
    expect(w.wingBase.size).toBe(0);
    w.airPower.set(5, new Map([[GER, 900]]));
    s.step(24);
    expect(w.airPower.get(5)!.get(GER)! / 900).toBeCloseTo(0.5, 3);
    s.step(24 * 11);
    expect(w.airPower.size).toBe(0);
  });

  it('in the game: German fighters over Strasbourg against French bombers hold the air there; saved, the same game', () => {
    const s = sim();
    const w = s.world;
    w.wars.start([GER], [FRA], 0);
    expect(orderMission(w, wingOf(w, GER, 'fighter_group'), 'patrol', ...STRASBOURG)).toBe(0);
    expect(orderMission(w, wingOf(w, FRA, 'tactical_bomber_group'), 'patrol', ...STRASBOURG)).toBe(0);
    s.step(12);
    const zone = zoneAt(w, STRASBOURG);
    expect(w.airPower.get(zone)?.size).toBe(2);
    expect(airSuperiority(w, GER, zone)).toBeGreaterThan(0.8);
    expect(airSuperiority(w, FRA, zone)).toBeLessThan(0.2);
    const u = sim();
    u.load(s.save());
    expect(u.hash()).toBe(s.hash());
    expect(airSuperiority(u.world, GER, zone)).toBe(airSuperiority(w, GER, zone));
    s.step(6);
    u.step(6);
    expect(u.hash()).toBe(s.hash());
  });
});
