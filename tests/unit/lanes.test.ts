import { describe, expect, it } from 'vitest';
import passagesJson from '../../data/maps/earth/passages.json';
import seasJson from '../../data/maps/earth/seas.json';
import straitsJson from '../../data/maps/earth/straits.json';
import { isLand, Terrain } from '../../src/shared/terrain';
import { cellOf, loadTerrain, type StraitDef } from '../../src/sim/data/terrain';
import { makeNavGrid, type NavGrid } from '../../src/sim/nav/grid';
import { buildLaneGraph, greatCircleKm, LaneNode, laneRoute, type LaneGraph, type SeaPassage } from '../../src/sim/nav/lanes';
import { buildSeaZones, type SeaSeed, type SeaZones } from '../../src/sim/nav/seaZones';
import { createToyWorld } from '../../src/sim/toy';
import { laneOf, navOf, seaOf } from '../../src/sim/world';
import { earthFile } from '../helpers/earth';

// PLAN 4.1b: the lane graph joins the zones that touch, the straits, and by the map's passages
// what a ship passes and the cell grid closes.

const seeds = seasJson.seas as unknown as SeaSeed[];
const passages = passagesJson.passages as unknown as SeaPassage[];
const straits = straitsJson.straits as unknown as StraitDef[];

function earthGrid(w: number): NavGrid {
  const h = w / 2;
  return makeNavGrid(loadTerrain(new Uint8Array(earthFile(`terrain-${w}x${h}.u8.wsz`)), w, h, straits).terrain, w, h, true);
}

/**
 * What holds of any lane graph: an edge runs from its first node's cell to its second's over
 * zoned water, step by step with no corner of land cut, and only a passage has a jump, one.
 */
function checkLanes(g: NavGrid, z: SeaZones, l: LaneGraph): void {
  const { w } = g;
  expect(l.zones).toBe(z.count);
  for (let i = 0; i < l.kind.length; i++) {
    if (i < z.count) {
      expect(l.kind[i]).toBe(LaneNode.zone);
      expect(l.cell[i]).toBe(z.seedCell[i + 1]);
    } else {
      expect(l.kind[i]).toBe(LaneNode.strait);
      expect(g.terrain[l.cell[i]!], `the cell of strait ${i}`).toBe(Terrain.Crossing);
    }
  }
  l.edges.forEach((e, i) => {
    const what = `edge ${i} (${e.a}–${e.b})`;
    expect(e.a, what).toBeLessThan(e.b);
    expect(e.km, what).toBeGreaterThan(0);
    expect(Number.isFinite(e.km), what).toBe(true);
    expect(e.cells[0], what).toBe(l.cell[e.a]);
    expect(e.cells[e.cells.length - 1], what).toBe(l.cell[e.b]);
    expect(e.crossing, what).toBe(l.kind[e.b] === LaneNode.strait);
    expect(e.landAt >= 0, what).toBe(e.passage >= 0);
    for (let k = 0; k < e.cells.length; k++) {
      const c = e.cells[k]!;
      expect(isLand(g.terrain[c]!), `${what}: cell ${c} is land`).toBe(false);
      expect(z.zoneOf[c], `${what}: cell ${c} has no zone`).toBeGreaterThan(0);
      if (k === 0 || k === e.landAt) continue;
      const p = e.cells[k - 1]!;
      let dx = Math.abs((c % w) - (p % w));
      if (g.wrapX && dx === w - 1) dx = 1;
      const dy = Math.abs(Math.floor(c / w) - Math.floor(p / w));
      expect(dx <= 1 && dy <= 1 && dx + dy > 0, `${what}: ${p} to ${c} is no step`).toBe(true);
      if (dx === 1 && dy === 1) {
        const py = Math.floor(p / w);
        const cy = Math.floor(c / w);
        expect(isLand(g.terrain[py * w + (c % w)]!) || isLand(g.terrain[cy * w + (p % w)]!), `${what}: ${p} to ${c} cuts a corner of land`).toBe(false);
      }
    }
  });
  l.adj.forEach((list, node) => {
    for (const e of list) expect(l.edges[e]!.a === node || l.edges[e]!.b === node).toBe(true);
  });
  expect(l.adj.reduce((s, list) => s + list.length, 0)).toBe(2 * l.edges.length);
  // The zones that touch, and no others, have an edge that is no passage.
  const pairs = l.edges.filter((e) => !e.crossing && e.passage < 0).map((e) => `${e.a + 1}-${e.b + 1}`);
  const touch: string[] = [];
  for (let i = 1; i <= z.count; i++) for (const m of z.adj[i]!) if (i < m) touch.push(`${i}-${m}`);
  expect(pairs).toEqual(touch);
}

function zoneNode(z: SeaZones, list: readonly SeaSeed[], name: string, part = 0): number {
  for (let i = 1; i <= z.count; i++) {
    const s = z.seed[i]!;
    if (s >= 0 && list[s]!.name === name && list[s]!.part === part) return i - 1;
  }
  throw new Error(`no zone of ${name} ${part}`);
}

/** The lanes with the passages taken out. */
function withoutPassages(l: LaneGraph): LaneGraph {
  return { ...l, adj: l.adj.map((list) => list.filter((e) => l.edges[e]!.passage < 0)) };
}

describe('lane graph (PLAN 4.1b)', () => {
  const g = earthGrid(2048);
  const z = buildSeaZones(g, seeds);
  const l = buildLaneGraph(g, z, passages);
  const passageOf = (id: string): number => passages.findIndex((p) => p.id === id);

  it('the 1938 map at M: every edge runs over water, the straits are nodes, every passage is an edge', () => {
    checkLanes(g, z, l);
    expect(l.dropped).toEqual([]);
    expect(l.edges.filter((e) => e.passage >= 0).length).toBe(passages.length);
    expect(l.kind.length - l.zones).toBeGreaterThanOrEqual(20);
    // Built again it is the same.
    const again = buildLaneGraph(g, z, passages);
    expect(again.cell).toEqual(l.cell);
    expect(again.edges).toEqual(l.edges);
  });

  it('Gibraltar to Suez: by the canal, and round Africa without it', () => {
    const gib = straits.find((s) => s.id === 'gibraltar')!;
    const [x, y] = cellOf((gib.a[0] + gib.b[0]) / 2, (gib.a[1] + gib.b[1]) / 2, g.w, g.h);
    let from = -1;
    for (let i = l.zones; i < l.kind.length; i++) {
      if (Math.abs((l.cell[i]! % g.w) - x) < 3 && Math.abs(Math.floor(l.cell[i]! / g.w) - y) < 3) from = i;
    }
    expect(from, 'the strait node at Gibraltar').toBeGreaterThanOrEqual(0);
    const to = zoneNode(z, seeds, 'Red Sea', 1);
    const r = laneRoute(l, from, to)!;
    expect(r.nodes[0]).toBe(from);
    expect(r.nodes[r.nodes.length - 1]).toBe(to);
    expect(r.edges.map((e) => l.edges[e]!.passage)).toContain(passageOf('suez'));
    // The straight line over the land is about 3,700 km; round the Cape it is over 20,000.
    const straight = greatCircleKm(gib.a, seeds[z.seed[to + 1]!]!.lonLat);
    expect(r.km).toBeGreaterThan(straight);
    expect(r.km).toBeLessThan(1.5 * straight);
    expect(r.edges.reduce((s, e) => s + l.edges[e]!.km, 0)).toBeCloseTo(r.km, 6);
    const round = laneRoute(withoutPassages(l), from, to)!;
    expect(round.km).toBeGreaterThan(4 * r.km);
  });

  it('the Black Sea to the Mediterranean: by the Bosporus, the Sea of Marmara and the Dardanelles, and no way without them', () => {
    const from = zoneNode(z, seeds, 'Black Sea');
    const to = zoneNode(z, seeds, 'Mediterranean Sea', 4);
    const r = laneRoute(l, from, to)!;
    expect(r.nodes).toContain(zoneNode(z, seeds, 'Sea of Marmara'));
    const used = r.edges.map((e) => l.edges[e]!.passage);
    expect(used).toContain(passageOf('bosporus'));
    expect(used).toContain(passageOf('dardanelles'));
    expect(laneRoute(withoutPassages(l), from, to)).toBeNull();
    // The Caspian is joined to no sea.
    expect(laneRoute(l, zoneNode(z, seeds, 'Caspian Sea', 1), to)).toBeNull();
  });

  it('the Atlantic to the Pacific by Panama, and through the Strait of Magellan', () => {
    const r = laneRoute(l, zoneNode(z, seeds, 'Caribbean Sea', 3), zoneNode(z, seeds, 'Golfo de Panamá'))!;
    expect(r.edges.map((e) => l.edges[e]!.passage)).toEqual([passageOf('panama')]);
    const inner = zoneNode(z, seeds, 'Estrecho de Magellanes');
    expect(laneRoute(l, zoneNode(z, seeds, 'Bahía Grande'), inner)).not.toBeNull();
    expect(laneRoute(withoutPassages(l), zoneNode(z, seeds, 'Bahía Grande'), inner)).toBeNull();
  });

  it('the toy world has no passages and has lanes, held with the zones', () => {
    const world = createToyWorld(7);
    const lanes = laneOf(world);
    expect(lanes.edges.length).toBeGreaterThan(0);
    expect(lanes.edges.every((e) => e.passage < 0)).toBe(true);
    checkLanes(navOf(world).grid, seaOf(world), lanes);
    expect(laneOf(world)).toBe(lanes);
  });

  it('a passage joins two waters; one with an end out of reach of water, or both ends in one zone, is left out', () => {
    const w = 64;
    const h = 32;
    const terrain = new Uint8Array(w * h).fill(Terrain.Plains);
    for (let y = 10; y < 20; y++) for (let x = 10; x < 20; x++) terrain[y * w + x] = Terrain.Water;
    for (let y = 10; y < 20; y++) for (let x = 24; x < 34; x++) terrain[y * w + x] = Terrain.Water;
    // A strait in the first water: a crossing cell between two shores.
    terrain[10 * w + 15] = Terrain.Crossing;
    const sg = makeNavGrid(terrain, w, h, false);
    const at = (x: number, y: number): [number, number] => {
      // The middle of a cell, in degrees, by the search for the cell that holds it.
      for (let lon = -180; lon < 180; lon += 0.5) for (let lat = 79; lat > -64; lat -= 0.5) {
        const [cx, cy] = cellOf(lon, lat, w, h);
        if (Math.floor(cx) === x && Math.floor(cy) === y) return [lon, lat];
      }
      throw new Error('no such cell');
    };
    const sz = buildSeaZones(sg, [
      { name: 'West', part: 0, lonLat: at(15, 15) },
      { name: 'East', part: 0, lonLat: at(29, 15) },
    ]);
    expect(sz.count).toBe(2);
    const canal: SeaPassage = { id: 'canal', name: 'Canal', a: at(19, 15), b: at(24, 15) };
    const sl = buildLaneGraph(sg, sz, [
      { id: 'far', name: 'Far', a: at(19, 15), b: at(50, 15) },
      canal,
      { id: 'same', name: 'Same', a: at(10, 10), b: at(19, 19) },
    ]);
    checkLanes(sg, sz, sl);
    expect(sl.dropped).toEqual([0, 2]);
    // The strait is a node with one edge, to its zone; the canal is the one edge between the zones.
    expect(sl.kind.length).toBe(3);
    expect(sl.cell[2]).toBe(10 * w + 15);
    expect(sl.edges.map((e) => [e.a, e.b, e.crossing, e.passage])).toEqual([
      [0, 1, false, 1],
      [0, 2, true, -1],
    ]);
    // Seed to the canal's mouth, the canal, and on to the other seed: 4 steps, the passage, 5 steps.
    const e = sl.edges[0]!;
    expect([...e.cells]).toEqual([15, 16, 17, 18, 19, 24, 25, 26, 27, 28, 29].map((x) => 15 * w + x));
    expect(e.landAt).toBe(5);
    expect(e.km).toBeCloseTo(9 * sg.kx[15]! + greatCircleKm(canal.a, canal.b), 6);
    expect(laneRoute(sl, 2, 1)!.nodes).toEqual([2, 0, 1]);
    expect(laneRoute(buildLaneGraph(sg, sz, []), 0, 1)).toBeNull();
  });
});
