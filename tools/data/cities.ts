// 1938 city list (PLAN 1.5): Natural Earth populated places → data/scenarios/1938/cities.json.
//
// 1. Every living nation's capital (nations.json) is bound to the nearest NE place within
//    40 km and takes the capital's name; with no place in reach it is created at the capital's
//    coordinates (e.g. Yan'an).
// 2. Other places: scalerank ≤ maxScalerank, no research stations, nothing south of 60° S,
//    nothing in `exclude` (founded or made capitals after 1938), renamed per `renames`;
//    places in `include` are taken regardless of scalerank, right after the capitals.
// 3. Thinning: greedily by (scalerank, population, name), a place is kept only if no kept city
//    lies within `minSpacingCells` M cells (capitals are placed first and always kept).
// 4. Size 1–5: the larger of the scalerank tier and the population tier; capitals ≥ 3.
// Deterministic: sorted inputs, fixed rounding.
import { cellOf } from '../../src/sim/data/terrain';

export interface NePlace {
  NAME: string;
  ADM0_A3: string;
  FEATURECLA: string;
  SCALERANK: number;
  POP_MAX: number;
  LATITUDE: number;
  LONGITUDE: number;
}

export interface CityRules {
  maxScalerank: number;
  minSpacingCells: number;
  /** 'NAME|ADM0' places kept regardless of scalerank (cities that mattered more in 1938 than now). */
  include: string[];
  renames: Record<string, string>;
  exclude: string[];
}

export interface CityOut {
  name: string;
  lonLat: [number, number];
  size: number;
  capitalOf?: string;
}

const M_W = 2048;
const M_H = 1024;
const CAPITAL_BIND_KM = 40;

function km(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r;
  const dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

function sizeOfRank(scalerank: number): number {
  return scalerank <= 1 ? 5 : scalerank <= 3 ? 4 : scalerank <= 4 ? 3 : scalerank <= 6 ? 2 : 1;
}

function sizeOfPop(pop: number): number {
  return pop >= 5e6 ? 5 : pop >= 1.5e6 ? 4 : pop >= 5e5 ? 3 : pop >= 1.5e5 ? 2 : 1;
}

/** NE scalerank is relative within a country (most German cities rank 7–8), so take the
 * larger of the rank tier and the population tier. */
function sizeOf(p: NePlace): number {
  return Math.max(sizeOfRank(p.SCALERANK), sizeOfPop(p.POP_MAX));
}

const round4 = (v: number): number => Math.round(v * 1e4) / 1e4;

export function buildCities(
  places: readonly NePlace[],
  rules: CityRules,
  capitals: readonly { tag: string; name: string; lonLat: readonly [number, number] }[],
): CityOut[] {
  const keyOf = (p: NePlace): string => `${p.NAME}|${p.ADM0_A3}`;
  const known = new Set(places.map(keyOf));
  const stale = [...Object.keys(rules.renames), ...rules.include, ...rules.exclude].filter((k) => !known.has(k));
  if (stale.length) throw new Error(`city-rules.json keys match no Natural Earth place: ${stale.join(', ')}`);
  const excluded = new Set(rules.exclude);
  const usable = places
    .filter((p) => !/station/i.test(p.FEATURECLA) && p.LATITUDE > -60 && !excluded.has(keyOf(p)))
    .sort((a, b) => a.SCALERANK - b.SCALERANK || b.POP_MAX - a.POP_MAX || (a.NAME < b.NAME ? -1 : a.NAME > b.NAME ? 1 : 0));

  const out: CityOut[] = [];
  const kept: [number, number][] = [];
  const used = new Set<NePlace>();
  const place = (lon: number, lat: number): void => {
    kept.push(cellOf(lon, lat, M_W, M_H));
  };

  for (const c of capitals) {
    let best: NePlace | undefined;
    let bestKm = CAPITAL_BIND_KM;
    for (const p of usable) {
      const d = km(c.lonLat[0], c.lonLat[1], p.LONGITUDE, p.LATITUDE);
      if (d < bestKm) {
        bestKm = d;
        best = p;
      }
    }
    const lon = best ? best.LONGITUDE : c.lonLat[0];
    const lat = best ? best.LATITUDE : c.lonLat[1];
    if (best) used.add(best);
    out.push({ name: c.name, lonLat: [round4(lon), round4(lat)], size: Math.max(3, best ? sizeOf(best) : 3), capitalOf: c.tag });
    place(lon, lat);
  }

  const min2 = rules.minSpacingCells * rules.minSpacingCells;
  const forced = new Set(rules.include);
  const ordered = [...usable.filter((p) => forced.has(keyOf(p))), ...usable.filter((p) => !forced.has(keyOf(p)))];
  for (const p of ordered) {
    if (used.has(p) || (p.SCALERANK > rules.maxScalerank && !forced.has(keyOf(p)) && !/Admin-0 capital/.test(p.FEATURECLA))) continue;
    const [x, y] = cellOf(p.LONGITUDE, p.LATITUDE, M_W, M_H);
    let clear = true;
    for (const [kx, ky] of kept) {
      let dx = Math.abs(kx - x);
      if (dx > M_W / 2) dx = M_W - dx;
      const dy = ky - y;
      if (dx * dx + dy * dy < min2) {
        clear = false;
        break;
      }
    }
    if (!clear) continue;
    kept.push([x, y]);
    out.push({ name: rules.renames[keyOf(p)] ?? p.NAME, lonLat: [round4(p.LONGITUDE), round4(p.LATITUDE)], size: sizeOf(p) });
  }
  return out;
}
