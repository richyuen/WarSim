import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { RULES_1938, SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { equipFormation } from '../../src/sim/systems/elements';
import { DRY_SPEED, orderMove } from '../../src/sim/systems/movement';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 3.2b: fuel. A formation off its supply network burns what it carries faster on the
// march, by the fuel its elements take; one that moves on engines slows as it runs dry.
// AT (the first stage of 3.2's): unsupplied armour slows.

const W = SIZE_1938.w;
const H = SIZE_1938.h;
const T = (id: string): number => TEMPLATES_LAND.findIndex((t) => t.id === id);
const INF = T('infantry_div');
const PZ = T('panzer_div');
const MOT = T('motorised_div');
const RIFLE = T('rifle_div_soviet');
/** Half the side of the pocket, and the ring round it, in cells. */
const R = 8;

/** A cell of `tag` near (lon, lat) with no city and no water within `r` cells. */
function quietCell(world: World, tag: string, lon: number, lat: number, r: number): number {
  const cityCells = new Set<number>();
  world.cities.forEach((id) => void cityCells.add(world.cities.cols.cell[id]!));
  const [x0, y0] = cellOf(lon, lat, W, H);
  const c0 = Math.floor(y0) * W + Math.floor(x0);
  for (let d = 0; d < 40; d++) {
    for (let k = -d; k <= d; k++) {
      for (const c of [c0 + k + d * W, c0 + k - d * W, c0 + d + k * W, c0 - d + k * W]) {
        let ok = world.cells.controller[c] === nationId(tag);
        for (let dy = -r; ok && dy <= r; dy++) {
          for (let dx = -r; ok && dx <= r; dx++) {
            const n = c + dy * W + dx;
            if (cityCells.has(n) || world.cells.controller[n] !== nationId(tag)) ok = false;
          }
        }
        if (ok) return c;
      }
    }
  }
  throw new Error('no quiet cell');
}

function spawn(world: World, template: number, cell: number): number {
  const f = world.formations;
  const id = f.create();
  f.cols.nation[id] = nationId('SOV');
  f.cols.template[id] = template;
  f.cols.x[id] = (cell % W) + 0.5;
  f.cols.y[id] = Math.floor(cell / W) + 0.5;
  f.cols.supply[id] = 1;
  equipFormation(world, id, template);
  return id;
}

/**
 * Four formations of the Soviet north, three of them ordered `R - 2` cells east and one panzer
 * division left standing; `cut` hands the ring round them to Germany, so that they are off the
 * network from the first hour. The same ground and the same orders with and without.
 */
function setUp(cut: boolean): { s: Sim; pz: number; inf: number; mot: number; rifle: number; idle: number; x0: number } {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
  const world = s.world;
  world.settings.aiEnabled = false;
  const centre = quietCell(world, 'SOV', 45.0, 62.0, R + 2);
  const at = centre - (R - 2);
  const [pz, inf, mot, rifle, idle] = [PZ, INF, MOT, RIFLE, PZ].map((t) => spawn(world, t, at)) as [number, number, number, number, number];
  if (cut) {
    const cx = centre % W;
    const cy = (centre - cx) / W;
    for (let dy = -R - 2; dy <= R + 2; dy++) {
      for (let dx = -R - 2; dx <= R + 2; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) >= R) world.cells.controller[(cy + dy) * W + cx + dx] = nationId('GER');
      }
    }
    world.supplyDirty = true; // a raw write of the layer
  }
  const tx = (centre % W) + R - 2 + 0.5;
  const ty = Math.floor(centre / W) + 0.5;
  for (const id of [pz, inf, mot, rifle]) expect(orderMove(world, id, tx, ty)).toBe(true);
  return { s, pz, inf, mot, rifle, idle, x0: (at % W) + 0.5 };
}

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
