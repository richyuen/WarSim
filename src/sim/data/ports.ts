/**
 * Port placement (PLAN 4.1c, SPEC §3.3): `data/scenarios/<id>/ports.json` and the placed cities
 * → the ports of a world. A city of the file's size or more with water within the file's reach
 * is a port, of a level by its size. The file's own list, written by hand, holds the naval
 * bases and the ports whose water is further from the city than the reach (London, on its
 * river); one that stands in a city port's cell takes its place. Which water a port is on, and
 * whether that water has a zone, is the lane graph's to find (`buildLaneGraph`): only the
 * terrain is read here.
 */
import { isLand } from '../../shared/terrain';
import type { PlacedCity } from './cities';
import { nearestCellWhere, nearestOwnedCell } from './ownership';
import { cellOf } from './terrain';

export interface PortDef {
  name: string;
  /** Where it stands on land; it takes the nearest owned land within `PORT_SNAP_CELLS`. */
  lonLat: readonly [number, number];
  /** Its water, where that is not the nearest to it. */
  water?: readonly [number, number];
  /** The nation that holds it at the start: it takes that nation's land. */
  nation?: string;
  /** Port level; the least, 1, when left out. */
  port?: number;
  navalBase: number;
}

export interface PortRules {
  /** A city of this size or more with water in reach is a port. */
  minCitySize: number;
  /** How far from a city's cell, in cells, its water may be. */
  reachCells: number;
  /** Port level by city size, from `minCitySize` up. */
  levelBySize: readonly number[];
  ports: readonly PortDef[];
}

export interface Port {
  name: string;
  /** The land cell it stands in: who holds the cell holds the port. */
  cell: number;
  /** Its place, cells (fractional): the city's, or the place given by hand. */
  x: number;
  y: number;
  /** The place of its water, cells (fractional), when given by hand; else NaN. */
  waterX: number;
  waterY: number;
  /** Building levels (`data/buildings/buildings.json`): `port` 1 or more, `navalBase` 0 for none. */
  port: number;
  navalBase: number;
  /** The row of `rules.ports` it is, or -1; the index of its city in the list given, or -1. */
  def: number;
  city: number;
}

/** How far a port given by hand looks for owned land, as a city does (`CITY_SNAP_CELLS`). */
export const PORT_SNAP_CELLS = 2;

function waterInReach(terrain: Uint8Array, cell: number, w: number, h: number, reach: number): boolean {
  const x = cell % w;
  const y = (cell - x) / w;
  return nearestCellWhere((c) => !isLand(terrain[c]!), x + 0.5, y + 0.5, w, h, reach, true) >= 0;
}

/**
 * The ports: the cities' in the cities' order, then those by hand that stand in no city port's
 * cell, in the file's order. `unplaced` are the rows by hand with no owned land (or none of
 * their nation's) in reach. With `nations` false the rows' nations are not read (a world with
 * other nations on the same map).
 */
export function placePorts(
  rules: PortRules,
  cities: readonly PlacedCity[],
  tags: readonly string[],
  owner: Uint16Array,
  terrain: Uint8Array,
  w: number,
  h: number,
  nations = true,
): { ports: Port[]; unplaced: number[] } {
  const ports: Port[] = [];
  const at = new Map<number, number>();
  for (let i = 0; i < cities.length; i++) {
    const c = cities[i]!;
    if (c.size < rules.minCitySize || at.has(c.cell) || !waterInReach(terrain, c.cell, w, h, rules.reachCells)) continue;
    at.set(c.cell, ports.length);
    const level = rules.levelBySize[Math.min(c.size - rules.minCitySize, rules.levelBySize.length - 1)]!;
    ports.push({ name: c.name, cell: c.cell, x: c.x, y: c.y, waterX: NaN, waterY: NaN, port: level, navalBase: 0, def: -1, city: i });
  }
  const idOf = new Map(tags.map((t, i) => [t, i + 1]));
  const unplaced: number[] = [];
  rules.ports.forEach((d, di) => {
    const [x, y] = cellOf(d.lonLat[0], d.lonLat[1], w, h);
    const nation = nations && d.nation !== undefined ? (idOf.get(d.nation) ?? -1) : 0;
    const cell = nation !== 0 ? nearestOwnedCell(owner, nation, x, y, w, h, PORT_SNAP_CELLS) : nearestCellWhere((c) => owner[c] !== 0, x, y, w, h, PORT_SNAP_CELLS, true);
    if (cell < 0) {
      unplaced.push(di);
      return;
    }
    const [waterX, waterY] = d.water ? cellOf(d.water[0], d.water[1], w, h) : [NaN, NaN];
    const k = at.get(cell);
    const port: Port = { name: d.name, cell, x, y, waterX, waterY, port: Math.max(d.port ?? 1, k === undefined ? 0 : ports[k]!.port), navalBase: d.navalBase, def: di, city: k === undefined ? -1 : ports[k]!.city };
    if (k === undefined) {
      at.set(cell, ports.length);
      ports.push(port);
    } else ports[k] = port;
  });
  return { ports, unplaced };
}
