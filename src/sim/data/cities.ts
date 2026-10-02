/**
 * City placement (PLAN 1.5, SPEC §3.3): `data/scenarios/<id>/cities.json` → cities on the w×h
 * grid with their cell, owning nation and capital role. A city on a coast often falls in a
 * sea cell at M; it belongs to the nearest owned land cell within 2 cells (its `cell`), while
 * `x, y` keep the true position for rendering. Cities with no owned land in reach are dropped.
 */
import { nearestCellWhere, nearestOwnedCell } from './ownership';
import { cellOf } from './terrain';

export interface CityDef {
  name: string;
  lonLat: readonly [number, number];
  size: number;
  capitalOf?: string;
}

export interface PlacedCity {
  /** Index of the city in the input list (cities.json). */
  def: number;
  name: string;
  /** True position, cells (fractional). */
  x: number;
  y: number;
  /** Land cell the city occupies (owner lookup, capture). */
  cell: number;
  size: number;
  /** Owning nation id at start. */
  owner: number;
  /** Nation id whose capital this is (0 = none). */
  capitalOf: number;
}

export const CITY_SNAP_CELLS = 2;

export function placeCities(defs: readonly CityDef[], tags: readonly string[], owner: Uint16Array, w: number, h: number): PlacedCity[] {
  const idOf = new Map(tags.map((t, i) => [t, i + 1]));
  const out: PlacedCity[] = [];
  for (let di = 0; di < defs.length; di++) {
    const d = defs[di]!;
    const [x, y] = cellOf(d.lonLat[0], d.lonLat[1], w, h);
    const capitalOf = d.capitalOf === undefined ? 0 : (idOf.get(d.capitalOf) ?? 0);
    // A capital belongs to its own nation; other cities to whoever owns the nearest land.
    const cell =
      capitalOf !== 0
        ? nearestOwnedCell(owner, capitalOf, x, y, w, h, CITY_SNAP_CELLS)
        : nearestCellWhere((c) => owner[c] !== 0, x, y, w, h, CITY_SNAP_CELLS);
    if (cell < 0) continue;
    out.push({ def: di, name: d.name, x, y, cell, size: d.size, owner: owner[cell]!, capitalOf });
  }
  return out;
}
