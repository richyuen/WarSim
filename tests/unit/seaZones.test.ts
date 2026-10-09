import { describe, expect, it } from 'vitest';
import seasJson from '../../data/maps/earth/seas.json';
import straitsJson from '../../data/maps/earth/straits.json';
import { isLand, Terrain } from '../../src/shared/terrain';
import { cellOf, loadTerrain, type StraitDef } from '../../src/sim/data/terrain';
import { makeNavGrid, neighbours4, type NavGrid } from '../../src/sim/nav/grid';
import { areaOf, buildSeaZones, MIN_WATER_KM2, ZONE_KM2, type SeaSeed, type SeaZones } from '../../src/sim/nav/seaZones';
import { createToyWorld } from '../../src/sim/toy';
import { seaOf } from '../../src/sim/world';
import { earthFile } from '../helpers/earth';

// PLAN 4.1a: the sea zones are a Voronoi over water from the seeds of the map's named seas, and
// water no seed reaches has zones of its own.

const seeds = seasJson.seas as unknown as SeaSeed[];

function earthGrid(w: number): NavGrid {
  const h = w / 2;
  return makeNavGrid(loadTerrain(new Uint8Array(earthFile(`terrain-${w}x${h}.u8.wsz`)), w, h, straitsJson.straits as unknown as StraitDef[]).terrain, w, h, true);
}

/** What holds of any zones: no zone on land, each zone in one piece round its seed, and water left without one is a small body by itself. */
function checkZones(g: NavGrid, z: SeaZones): void {
  const n = g.w * g.h;
  const nb: number[] = [];
  const seen = new Uint8Array(n);
  let zoned = 0;
  for (let c = 0; c < n; c++) {
    if (isLand(g.terrain[c]!)) expect(z.zoneOf[c], `land cell ${c}`).toBe(0);
    else if (z.zoneOf[c] !== 0) zoned++;
  }
  let reached = 0;
  for (let i = 1; i <= z.count; i++) {
    expect(z.zoneOf[z.seedCell[i]!], `the seed of zone ${i}`).toBe(i);
    const stack = [z.seedCell[i]!];
    seen[stack[0]!] = 1;
    let cells = 0;
    while (stack.length) {
      const c = stack.pop()!;
      cells++;
      for (const m of neighbours4(c, g.w, g.h, g.wrapX, nb)) {
        if (seen[m] || z.zoneOf[m] !== i) continue;
        seen[m] = 1;
        stack.push(m);
      }
    }
    expect(cells, `cells of zone ${i} that reach its seed`).toBe(z.cells[i]);
    reached += cells;
  }
  expect(reached).toBe(zoned);
  for (let c0 = 0; c0 < n; c0++) {
    if (seen[c0] || isLand(g.terrain[c0]!)) continue;
    const body = [c0];
    seen[c0] = 1;
    for (let head = 0; head < body.length; head++) {
      for (const m of neighbours4(body[head]!, g.w, g.h, g.wrapX, nb)) {
        if (isLand(g.terrain[m]!)) continue;
        expect(z.zoneOf[m], `water beside the water without a zone at ${c0}`).toBe(0);
        if (seen[m]) continue;
        seen[m] = 1;
        body.push(m);
      }
    }
    expect(areaOf(g, body), `the water without a zone at ${c0}`).toBeLessThan(MIN_WATER_KM2);
  }
  for (let i = 1; i <= z.count; i++) for (const m of z.adj[i]!) expect(z.adj[m]).toContain(i);
}

function nameAt(g: NavGrid, z: SeaZones, lon: number, lat: number): string | undefined {
  const [x, y] = cellOf(lon, lat, g.w, g.h);
  const zone = z.zoneOf[Math.floor(y) * g.w + Math.floor(x)]!;
  return zone === 0 || z.seed[zone]! < 0 ? undefined : seeds[z.seed[zone]!]!.name;
}

describe('sea zones (PLAN 4.1a)', () => {
  it('the 1938 map at M: the count is in the range of SPEC §3.3, every seed makes a zone, and the zones hold', () => {
    const g = earthGrid(2048);
    const z = buildSeaZones(g, seeds);
    expect(z.dropped).toEqual([]);
    expect(z.count).toBeGreaterThanOrEqual(300);
    expect(z.count).toBeLessThanOrEqual(450);
    checkZones(g, z);
    // No zone is far over the area a zone is meant to have.
    expect(Math.max(...z.areaKm2)).toBeLessThan(2 * ZONE_KM2);
    // The seas are where they are.
    expect(nameAt(g, z, 34, 43.5)).toBe('Black Sea');
    expect(nameAt(g, z, 28, 33.5)).toBe('Mediterranean Sea');
    expect(nameAt(g, z, 20, 34.5)).toBe('Mediterranean Sea');
    expect(nameAt(g, z, 3, 56)).toBe('North Sea');
    expect(nameAt(g, z, 135, 39)).toBe('Sea of Japan');
    expect(nameAt(g, z, -40, 30)).toBe('North Atlantic Ocean');
    expect(nameAt(g, z, 51, 42)).toBe('Caspian Sea');
    // Lake Superior has no name in the seas file and is a zone all the same.
    const [x, y] = cellOf(-87.5, 47.7, g.w, g.h);
    const lake = z.zoneOf[Math.floor(y) * g.w + Math.floor(x)]!;
    expect(lake).toBeGreaterThan(0);
    expect(z.seed[lake]).toBe(-1);
    // Built again it is the same.
    const again = buildSeaZones(g, seeds);
    expect(again.zoneOf).toEqual(z.zoneOf);
    expect(again.adj).toEqual(z.adj);
  });

  it('the 1938 map at S: the same seeds, each a cell of its own', () => {
    const g = earthGrid(1024);
    const z = buildSeaZones(g, seeds);
    expect(z.dropped).toEqual([]);
    checkZones(g, z);
    expect(nameAt(g, z, 34, 43.5)).toBe('Black Sea');
  });

  it('the toy world has no seas file and has zones, none with a name', () => {
    const world = createToyWorld(7);
    const z = seaOf(world);
    expect(z.count).toBeGreaterThan(0);
    expect([...z.seed.subarray(1)].every((s) => s === -1)).toBe(true);
    expect(seaOf(world)).toBe(z);
  });

  it('water with no seed: a large body is cut into parts by its area, each in one piece', () => {
    // 256×128 with the cells of the earth's M map near the equator would be small: the grid's
    // own scales are used, so the areas are asked of it.
    const w = 256;
    const h = 128;
    const terrain = new Uint8Array(w * h).fill(Terrain.Plains);
    for (let y = 40; y < 90; y++) for (let x = 20; x < 120; x++) terrain[y * w + x] = Terrain.Water;
    terrain[100 * w + 200] = Terrain.Water;
    const g = makeNavGrid(terrain, w, h, false);
    const ocean: number[] = [];
    for (let c = 0; c < w * h; c++) if (terrain[c] === Terrain.Water && c !== 100 * w + 200) ocean.push(c);
    const parts = Math.max(1, Math.round(areaOf(g, ocean) / ZONE_KM2));
    expect(parts).toBeGreaterThan(3);
    expect(areaOf(g, [100 * w + 200])).toBeGreaterThan(MIN_WATER_KM2); // a cell of this grid is large: it is a zone
    const z = buildSeaZones(g, []);
    // As many as the area asks for, or more where the length asks for more; none far over the area meant.
    expect(z.count).toBeGreaterThanOrEqual(parts + 1);
    expect(z.count).toBeLessThanOrEqual(2 * parts + 1);
    checkZones(g, z);
    expect(Math.max(...z.areaKm2)).toBeLessThan(2 * ZONE_KM2);
    expect(z.zoneOf[100 * w + 200]).toBeGreaterThan(0);
  });

  it('a seed on land takes the water beside it, and one with no water in reach is left out', () => {
    const w = 64;
    const h = 32;
    const terrain = new Uint8Array(w * h).fill(Terrain.Plains);
    for (let y = 10; y < 20; y++) for (let x = 10; x < 20; x++) terrain[y * w + x] = Terrain.Water;
    const g = makeNavGrid(terrain, w, h, true);
    const at = (x: number, y: number): [number, number] => {
      // The middle of a cell, in degrees, by the search for the cell that holds it.
      for (let lon = -180; lon < 180; lon += 0.5) for (let lat = 79; lat > -64; lat -= 0.5) {
        const [cx, cy] = cellOf(lon, lat, w, h);
        if (Math.floor(cx) === x && Math.floor(cy) === y) return [lon, lat];
      }
      throw new Error('no such cell');
    };
    const z = buildSeaZones(g, [
      { name: 'Near', part: 0, lonLat: at(9, 15) },
      { name: 'Far', part: 0, lonLat: at(40, 15) },
    ]);
    expect(z.dropped).toEqual([1]);
    expect(z.count).toBe(1);
    expect(z.cells[1]).toBe(100);
    expect(z.seed[1]).toBe(0);
  });
});
