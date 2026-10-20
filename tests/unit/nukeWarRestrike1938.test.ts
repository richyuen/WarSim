import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { CAPITAL_RESTRIKE_DAYS, detonate, nukeTargets, RESTRIKE_DAYS } from '../../src/sim/systems/nuclear';
import { declareWar, makePeace } from '../../src/sim/systems/war';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.38d (critic R10-B1): a place struck in a war is not struck again in it without new value.
// Seed 4877's Soviet Union struck Switzerland twice in war 293, 20 days and 7 cells apart (667,994
// then 1,922,429 dead), the second place's men fewer than the first's. Germany at war with the
// United Kingdom strikes twelve divisions in Kent: a week on, four fresh divisions there are not
// weighed (fewer men than the burst found); twenty are (men massed again). A German burst on London
// keeps London off for the rest of the war, after the year's memory of the burst; in a new war it
// is weighed again (the cross-war restrikes are ADR-566's, the user's). God Mode's bursts belong
// to no war.

const { w: W, h: H } = SIZE_1938;
const [ENG, GER] = ['ENG', 'GER'].map(nationId) as [number, number];
const kent = cellOf(0.9, 51.2, W, H);
const inf = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');

const near = (places: [number, number][], at: readonly [number, number]): boolean => places.some(([x, y]) => Math.hypot(x - at[0], y - at[1]) < 1.5);

function world(): { s: Sim; war: NonNullable<ReturnType<typeof declareWar>> } {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
  s.world.settings.nukesEnabled = true;
  s.step(1);
  const war = declareWar(s.world, GER, ENG, true)!;
  return { s, war };
}

const mass = (s: Sim, k: number): void => {
  for (let i = 0; i < k; i++) s.command({ kind: 'spawnFormation', nation: ENG, x: kent[0] + (i % 4) * 0.3, y: kent[1] + Math.floor(i / 4) * 0.3, strength: 0, template: inf });
};

describe('a place struck in a war is not struck again in it without new value (PLAN 7.38d)', () => {
  it('Kent: fewer men than the burst found are not weighed again in the war; more are', () => {
    const { s, war } = world();
    const w = s.world;
    mass(s, 12);
    s.step(1);
    expect(near(nukeTargets(w, GER, war, 0), kent), 'Kent before').toBe(true);
    detonate(w, GER, 1, kent[0] + 0.45, kent[1] + 0.3);
    // The war remembers the burst: its place, the British men it found, Germany's side.
    expect(war.struck?.length).toBe(4);
    const found = war.struck![2]!;
    expect(found).toBeGreaterThan(100_000);
    expect(war.struck![3]).toBe(0);
    // A week and a day on, four fresh divisions in Kent: fewer men than the burst found.
    s.step((RESTRIKE_DAYS + 1) * 24);
    mass(s, 4);
    s.step(1);
    expect(near(nukeTargets(w, GER, war, 0), kent), 'Kent, four divisions a week on').toBe(false);
    // A save carries the war's memory.
    const c = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    c.load(s.save());
    const cw = c.world.wars.list.find((x) => x.id === war.id)!;
    expect(cw.struck).toEqual(war.struck);
    expect(near(nukeTargets(c.world, GER, cw, 0), kent), 'Kent after a load').toBe(false);
    // Twenty more: more men massed than the burst found, weighed again.
    mass(s, 20);
    s.step(1);
    expect(near(nukeTargets(w, GER, war, 0), kent), 'Kent, men massed again').toBe(true);
  });

  it('London struck: not weighed again in the war after the year\'s memory; weighed in a new war; God Mode\'s burst is no war\'s', () => {
    const { s, war } = world();
    const w = s.world;
    const london = [w.nations.cols.capitalX[ENG]!, w.nations.cols.capitalY[ENG]!] as const;
    // God's burst at London: no war remembers it.
    detonate(w, 0, 1, london[0], london[1]);
    expect(war.struck).toBeUndefined();
    w.nukeBursts.length = 0;
    expect(near(nukeTargets(w, GER, war, 0), london), 'London after God\'s burst, forgotten').toBe(true);
    // Germany's burst at London, then its memory of the year gone (the burst's time moved back).
    detonate(w, GER, 1, london[0], london[1]);
    expect(war.struck?.length).toBe(4);
    w.nukeBursts[0]!.tick -= CAPITAL_RESTRIKE_DAYS * 24;
    s.step(24);
    expect(w.nukeBursts.length).toBe(0);
    expect(near(nukeTargets(w, GER, war, 0), london), 'London a year on, the same war').toBe(false);
    // The war ended and a new one begun: London weighed again.
    makePeace(w, war);
    w.wars.truces.length = 0;
    const next = declareWar(w, GER, ENG, true)!;
    expect(next.id).not.toBe(war.id);
    expect(near(nukeTargets(w, GER, next, 0), london), 'London in a new war').toBe(true);
  });
});
