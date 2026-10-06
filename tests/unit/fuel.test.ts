import { describe, expect, it } from 'vitest';
import { RULES_1938 } from '../../src/sim/scenario1938';
import type { Sim } from '../../src/sim/sim';
import { DRY_SPEED } from '../../src/sim/systems/movement';
import { INF, MOT, PZ, RIFLE, T, setUp } from '../helpers/pocket';

// PLAN 3.2b: fuel. A formation off its supply network burns what it carries faster on the
// march, by the fuel its elements take; one that moves on engines slows as it runs dry.
// AT (the first stage of 3.2's): unsupplied armour slows.

describe('fuel (PLAN 3.2b)', () => {
  it('a template burns what its elements burn: nothing on foot, 38 an hour for the panzer division of 1938', () => {
    const fuel = (t: number): number => RULES_1938.templates[t]!.fuel;
    expect(fuel(INF)).toBe(0);
    expect(fuel(T('cavalry_div'))).toBe(0);
    expect(fuel(PZ)).toBeCloseTo(30 * 1 + 4 * 1.5 + 8 * 0.2 + 2 * 0.2, 9);
    expect(fuel(MOT)).toBeCloseTo(20 * 0.2 + 3 * 0.2, 9);
    expect(fuel(RIFLE)).toBeCloseTo(3 * 1, 9);
    expect(fuel(T('heavy_panzer_div'))).toBeGreaterThan(fuel(PZ));
  });

  it('on its network a division on the march keeps its supply and its speed', () => {
    const { s, pz, mot } = setUp(false);
    s.step(12);
    const f = s.world.formations.cols;
    expect(f.supply[pz]).toBe(1);
    expect(f.supply[mot]).toBe(1);
  });

  it('off the network the march burns the supply: the panzer division is dry in half the time of one that stands', () => {
    const { s, pz, inf, mot, rifle, idle } = setUp(true);
    const f = s.world.formations.cols;
    s.step(4);
    expect(f.supply[inf]).toBe(0.5); // 1/8 an hour, as before
    expect(f.supply[idle]).toBe(0.5); // armour that stands burns nothing more
    expect(f.supply[pz]!).toBeLessThan(0.05);
    expect(f.supply[pz]!).toBeGreaterThan(0);
    expect(f.supply[mot]!).toBeLessThan(0.5);
    expect(f.supply[mot]!).toBeGreaterThan(0.4);
    expect(f.supply[rifle]!).toBeLessThan(f.supply[inf]!);
    expect(f.supply[rifle]!).toBeGreaterThan(f.supply[mot]!);
    s.step(1);
    expect(f.supply[pz]).toBe(0);
    expect(f.supply[idle]).toBe(0.375);
  });

  it('unsupplied armour slows to a quarter; what walks goes on as before', () => {
    const fed = setUp(false);
    const dry = setUp(true);
    const x = (r: { s: Sim }, id: number): number => r.s.world.formations.cols.x[id]!;
    fed.s.step(8);
    dry.s.step(8);
    // The first eight hours: the supply runs out, the armour falls behind.
    expect(x(dry, dry.pz) - dry.x0).toBeLessThan(0.6 * (x(fed, fed.pz) - fed.x0));
    expect(x(dry, dry.inf)).toBe(x(fed, fed.inf));
    expect(x(dry, dry.rifle)).toBe(x(fed, fed.rifle)); // its men walk; its tank battalion does not set the pace
    // From then on everything in the pocket is dry.
    const from = { fedPz: x(fed, fed.pz), dryPz: x(dry, dry.pz), fedMot: x(fed, fed.mot), dryMot: x(dry, dry.mot) };
    fed.s.step(6);
    dry.s.step(6);
    const fedPz = x(fed, fed.pz) - from.fedPz;
    const dryPz = x(dry, dry.pz) - from.dryPz;
    expect(fedPz).toBeGreaterThan(0.5); // still on the march in both
    expect(dry.s.world.formations.cols.moving[dry.pz]).toBe(1);
    // The same cells of the same row are not crossed in the same hours, so not exactly a quarter.
    expect(dryPz / fedPz).toBeGreaterThan(DRY_SPEED * 0.6);
    expect(dryPz / fedPz).toBeLessThan(DRY_SPEED * 1.6);
    const dryMot = (x(dry, dry.mot) - from.dryMot) / (x(fed, fed.mot) - from.fedMot);
    expect(dryMot).toBeGreaterThan(DRY_SPEED * 0.6);
    expect(dryMot).toBeLessThan(DRY_SPEED * 1.6);
    expect(x(dry, dry.inf)).toBe(x(fed, fed.inf));
  });
});
