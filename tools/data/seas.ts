// The seeds of the sea zones (PLAN 4.1a): Natural Earth marine polygons → data/maps/earth/seas.json.
//
// 1. Each named polygon is drawn on the M map (2048×1024) over its water and crossing cells. One
//    with less than MIN_NAMED_KM2 of them is left out (a fjord, a lagoon, a river's mouth).
// 2. A cell in several polygons is of the smallest (the Adriatic in the Mediterranean); a cell in
//    none is of the sea nearest to it over water.
// 3. A sea of k times ZONE_KM2, or k times ZONE_SPAN_KM long, is given k seeds, spread over it (`spreadSeeds`, the function the
//    sim uses for water with no name); a seed is the middle of a cell. A sea in several pieces
//    is spread over piece by piece, and a piece under MIN_NAMED_KM2 has no seed.
// The sim makes the zones from the seeds alone (a Voronoi over water, `buildSeaZones`), so a
// zone's edge is near the polygon's and not on it.
// Deterministic: the features sorted by name and id, fixed rounding.
import { rasterizePolygon } from '../../src/shared/rasterize';
import { isLand } from '../../src/shared/terrain';
import { unproject } from '../../src/sim/data/projection';
import { cellOf } from '../../src/sim/data/terrain';
import { makeNavGrid, neighbours4 } from '../../src/sim/nav/grid';
import { areaOf, seaScratch, spreadSeeds, type SeaSeed } from '../../src/sim/nav/seaZones';

export interface MarineFeature {
  properties: { name: string | null; featurecla: string; scalerank: number; ne_id: number };
  geometry: { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] };
}

/** A named water with less than this on the M map, km², is not a sea of its own. */
export const MIN_NAMED_KM2 = 10_000;

/** 'INDIAN OCEAN' → 'Indian Ocean' (two names of the source are in capitals). */
function nameOf(raw: string): string {
  if (raw !== raw.toUpperCase()) return raw;
  return raw.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, sp: string, ch: string) => sp + ch.toUpperCase());
}

/** The seeds for a w×h terrain raster with its crossings applied. */
export function buildSeaSeeds(features: readonly MarineFeature[], terrain: Uint8Array, w: number, h: number): SeaSeed[] {
  const g = makeNavGrid(terrain, w, h, true);
  const n = w * h;
  const named = features
    .filter((f) => f.properties.name)
    .map((f) => ({ name: nameOf(f.properties.name!), id: f.properties.ne_id, geometry: f.geometry, cells: [] as number[], area: 0 }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id - b.id));

  for (const f of named) {
    const seen = new Set<number>();
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) {
      const rings = poly.map((ring) => {
        const out = new Float64Array(ring.length * 2);
        ring.forEach(([lon, lat], i) => {
          const [x, y] = cellOf(lon!, lat!, w, h);
          out[2 * i] = x;
          out[2 * i + 1] = y;
        });
        return out;
      });
      rasterizePolygon(rings, w, h, (y, x0, x1) => {
        for (let c = y * w + x0; c < y * w + x1; c++) if (!isLand(terrain[c]!)) seen.add(c);
      });
    }
    f.cells = [...seen].sort((a, b) => a - b);
    f.area = areaOf(g, f.cells);
  }
  const seas = named.filter((f) => f.area >= MIN_NAMED_KM2);

  // The smallest sea a cell is in: the largest first, each smaller one over it.
  const mark = new Int32Array(n).fill(-1);
  const order = seas.map((_, i) => i).sort((a, b) => seas[b]!.area - seas[a]!.area || a - b);
  for (const i of order) for (const c of seas[i]!.cells) mark[c] = i;
  // Water in no polygon: of the sea nearest over water.
  const queue: number[] = [];
  for (let c = 0; c < n; c++) if (mark[c] !== -1) queue.push(c);
  const nb: number[] = [];
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head]!;
    for (const m of neighbours4(c, w, h, true, nb)) {
      if (mark[m] !== -1 || isLand(terrain[m]!)) continue;
      mark[m] = mark[c]!;
      queue.push(m);
    }
  }
  const cellsOf: number[][] = seas.map(() => []);
  for (let c = 0; c < n; c++) if (mark[c] !== -1) cellsOf[mark[c]!]!.push(c);

  // A sea's cells can be in several pieces (a polygon over an isthmus, a lagoon in an atoll): each
  // piece large enough is spread over by itself, and one that is not has no seed.
  const s = seaScratch(g);
  const part = new Int32Array(n).fill(-1);
  const piece = new Int32Array(n).fill(-1);
  const out: SeaSeed[] = [];
  seas.forEach((f, i) => {
    const cells: number[] = [];
    for (const c0 of cellsOf[i]!) {
      if (piece[c0] !== -1) continue;
      const run = [c0];
      piece[c0] = c0;
      for (let head = 0; head < run.length; head++) {
        for (const m of neighbours4(run[head]!, w, h, true, nb)) {
          if (piece[m] !== -1 || mark[m] !== i) continue;
          piece[m] = c0;
          run.push(m);
        }
      }
      const area = areaOf(g, run);
      if (area < MIN_NAMED_KM2) continue;
      run.sort((a, b) => a - b);
      cells.push(...spreadSeeds(g, s, run, piece, c0, part, 0));
    }
    cells.sort((a, b) => a - b);
    cells.forEach((c, k) => {
      const x = c % w;
      const [lon, lat] = unproject((x + 0.5) / w, ((c - x) / w + 0.5) / h);
      out.push({ name: f.name, part: cells.length === 1 ? 0 : k + 1, lonLat: [Number(lon.toFixed(3)), Number(lat.toFixed(3))] });
    });
  });
  return out;
}

export function seasJson(seeds: readonly SeaSeed[]): string {
  const lines = seeds.map((s) => JSON.stringify(s)).join(',\n    ');
  return `{\n  "comment": "Generated by npm run data from the Natural Earth marine polygons (PLAN 4.1a, tools/data/seas.ts). Do not edit by hand.",\n  "seas": [\n    ${lines}\n  ]\n}\n`;
}
