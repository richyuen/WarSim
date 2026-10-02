/**
 * Supply v1 (PLAN 1.12, SPEC §2.5 step 4).
 *
 * Network (every SUPPLY_REFRESH_HOURS): a supply bloc is a nation plus its puppets (an overlord's
 * bloc id is its own id; a puppet uses its overlord's). Sources are cities the bloc both owns and
 * controls. A multi-source flood (4-connected) spreads over cells the bloc controls and over
 * unclaimed crossing lanes; `cells.supply` stores the bloc id that reached each cell (blocs in
 * ascending id order; a lane reached first by one bloc is not shared in v1). The layer is state,
 * so a load between refreshes behaves exactly like the original run. A refresh is skipped when
 * nothing it reads has changed (`World.supplyDirty`), which writes the same layer for free.
 *
 * Formations (hourly): a formation on a cell of its own bloc's network gains SUPPLY_RATE per hour
 * towards 1; otherwise it loses SUPPLY_RATE towards 0. At 0 it attrits: (BASE_ATTRITION_PER_DAY +
 * terrain supplyAttrition) of its strength per day, applied hourly.
 */
import terrainJson from '../../../data/terrain.json' with { type: 'json' };
import { Terrain } from '../../shared/terrain';
import type { World } from '../world';
import { bleedFormation } from './elements';

/** Network refresh period (12 h since PLAN 1.25: armies in motion keep it dirty; dry within 12 + 8 h). */
export const SUPPLY_REFRESH_HOURS = 12;
/** Per hour; a power of two so the level steps exactly between 0 and 1 (8 h to drain or refill). */
export const SUPPLY_RATE = 1 / 8;
export const BASE_ATTRITION_PER_DAY = 0.02;
const TERRAIN_ATTRITION = terrainJson.terrain.map((t) => t.supplyAttrition);

/** Supply bloc of a nation: its overlord's id, or its own when it has none. */
export function blocOf(world: World, nation: number): number {
  const o = world.nations.cols.overlord[nation] ?? 0;
  return o !== 0 ? o : nation;
}

let queueScratch: Int32Array | null = null;

/**
 * Recomputes `cells.supply` from the current cities and control: everything after a full-dirty
 * change, else only the blocs of the nations whose cells changed (their cells are cleared and
 * reflooded; other blocs keep their networks). A partial refresh can resolve a crossing lane
 * contested by two blocs differently from a full one; it stays deterministic and saved.
 */
export function refreshSupplyNetwork(world: World): void {
  const { w, h, controller, owner, terrain, supply } = world.cells;
  const blocOfNation = new Uint16Array(world.nations.highWater + 1);
  world.nations.forEach((n) => (blocOfNation[n] = blocOf(world, n)));
  const full = world.supplyDirty;
  const only = new Uint8Array(world.nations.highWater + 1);
  if (full) supply.fill(0);
  else {
    for (const n of world.supplyDirtyNations) if (n !== 0) only[blocOfNation[n] || n] = 1;
    for (let c = 0; c < supply.length; c++) if (only[supply[c]!] === 1) supply[c] = 0;
  }
  world.supplyDirty = false;
  world.supplyDirtyNations.clear();
  // Sources per bloc: cities owned and controlled by a member.
  const sources = new Map<number, number[]>();
  const cc = world.cities.cols;
  world.cities.forEach((id) => {
    const cell = cc.cell[id]!;
    const ctl = controller[cell]!;
    if (ctl === 0 || owner[cell] !== ctl) return;
    const b = blocOfNation[ctl]!;
    if (!full && only[b] !== 1) return;
    let list = sources.get(b);
    if (!list) sources.set(b, (list = []));
    list.push(cell);
  });
  const blocs = [...sources.keys()].sort((a, b) => a - b);
  // Reused flood queue (review after PLAN 1.25: allocating and zeroing 8 MB per refresh cost
  // a quarter of it); contents are always written before being read.
  if (!queueScratch || queueScratch.length !== w * h) queueScratch = new Int32Array(w * h);
  const queue = queueScratch;
  for (const b of blocs) {
    let head = 0;
    let tail = 0;
    for (const s of sources.get(b)!) {
      if (supply[s] === 0) {
        supply[s] = b;
        queue[tail++] = s;
      }
    }
    while (head < tail) {
      const c = queue[head++]!;
      const x = c % w;
      const y = (c - x) / w;
      // Inlined 4-neighbours (wrapping x): this flood covers the map every refresh, and the shared
      // nav/grid neighbours4 helper made it 3.3× slower (review after PLAN 1.14).
      for (let k = 0; k < 4; k++) {
        const n = k === 0 ? (y > 0 ? c - w : -1) : k === 1 ? (y < h - 1 ? c + w : -1) : k === 2 ? (x > 0 ? c - 1 : c + w - 1) : x < w - 1 ? c + 1 : c - w + 1;
        if (n < 0 || supply[n] !== 0) continue;
        const ctl = controller[n]!;
        const ours = ctl !== 0 && blocOfNation[ctl] === b;
        const lane = ctl === 0 && terrain[n] === Terrain.Crossing;
        if (!ours && !lane) continue;
        supply[n] = b;
        queue[tail++] = n;
      }
    }
  }
}

export function supplySystem(world: World): void {
  if (world.tick % SUPPLY_REFRESH_HOURS === 0 && (world.supplyDirty || world.supplyDirtyNations.size > 0)) refreshSupplyNetwork(world);
  const f = world.formations;
  const c = f.cols;
  const { w, supply, terrain } = world.cells;
  f.forEach((id) => {
    const cell = Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!);
    const inSupply = supply[cell] !== 0 && supply[cell] === blocOf(world, c.nation[id]!);
    const s = c.supply[id]!;
    c.supply[id] = inSupply ? Math.min(1, s + SUPPLY_RATE) : Math.max(0, s - SUPPLY_RATE);
    if (c.supply[id] === 0) {
      const perHour = (BASE_ATTRITION_PER_DAY + (TERRAIN_ATTRITION[terrain[cell]!] ?? 0)) / 24;
      bleedFormation(world, id, perHour);
    }
  });
}
