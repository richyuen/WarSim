import { expect } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { equipFormation } from '../../src/sim/systems/elements';
import { orderMove } from '../../src/sim/systems/movement';
import type { World } from '../../src/sim/world';
import { assets1938 } from './earth';
import { nationId } from './sim1938';

// The pocket of the fuel and org tests (PLAN 3.2b, 3.2c): Soviet formations in the north, on
// their network or cut off from it by a ring of German ground.

const W = SIZE_1938.w;
const H = SIZE_1938.h;
export const T = (id: string): number => TEMPLATES_LAND.findIndex((t) => t.id === id);
export const INF = T('infantry_div');
export const PZ = T('panzer_div');
export const MOT = T('motorised_div');
export const RIFLE = T('rifle_div_soviet');
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
  f.cols.org[id] = 1;
  equipFormation(world, id, template);
  return id;
}

/**
 * Four formations of the Soviet north, three of them ordered `R - 2` cells east and one panzer
 * division left standing; `cut` hands the ring round them to Germany, so that they are off the
 * network from the first hour. The same ground and the same orders with and without.
 */
export function setUp(cut: boolean): { s: Sim; pz: number; inf: number; mot: number; rifle: number; idle: number; x0: number } {
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
