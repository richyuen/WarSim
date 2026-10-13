/**
 * Airbase placement (PLAN 5.1c, SPEC §6.3): `data/scenarios/<id>/airbases.json` and the placed
 * cities → the airbases of a world. Every capital city is an airbase of `capitalLevel`, a city of
 * `minCitySize` or more one of `sizeLevel`; the file's own list, by hand, holds the main air
 * stations, each of its level, one in a city base's cell raising it to the higher of the two.
 * Who holds the cell holds the base (`airbaseHolder`); its room is `AIR_PER_LEVEL` aircraft a
 * level (the airbase building's `airCapacity`). Static data of the scenario, as the ports are.
 */
import buildings from '../../../data/buildings/buildings.json' with { type: 'json' };
import type { PlacedCity } from './cities';
import { nearestCellWhere, nearestOwnedCell } from './ownership';
import { cellOf } from './terrain';

export interface AirbaseDef {
  name: string;
  lonLat: readonly [number, number];
  /** The nation that holds it at the start: it takes that nation's land. */
  nation?: string;
  level: number;
}

export interface AirbaseRules {
  /** A capital city is an airbase of this level. */
  capitalLevel: number;
  /** A city of this size or more is an airbase of `sizeLevel`. */
  minCitySize: number;
  sizeLevel: number;
  bases: readonly AirbaseDef[];
}

export interface Airbase {
  name: string;
  /** The land cell it stands in: who holds the cell holds the base. */
  cell: number;
  x: number;
  y: number;
  /** The airbase building's level, 1 to 5. */
  level: number;
  /** The row of `rules.bases` it is, or -1; its city in the list given, or -1. */
  def: number;
  city: number;
}

/** Aircraft an airbase's level holds (`airCapacity` of the airbase building). */
export const AIR_PER_LEVEL: number = buildings.buildings.find((b) => b.id === 'airbase')!.perLevel.airCapacity!;
/** How far a base given by hand looks for owned land, cells (as a port does). */
export const AIRBASE_SNAP_CELLS = 2;

/** The aircraft airbase `b` holds at most. */
export function airbaseRoom(b: Airbase): number {
  return AIR_PER_LEVEL * b.level;
}

/** Who holds airbase `b`: its cell's controller (0 for none). */
export function airbaseHolder(controller: Uint16Array, b: Airbase): number {
  return controller[b.cell]!;
}

/**
 * The airbases: the cities' in the cities' order, then those by hand that stand in no city
 * base's cell, in the file's order (one that does raises that base's level). `unplaced` are the
 * rows by hand with no land of their nation's in reach. With `nations` false the rows' nations
 * are not read (a world with other nations on the same map); a city's capital is its world's own.
 */
export function placeAirbases(rules: AirbaseRules, cities: readonly PlacedCity[], tags: readonly string[], owner: Uint16Array, w: number, h: number, nations = true): { airbases: Airbase[]; unplaced: number[] } {
  const bases: Airbase[] = [];
  const at = new Map<number, number>();
  cities.forEach((c, i) => {
    const level = Math.max(c.capitalOf !== 0 ? rules.capitalLevel : 0, c.size >= rules.minCitySize ? rules.sizeLevel : 0);
    if (level === 0 || at.has(c.cell)) return;
    at.set(c.cell, bases.length);
    bases.push({ name: c.name, cell: c.cell, x: c.x, y: c.y, level, def: -1, city: i });
  });
  const idOf = new Map(tags.map((t, i) => [t, i + 1]));
  const unplaced: number[] = [];
  rules.bases.forEach((d, di) => {
    const [x, y] = cellOf(d.lonLat[0], d.lonLat[1], w, h);
    const nation = nations && d.nation !== undefined ? (idOf.get(d.nation) ?? -1) : 0;
    const cell = nation !== 0 ? nearestOwnedCell(owner, nation, x, y, w, h, AIRBASE_SNAP_CELLS) : nearestCellWhere((c) => owner[c] !== 0, x, y, w, h, AIRBASE_SNAP_CELLS, true);
    if (cell < 0) {
      unplaced.push(di);
      return;
    }
    const k = at.get(cell);
    if (k !== undefined) {
      bases[k] = { ...bases[k]!, name: d.name, level: Math.max(d.level, bases[k]!.level), def: di };
      return;
    }
    at.set(cell, bases.length);
    bases.push({ name: d.name, cell, x, y, level: d.level, def: di, city: -1 });
  });
  return { airbases: bases, unplaced };
}
