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
 * The network is a function of the cities, the control of the cells and the blocs, and of
 * nothing else: a refresh of some blocs gives what a refresh of all gives (PLAN 2.11j).
 * The flood fills row spans (a scanline fill: the network is a connected region, so the order
 * it is filled in cannot change it), and each bloc's spans are remembered
 * (`World.supplySpans`, derived), so a partial refresh clears a bloc's network without scanning
 * the grid (PLAN 1.42a).
 *
 * Formations (hourly): a formation on a cell of its own bloc's network, or of the network of a
 * bloc fighting on its side of a war (PLAN 1.42b: allies feed each other's armies while they
 * fight together), gains SUPPLY_RATE per hour
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

const seeds: number[] = [];
let spanScratch = new Int32Array(1 << 16);

/**
 * Recomputes `cells.supply` from the current cities and control: everything after a full-dirty
 * change, else only the blocs whose cells changed (their cells are cleared and reflooded; other
 * blocs keep their networks).
 *
 * A refresh of some blocs gives the network a full one gives (PLAN 2.11j). The blocs meet only
 * at the crossing lanes, which go to the lowest bloc that reaches them, and at cells that have
 * changed hands. So a partial refresh is done again in full when
 * - a lane that a refreshed bloc held is not its own afterwards (another bloc, not refreshed,
 *   may reach it now), or
 * - a refreshed bloc's flood comes to a cell that is its own to take and lies in another
 *   network: a lane held by a higher bloc, or a cell it controls.
 * Until then a released lane stayed unclaimed and a lower bloc did not take a lane from a
 * higher one, and a loaded world, which refreshes in full, went on otherwise than the world
 * that was saved.
 */
export function refreshSupplyNetwork(world: World): void {
  const { w, h, controller, owner, terrain, supply } = world.cells;
  const blocOfNation = new Uint16Array(world.nations.highWater + 1);
  world.nations.forEach((n) => (blocOfNation[n] = blocOf(world, n)));
  const full = world.supplyDirty;
  const only = new Uint8Array(world.nations.highWater + 1);
  const reached = world.supplySpans;
  /** Partial: the lanes each refreshed bloc held before. */
  const held: [number, number[]][] = [];
  if (full) {
    supply.fill(0);
    reached.clear();
  } else {
    const clear = (b: number): void => {
      if (b === 0 || only[b] === 1) return;
      only[b] = 1;
      const old = reached.get(b);
      if (old) {
        for (let i = 0; i < old.n; i += 2) supply.fill(0, old.spans[i]!, old.spans[i + 1]!);
        if (old.lanes.length > 0) held.push([b, old.lanes]);
      }
      reached.delete(b);
    };
    for (const n of world.supplyDirtyNations) clear(n === 0 ? 0 : blocOfNation[n] || n);
    // And the blocs in whose networks the changed cells lay: a nation's bloc today is not
    // always the one that flooded its cells (a puppet since annexed).
    for (const b of world.supplyDirtyBlocs) if (b < only.length) clear(b);
  }
  world.supplyDirty = false;
  world.supplyDirtyNations.clear();
  world.supplyDirtyBlocs.clear();
  /** Partial: this refresh met what only a full one settles. */
  let again = false;
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
  for (const b of blocs) {
    // Whether the flood of bloc b may enter cell n: not yet in a network, and held by the bloc or
    // an unclaimed crossing lane.
    const lanes: number[] = [];
    const open = (n: number): boolean => {
      const ctl = controller[n]!;
      const mark = supply[n]!;
      if (mark !== 0) {
        // In a network already. In another's, though a full refresh would give it to this bloc
        // (its own cell; a lane that a higher bloc holds): this refresh cannot stand.
        if (!full && mark !== b && (ctl !== 0 ? blocOfNation[ctl] === b : terrain[n] === Terrain.Crossing && mark > b)) again = true;
        return false;
      }
      if (ctl !== 0) return blocOfNation[ctl] === b;
      if (terrain[n] !== Terrain.Crossing) return false;
      // A lane of this bloc's from here on: every open cell is filled before the flood ends.
      lanes.push(n);
      return true;
    };
    let spans = spanScratch;
    let n = 0;
    seeds.length = 0;
    for (const s of sources.get(b)!) seeds.push(s);
    while (seeds.length > 0) {
      const s = seeds.pop()!;
      if (supply[s] !== 0) continue; // filled since it was pushed
      const row = s - (s % w);
      const rowEnd = row + w;
      let l = s;
      while (l > row && open(l - 1)) l--;
      let r = s + 1;
      while (r < rowEnd && open(r)) r++;
      supply.fill(b, l, r);
      if (n === spans.length) {
        spans = new Int32Array(n * 2);
        spans.set(spanScratch);
        spanScratch = spans;
      }
      spans[n++] = l;
      spans[n++] = r;
      // East–west wrap, then one seed per run of open cells in the rows above and below.
      if (l === row && open(rowEnd - 1)) seeds.push(rowEnd - 1);
      if (r === rowEnd && open(row)) seeds.push(row);
      for (let d = -w; d <= w; d += 2 * w) {
        if (d < 0 ? row === 0 : rowEnd === w * h) continue;
        let inRun = false;
        for (let c = l + d; c < r + d; c++) {
          if (!open(c)) inRun = false;
          else if (!inRun) {
            inRun = true;
            seeds.push(c);
          }
        }
      }
    }
    // Remember the network for the next partial refresh (the buffer is reused when it fits).
    let kept = reached.get(b);
    if (!kept || kept.spans.length < n) reached.set(b, (kept = { spans: new Int32Array(n + (n >> 2)), n: 0, lanes }));
    kept.spans.set(spans.subarray(0, n));
    kept.n = n;
    // (A lane is asked about from each side it is reached from: once in the list is enough.)
    kept.lanes = lanes.length > 1 ? [...new Set(lanes)] : lanes;
  }
  if (full) return;
  for (const [b, old] of held) {
    for (const c of old) if (supply[c] !== b) again = true;
  }
  if (again) {
    world.supplyDirty = true;
    refreshSupplyNetwork(world);
  }
}

export function supplySystem(world: World): void {
  if (world.tick % SUPPLY_REFRESH_HOURS === 0 && (world.supplyDirty || world.supplyDirtyNations.size > 0 || world.supplyDirtyBlocs.size > 0)) refreshSupplyNetwork(world);
  const f = world.formations;
  const c = f.cols;
  const { w, supply, terrain } = world.cells;
  f.forEach((id) => {
    const cell = Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!);
    const net = supply[cell]!;
    const bloc = blocOf(world, c.nation[id]!);
    const inSupply = net !== 0 && (net === bloc || world.wars.sameSide(net, bloc) || world.wars.sameSide(net, c.nation[id]!));
    const s = c.supply[id]!;
    c.supply[id] = inSupply ? Math.min(1, s + SUPPLY_RATE) : Math.max(0, s - SUPPLY_RATE);
    if (c.supply[id] === 0) {
      const perHour = (BASE_ATTRITION_PER_DAY + (TERRAIN_ATTRITION[terrain[cell]!] ?? 0)) / 24;
      bleedFormation(world, id, perHour);
    }
  });
}
