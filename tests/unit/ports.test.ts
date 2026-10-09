import { describe, expect, it } from 'vitest';
import { isLand, Terrain } from '../../src/shared/terrain';
import type { PlacedCity } from '../../src/sim/data/cities';
import { placePorts, type PortRules } from '../../src/sim/data/ports';
import { cellOf } from '../../src/sim/data/terrain';
import { makeNavGrid } from '../../src/sim/nav/grid';
import { buildLaneGraph, LaneNode, laneRoute, type LaneGraph } from '../../src/sim/nav/lanes';
import { buildSeaZones, type SeaZones } from '../../src/sim/nav/seaZones';
import { createRandomWorld } from '../../src/sim/randomWorld';
import { createWorld1938, PORTS_1938, SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { createToyWorld } from '../../src/sim/toy';
import { laneOf, navOf, seaOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 4.1c: the ports and naval bases of a world, each a node of the lane graph. Its
// acceptance test: every coastal province with a port connects to the lane graph.

/** The middle of cell (x, y), in degrees, by the search for the cell that holds it. */
function lonLatOf(x: number, y: number, w: number, h: number): [number, number] {
  for (let lon = -180; lon < 180; lon += 0.5) for (let lat = 79; lat > -64; lat -= 0.5) {
    const [cx, cy] = cellOf(lon, lat, w, h);
    if (Math.floor(cx) === x && Math.floor(cy) === y) return [lon, lat];
  }
  throw new Error('no such cell');
}

const zoneName = (world: World, z: SeaZones, zone: number): string => (z.seed[zone]! >= 0 ? world.seaSeeds[z.seed[zone]!]!.name : '');

/** The nodes a ship reaches from `from`. */
function reached(l: LaneGraph, from: number): Uint8Array {
  const seen = new Uint8Array(l.kind.length);
  const stack = [from];
  seen[from] = 1;
  while (stack.length) {
    const c = stack.pop()!;
    for (const e of l.adj[c]!) {
      const m = l.edges[e]!.a === c ? l.edges[e]!.b : l.edges[e]!.a;
      if (seen[m]) continue;
      seen[m] = 1;
      stack.push(m);
    }
  }
  return seen;
}

describe('ports of the 1938 world (PLAN 4.1c)', () => {
  const { w } = SIZE_1938;
  const world = createWorld1938(99, assets1938(w));
  const g = navOf(world).grid;
  const z = seaOf(world);
  const l = laneOf(world);
  const ports = world.ports;
  const byName = (name: string): number => {
    const i = ports.findIndex((p) => p.name === name);
    if (i < 0) throw new Error(`no port ${name}`);
    return i;
  };
  const waterOf = (name: string): string => zoneName(world, z, z.zoneOf[l.cell[l.portNode[byName(name)]!]!]!);
  // The seas: what a ship reaches from Gibraltar's base.
  const seas = reached(l, l.portNode[byName('Gibraltar')]!);

  it('every port with a node stands on land, has its water in reach, and one edge, from that water\'s zone', () => {
    expect(l.portNode.length).toBe(ports.length);
    let nodes = 0;
    ports.forEach((p, i) => {
      expect(isLand(g.terrain[p.cell]!), `${p.name} on land`).toBe(true);
      expect(world.cells.owner[p.cell], `${p.name} is held`).toBeGreaterThan(0);
      expect(p.port, p.name).toBeGreaterThanOrEqual(1);
      const node = l.portNode[i]!;
      if (node < 0) return;
      nodes++;
      expect(l.kind[node], p.name).toBe(LaneNode.port);
      const at = l.cell[node]!;
      const zone = z.zoneOf[at]!;
      expect(zone, `the water of ${p.name}`).toBeGreaterThan(0);
      expect(l.adj[node]!.length, p.name).toBe(1);
      const e = l.edges[l.adj[node]![0]!]!;
      expect([e.a, e.b], p.name).toEqual([zone - 1, node]);
      expect(e.cells[0], p.name).toBe(z.seedCell[zone]);
      expect(e.cells[e.cells.length - 1], p.name).toBe(at);
      expect(e.km, p.name).toBeGreaterThanOrEqual(0);
      for (const c of e.cells) expect(z.zoneOf[c], `${p.name}: cell ${c}`).toBe(zone);
      if (Number.isNaN(p.waterX)) {
        let dx = Math.abs((at % w) - (p.cell % w));
        if (dx > w - dx) dx = w - dx;
        expect(Math.max(dx, Math.abs(Math.floor(at / w) - Math.floor(p.cell / w))), `${p.name}: its water`).toBeLessThanOrEqual(world.portReach);
      }
    });
    // The ports are the last nodes, in their order.
    expect(l.kind.filter((k) => k === LaneNode.port).length).toBe(nodes);
    expect([...l.portNode].filter((n) => n >= 0)).toEqual(Array.from({ length: nodes }, (_, k) => l.kind.length - nodes + k));
    // Counted 2026-10-09: 615 ports, 579 with a node, 557 on the seas.
    expect(nodes).toBeGreaterThanOrEqual(500);
    expect(nodes).toBeLessThanOrEqual(700);
    // Built again it is the same.
    const again = buildLaneGraph(g, z, world.seaPassages, ports, world.portReach);
    expect(again.portNode).toEqual(l.portNode);
    expect(again.cell).toEqual(l.cell);
    expect(again.edges).toEqual(l.edges);
  });

  it('every province with a port is joined to the lanes: from the seas a ship reaches it, but on a lake or the Caspian', () => {
    const provinces = new Map<number, boolean>();
    const off = new Set<string>();
    const noProvince: string[] = [];
    ports.forEach((p, i) => {
      const node = l.portNode[i]!;
      if (node < 0) return;
      const province = world.cells.province[p.cell]!;
      if (province === 0) {
        noProvince.push(p.name);
        return;
      }
      if (seas[node]) expect(laneRoute(l, l.portNode[byName('Gibraltar')]!, node), p.name).not.toBeNull();
      else off.add(zoneName(world, z, z.zoneOf[l.cell[node]!]!));
      provinces.set(province, (provinces.get(province) ?? false) || seas[node] === 1);
    });
    // '' is a zone with no name: a lake.
    expect([...off].sort()).toEqual(['', 'Caspian Sea']);
    // Held land the province raster gives to no province: 43 ports stand in such a cell
    // (counted 2026-10-09, New York and Sydney among them; a line under PLAN 4.4). No more may.
    expect(noProvince.length).toBeLessThanOrEqual(43);
    expect(provinces.size).toBeGreaterThanOrEqual(400);
    expect([...provinces.values()].filter(Boolean).length).toBeGreaterThanOrEqual(380);
  });

  it('the ports by hand: each is placed in its nation\'s land, in a cell of its own, with a node; every naval base is on the seas', () => {
    const rows = ports.filter((p) => p.def >= 0);
    expect(rows.length).toBe(PORTS_1938.ports.length);
    expect(new Set(rows.map((p) => p.cell)).size).toBe(rows.length);
    for (const d of PORTS_1938.ports) expect(d.nation, d.name).toBeDefined();
    ports.forEach((p, i) => {
      if (p.def < 0) return;
      const d = PORTS_1938.ports[p.def]!;
      expect(TAGS_1938[world.cells.owner[p.cell]! - 1], p.name).toBe(d.nation);
      expect(l.portNode[i], `${p.name} has its water`).toBeGreaterThanOrEqual(0);
      expect(seas[l.portNode[i]!], `${p.name} is on the seas`).toBe(1);
      expect(p.navalBase).toBe(d.navalBase);
    });
    expect(ports.filter((p) => p.navalBase > 0).length).toBe(PORTS_1938.ports.filter((d) => d.navalBase > 0).length);
    expect(ports.filter((p) => p.navalBase > 0).length).toBeGreaterThanOrEqual(80);
    // One by hand in a city port's cell takes its place and keeps the city: Pearl Harbor is Honolulu's.
    const pearl = ports[byName('Pearl Harbor')]!;
    expect(pearl.city).toBeGreaterThanOrEqual(0);
    expect(ports.filter((p) => p.cell === pearl.cell).length).toBe(1);
    expect([pearl.port, pearl.navalBase]).toEqual([2, 3]);
  });

  it('a port is on its own side of the land, and a river port on the sea at its river\'s mouth', () => {
    expect(waterOf('Balboa')).toBe('Golfo de Panamá');
    expect(waterOf('Suez')).toBe('Red Sea');
    expect(waterOf('Sevastopol')).toBe('Black Sea');
    expect(waterOf('Kure')).toBe('Inner Sea');
    expect(waterOf('Baku')).toBe('Caspian Sea');
    expect(waterOf('London')).toBe('English Channel');
    expect(waterOf('Calcutta')).toBe('Bay of Bengal');
    // London's water is further than a city's may be: it is given by hand.
    const london = ports[byName('London')]!;
    const at = l.cell[l.portNode[byName('London')]!]!;
    expect(Math.abs((at % w) - (london.cell % w))).toBeGreaterThan(world.portReach);
    // A lake under 10,000 km² has no zone: Geneva is a port with no node.
    expect(l.portNode[byName('Geneva')]).toBe(-1);
    // From Norfolk to San Diego a fleet goes by Panama: about 9,000 km, where the straight line is 3,700.
    const r = laneRoute(l, l.portNode[byName('Norfolk')]!, l.portNode[byName('San Diego')]!)!;
    expect(r.edges.map((e) => l.edges[e]!.passage)).toContain(world.seaPassages.findIndex((p) => p.id === 'panama'));
    expect(r.km).toBeGreaterThan(7000);
    expect(r.km).toBeLessThan(12000);
  });

  it('every nation with a coast on the seas has a port there', () => {
    const has = new Set<number>();
    ports.forEach((p, i) => {
      if (l.portNode[i]! >= 0 && seas[l.portNode[i]!]) has.add(world.cells.owner[p.cell]!);
    });
    const nb = [-1, 1, -w, w];
    const without = new Set<string>();
    for (let c = w; c < world.cells.owner.length - w; c++) {
      const o = world.cells.owner[c]!;
      if (o === 0 || has.has(o)) continue;
      if (nb.some((d) => z.zoneOf[c + d] !== 0 && seas[z.zoneOf[c + d]! - 1] === 1)) without.add(TAGS_1938[o - 1]!);
    }
    // Switzerland has no coast: a commune of Liechtenstein smaller than a cell was placed in
    // the Po delta (found 2026-10-09, a line under PLAN 7.4). With that mended this is [].
    expect([...without]).toEqual(['SWI']);
  });

  it('the random world has the same ports, whoever holds them; the toy world has none', () => {
    const random = createRandomWorld(7, 60, assets1938(w));
    expect(random.ports.length).toBeGreaterThanOrEqual(500);
    expect(random.ports.filter((p) => p.navalBase > 0).length).toBeGreaterThanOrEqual(80);
    expect(random.portReach).toBe(PORTS_1938.reachCells);
    const toy = createToyWorld(7);
    expect(toy.ports).toEqual([]);
    expect(laneOf(toy).portNode.length).toBe(0);
  });
});

describe('port placement on a made map (PLAN 4.1c)', () => {
  // Land with a sea of 10 × 10 cells at (10..19, 10..19) and a pond of one cell at (40, 15).
  const w = 64;
  const h = 32;
  const terrain = new Uint8Array(w * h).fill(Terrain.Plains);
  for (let y = 10; y < 20; y++) for (let x = 10; x < 20; x++) terrain[y * w + x] = Terrain.Water;
  terrain[15 * w + 40] = Terrain.Water;
  const owner = new Uint16Array(w * h);
  for (let c = 0; c < w * h; c++) owner[c] = isLand(terrain[c]!) ? (c % w < 32 ? 1 : 2) : 0;
  const city = (name: string, x: number, y: number, size: number): PlacedCity => ({ def: 0, name, x: x + 0.5, y: y + 0.5, cell: y * w + x, size, owner: owner[y * w + x]!, capitalOf: 0 });
  const rules: PortRules = { minCitySize: 3, reachCells: 2, levelBySize: [1, 2], ports: [] };
  const cities = [
    city('Shore', 20, 15, 3),
    city('Small', 20, 12, 2),
    city('Near', 21, 17, 5),
    city('Far', 23, 13, 5),
    city('Pond', 41, 15, 4),
    city('Second', 20, 15, 5),
  ];

  it('a city of the size with water in reach is a port, of the level of its size; one cell has one port', () => {
    const { ports, unplaced } = placePorts(rules, cities, ['AAA', 'BBB'], owner, terrain, w, h);
    expect(unplaced).toEqual([]);
    expect(ports.map((p) => [p.name, p.port, p.navalBase, p.city])).toEqual([
      ['Shore', 1, 0, 0],
      ['Near', 2, 0, 2],
      ['Pond', 2, 0, 4],
    ]);
    expect(ports.every((p) => Number.isNaN(p.waterX) && p.def === -1)).toBe(true);
  });

  it('a port by hand takes its nation\'s land and a city port\'s place; one with no such land in reach is left out', () => {
    const hand: PortRules = {
      ...rules,
      ports: [
        { name: 'Base', lonLat: lonLatOf(20, 15, w, h), navalBase: 3 },
        { name: 'Theirs', lonLat: lonLatOf(31, 5, w, h), nation: 'BBB', navalBase: 1 },
        { name: 'Nowhere', lonLat: lonLatOf(5, 5, w, h), nation: 'BBB', navalBase: 1 },
        { name: 'River', lonLat: lonLatOf(26, 15, w, h), water: lonLatOf(19, 15, w, h), port: 2, navalBase: 0 },
        { name: 'Unknown', lonLat: lonLatOf(5, 25, w, h), nation: 'CCC', navalBase: 1 },
      ],
    };
    const { ports, unplaced } = placePorts(hand, cities, ['AAA', 'BBB'], owner, terrain, w, h);
    expect(unplaced).toEqual([2, 4]);
    expect(ports.map((p) => [p.name, p.cell % w, Math.floor(p.cell / w), p.port, p.navalBase, p.def, p.city])).toEqual([
      ['Base', 20, 15, 1, 3, 0, 0],
      ['Near', 21, 17, 2, 0, -1, 2],
      ['Pond', 41, 15, 2, 0, -1, 4],
      ['Theirs', 32, 5, 1, 1, 1, -1],
      ['River', 26, 15, 2, 0, 3, -1],
    ]);
    // With the nations not read (a world of other nations), each takes the land where it stands.
    const open = placePorts(hand, cities, ['AAA', 'BBB'], owner, terrain, w, h, false);
    expect(open.unplaced).toEqual([]);
    expect(open.ports.find((p) => p.name === 'Theirs')!.cell).toBe(5 * w + 31);

    // The lanes: the sea is a zone and the pond another (a cell is 390,000 km² here). A port
    // with no water in reach has no node, nor has one whose cell was made sea.
    const g = makeNavGrid(terrain, w, h, false);
    const seeds = [{ name: 'Sea', part: 0, lonLat: lonLatOf(15, 15, w, h) }];
    const z = buildSeaZones(g, seeds);
    expect(z.count).toBe(2);
    const l = buildLaneGraph(g, z, [], ports, hand.reachCells);
    expect([...l.portNode]).toEqual([2, 3, 4, -1, 5]);
    expect([...l.kind]).toEqual([LaneNode.zone, LaneNode.zone, LaneNode.port, LaneNode.port, LaneNode.port, LaneNode.port]);
    // Base: the water beside it; Near: the nearest of the sea to it; Pond: its pond; River: the water given.
    expect([...l.cell].slice(2)).toEqual([15 * w + 19, 17 * w + 19, 15 * w + 40, 15 * w + 19]);
    const e = l.edges[l.adj[2]![0]!]!;
    expect([e.a, e.b]).toEqual([0, 2]);
    expect([...e.cells]).toEqual([15, 16, 17, 18, 19].map((x) => 15 * w + x));
    expect(e.km).toBeCloseTo(4 * g.kx[15]!, 6);
    expect(e.crossing).toBe(false);
    expect(laneRoute(l, 2, 3)!.nodes).toEqual([2, 0, 3]);
    // The pond's port is on the pond alone: its edge has no length, and no ship comes to it from the sea.
    expect(l.edges[l.adj[4]![0]!]!.km).toBe(0);
    expect(laneRoute(l, 2, 4)).toBeNull();
    // With a reach of one cell Near has no water.
    expect([...buildLaneGraph(g, z, [], ports, 1).portNode]).toEqual([2, -1, 3, -1, 4]);
    const sunk = terrain.slice();
    sunk[15 * w + 20] = Terrain.Water;
    const g2 = makeNavGrid(sunk, w, h, false);
    const l2 = buildLaneGraph(g2, buildSeaZones(g2, seeds), [], ports, hand.reachCells);
    expect(l2.portNode[0]).toBe(-1);
    expect(l2.portNode[1]).toBeGreaterThan(0);
  });
});
