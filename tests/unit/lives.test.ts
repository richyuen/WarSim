import { describe, expect, it } from 'vitest';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { cellOf } from '../../src/sim/data/terrain';
import { Lives } from '../../src/worker/lives';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';
import { EventKind } from '../../src/shared/events';

// PLAN 7.4f28 (the critic's N14: AoC's Statistics marks the dead in its lists): each nation's
// life read from the history log. A war declared, a revolt and a Kill, read in steps and at once,
// and after a save and a load.

const { w: W, h: H } = SIZE_1938;
const [GER, POL, YUG] = ['GER', 'POL', 'YUG'].map(nationId) as number[];
const YEAR = 24 * 365.2425;

describe('lives from the history (PLAN 7.4f28)', () => {
  it('age, wars and revolts of the living and the dead', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const stepped = new Lives();
    const created = s.world.nations.highWater;
    s.step(24);
    stepped.of(s.world);
    s.command({ kind: 'declareWar', attacker: GER!, defender: POL! });
    const [x, y] = cellOf(21.0, 52.23, W, H);
    s.command({ kind: 'spawnRevolt', province: s.world.cells.province[Math.floor(y) * W + Math.floor(x)]! });
    s.step(1);
    const revoltAt = s.world.tick - 1;
    const rebel = created;
    expect(s.world.nations.cols.living[rebel]).toBe(1);
    s.step(47);
    stepped.of(s.world);
    s.command({ kind: 'collapseNation', nation: YUG! });
    s.step(1);
    const killAt = s.world.tick - 1;
    s.step(23);
    const now = s.world.tick;

    const lives = stepped.of(s.world);
    const of = (id: number) => lives.find((l) => l.id === id)!;
    // Germany: of the scenario, alive since tick 0; one war, declared.
    expect(of(GER!)).toEqual({ id: GER, living: true, age: now / YEAR, wars: 1, revolts: 0 });
    // Poland: the war on it and the rebels' war of independence; one revolt on its land.
    expect(of(POL!)).toMatchObject({ living: true, age: now / YEAR, wars: 2, revolts: 1 });
    // The rebels: alive since their revolt.
    expect(of(rebel)).toMatchObject({ living: true, age: (now - revoltAt) / YEAR, wars: 1 });
    // Yugoslavia: dead at its Kill, which split its land into nations (revolts on its land).
    const yug = of(YUG!);
    expect(yug.living).toBe(false);
    expect(yug.age).toBeCloseTo(killAt / YEAR, 12);
    expect(yug.revolts).toBeGreaterThanOrEqual(2);
    // Its successors: alive since the Kill.
    const heirs = lives.filter((l) => l.id > rebel);
    expect(heirs.length).toBe(yug.revolts);
    for (const h of heirs) expect(h).toMatchObject({ living: true, age: (now - killAt) / YEAR });
    // Every nation once, the dead with the living.
    expect(lives.map((l) => l.id)).toEqual([...new Set(lives.map((l) => l.id))]);
    expect(lives.length).toBe(s.world.nations.highWater - 1);

    // Read at once, the same; after a save and a load, the same.
    expect(new Lives().of(s.world)).toEqual(lives);
    const t = new Sim({ scenario: '1938', seed: 2, assets: assets1938(W) });
    t.load(s.save());
    expect(new Lives().of(t.world)).toEqual(lives);
    // The same reader on another world starts again.
    expect(stepped.of(t.world)).toEqual(lives);
  });

  it('a revived nation is old by its lives summed', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    s.command({ kind: 'collapseNation', nation: YUG! });
    s.step(10);
    const killAt = 0;
    // Revival waits on a cooldown of years: the sim's command says why it may not, so the life
    // is read from a log written as a revival leaves it.
    s.world.history.record(s.world.tick, EventKind.NationRevived, YUG!, 1, 0, 0);
    const revivedAt = s.world.tick;
    s.step(5);
    const yug = new Lives().of(s.world).find((l) => l.id === YUG)!;
    expect(yug.age).toBeCloseTo((killAt + (s.world.tick - revivedAt)) / YEAR, 12);
  });
});
