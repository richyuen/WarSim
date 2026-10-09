/**
 * The fleets of the start (PLAN 4.2b, SPEC §3.6): the groups of
 * `data/scenarios/<id>/fleets.json`, each so many formations of a sea template at a naval base
 * of `ports.json`, by the base's name.
 *
 * Placement: a group's first fleet stands in its base's water (`portWater`: by the terrain
 * alone, so that a world is not built at the cost of the lane graph), and the others in the
 * water about it: a flood over water from that cell (4-way), one fleet to a cell, no cell
 * twice among all the groups. A cell the caller says no fleet can stand in (`stands`: one
 * with no water in the fine mask) is passed over. A group whose base is not in the list
 * given, or has no water, or whose water is too small for it, is not placed. Deterministic:
 * no RNG, the groups in their order.
 */
import { isLand } from '../../shared/terrain';

export interface FleetGroup {
  nation: string;
  template: string;
  count: number;
  /** The `name` of a row of ports.json: a naval base of the nation, or of a puppet of it. */
  port: string;
}

export interface PlacedFleet {
  nation: number;
  template: string;
  /** The water cell it stands in. */
  cell: number;
  /** Index of the source group. */
  group: number;
}

export interface FleetInput {
  w: number;
  h: number;
  terrain: Uint8Array;
  wrapX: boolean;
  tags: readonly string[];
  groups: readonly FleetGroup[];
  /** The water cell of each base by its name; none, or -1, for a base with no water. */
  waterOf: ReadonlyMap<string, number>;
  /** Whether a fleet can stand in the water cell asked about; every water cell when left out. */
  stands?: (cell: number) => boolean;
}

export function placeFleets(inp: FleetInput): { fleets: PlacedFleet[]; unplaced: number[] } {
  const { w, h, terrain, wrapX } = inp;
  const idOf = new Map(inp.tags.map((t, i) => [t, i + 1]));
  const used = new Uint8Array(w * h);
  const fleets: PlacedFleet[] = [];
  const unplaced: number[] = [];
  inp.groups.forEach((g, gi) => {
    const nation = idOf.get(g.nation) ?? 0;
    const start = inp.waterOf.get(g.port) ?? -1;
    if (nation === 0 || start < 0 || isLand(terrain[start]!)) {
      unplaced.push(gi);
      return;
    }
    const seen = new Uint8Array(w * h);
    const queue = [start];
    seen[start] = 1;
    let left = g.count;
    for (let qi = 0; qi < queue.length && left > 0; qi++) {
      const c = queue[qi]!;
      if (used[c] === 0 && (inp.stands?.(c) ?? true)) {
        used[c] = 1;
        fleets.push({ nation, template: g.template, cell: c, group: gi });
        left--;
      }
      const x = c % w;
      const y = (c - x) / w;
      const west = x > 0 ? c - 1 : wrapX ? c + w - 1 : -1;
      const east = x < w - 1 ? c + 1 : wrapX ? c - w + 1 : -1;
      for (const n of [y > 0 ? c - w : -1, y < h - 1 ? c + w : -1, west, east]) {
        if (n >= 0 && seen[n] === 0 && !isLand(terrain[n]!)) {
          seen[n] = 1;
          queue.push(n);
        }
      }
    }
    // Water too small for the group (a lake): what found no cell is not placed.
    if (left > 0) unplaced.push(gi);
  });
  return { fleets, unplaced };
}
