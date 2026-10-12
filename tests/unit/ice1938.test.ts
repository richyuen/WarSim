import { describe, expect, it } from 'vitest';
import iceJson from '../../data/maps/earth/ice.json';
import mapJson from '../../data/maps/earth/map.json';
import passagesJson from '../../data/maps/earth/passages.json';
import seasJson from '../../data/maps/earth/seas.json';
import { EventKind } from '../../src/shared/events';
import { Terrain } from '../../src/shared/terrain';
import { unproject } from '../../src/sim/data/projection';
import { validateDataSet } from '../../src/sim/data/schemas';
import { makeNavGrid } from '../../src/sim/nav/grid';
import { buildLaneGraph } from '../../src/sim/nav/lanes';
import { sailRoute, seaNeighbours, seaWalk } from '../../src/sim/nav/sailRoute';
import { buildSeaZones } from '../../src/sim/nav/seaZones';
import { PORTS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { laneOf, navOf, seaOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 4.2d: the seas that ice closes (data/maps/earth/ice.json) are in no fleet's way and take
// no order. AT: Scapa Flow → Pearl Harbor goes by Panama.

const { w: W, h: H } = SIZE_1938;
const sim = (seed = 99): Sim => new Sim({ scenario: '1938', seed, assets: assets1938(W) });
const lat = (c: number): number => unproject(((c % W) + 0.5) / W, (Math.floor(c / W) + 0.5) / H)[1];
const ICE = new Set(iceJson.closed);

/** The water of a port of the 1938 list, by its name. */
function portWater(w: World, name: string): number {
  const lanes = laneOf(w);
  const i = w.ports.findIndex((p) => p.def >= 0 && PORTS_1938.ports[p.def]!.name === name);
  expect(lanes.portNode[i], name).toBeGreaterThanOrEqual(0);
  return lanes.cell[lanes.portNode[i]!]!;
}

/** The name of the sea of zone `zone`, or '' for one no named sea has. */
const seaName = (w: World, zone: number): string => {
  const i = seaOf(w).seed[zone]!;
  return i >= 0 ? w.seaSeeds[i]!.name : '';
};

describe('ice closes seas to a fleet (PLAN 4.2d)', () => {
  it('the AT: Scapa Flow to Pearl Harbor goes by Panama, and by no zone ice closes', () => {
    const w = sim().world;
    const g = navOf(w).grid;
    const z = seaOf(w);
    const lanes = laneOf(w);
    const r = sailRoute(g, z, lanes, portWater(w, 'Scapa Flow'), portWater(w, 'Pearl Harbor'))!;
    expect(r).not.toBeNull();
    // One passage taken, the Panama canal's: the step that is no neighbours' is its edge's jump.
    const panama = passagesJson.passages.findIndex((p) => p.id === 'panama');
    const edge = lanes.edges.find((e) => e.passage === panama)!;
    const jumps: [number, number][] = [];
    for (let k = 1; k < r.cells.length; k++) if (!seaNeighbours(g, r.cells[k - 1]!, r.cells[k]!)) jumps.push([r.cells[k - 1]!, r.cells[k]!]);
    const ends = [edge.cells[edge.landAt - 1]!, edge.cells[edge.landAt]!];
    expect(jumps).toHaveLength(1);
    expect([...jumps[0]!].sort((a, b) => a - b)).toEqual(ends.sort((a, b) => a - b));
    for (const c of r.cells) expect(z.closed[z.zoneOf[c]!], `cell ${c} (${seaName(w, z.zoneOf[c]!)})`).toBe(0);
    // Far south of the Arctic: the way's furthest north is the Inner Seas off Scotland.
    expect(Math.max(...[...r.cells].map(lat))).toBeLessThan(62);
    // Before the ice it went north of Siberia, 15,974 km (ADR-244).
    expect(r.km).toBeGreaterThan(15_974);
    process.stderr.write(`Scapa Flow to Pearl Harbor: ${r.km.toFixed(0)} km (by the zones' seeds ${r.laneKm.toFixed(0)}), ${r.cells.length} cells, furthest north ${Math.max(...[...r.cells].map(lat)).toFixed(1)}°\n`);
  });

  it('the zones of the seas in ice.json are closed, and only those; the lanes have no edge to one', () => {
    const w = sim().world;
    const z = seaOf(w);
    const lanes = laneOf(w);
    const closed: string[] = [];
    for (let zone = 1; zone <= z.count; zone++) {
      expect(z.closed[zone], `zone ${zone} (${seaName(w, zone)})`).toBe(ICE.has(seaName(w, zone)) ? 1 : 0);
      if (z.closed[zone]) closed.push(seaName(w, zone));
    }
    // Every sea of the file has a zone, so a name in it is never in vain.
    expect(new Set(closed)).toEqual(ICE);
    expect(z.closed[0]).toBe(0);
    for (const e of lanes.edges) {
      for (const node of [e.a, e.b]) if (node < lanes.zones) expect(z.closed[node + 1], `edge ${e.a}-${e.b}`).toBe(0);
      // An edge's cells are of its two zones: none in the ice.
      for (const c of e.cells) expect(z.closed[z.zoneOf[c]!]).toBe(0);
    }
    process.stderr.write(`${closed.length} zones closed by ice, of ${z.count}; ${lanes.edges.length} edges\n`);
  });

  it('no way between the bases of the world, Murmansk and Vladivostok with them, enters the ice; every way there was is there', () => {
    const w = sim().world;
    const g = navOf(w).grid;
    const z = seaOf(w);
    const lanes = laneOf(w);
    const names = ['Scapa Flow', 'Gibraltar', 'Singapore', 'Pearl Harbor', 'Yokosuka', 'Kiel', 'Kronstadt', 'Murmansk', 'Vladivostok', 'San Diego', 'Norfolk', 'Sydney'];
    let north = -90;
    for (const a of names) {
      for (const b of names) {
        if (a === b) continue;
        const r = sailRoute(g, z, lanes, portWater(w, a), portWater(w, b));
        expect(r, `${a} to ${b}`).not.toBeNull();
        for (const c of r!.cells) expect(z.closed[z.zoneOf[c]!], `${a} to ${b}: cell ${c}`).toBe(0);
        if (a !== 'Murmansk' && b !== 'Murmansk') north = Math.max(north, ...[...r!.cells].map(lat));
      }
    }
    // Murmansk aside, no way goes into the Arctic Circle: from Kiel to Yokosuka is by Suez.
    expect(north).toBeLessThan(66.6);
  });

  it('every fleet of the 1938 start stands in water open to it, and has a way to Gibraltar', () => {
    const w = sim().world;
    const g = navOf(w).grid;
    const z = seaOf(w);
    const lanes = laneOf(w);
    const fc = w.formations.cols;
    const gib = portWater(w, 'Gibraltar');
    let fleets = 0;
    const lost: string[] = [];
    w.formations.forEach((id) => {
      if (!w.afloat(id)) return;
      fleets++;
      const cell = Math.floor(fc.y[id]!) * W + Math.floor(fc.x[id]!);
      expect(z.closed[z.zoneOf[cell]!], `fleet ${id}`).toBe(0);
      // The Caspian's flotillas have no lane to the sea, ice or none.
      if (sailRoute(g, z, lanes, cell, gib) === null) lost.push(seaName(w, z.zoneOf[cell]!));
    });
    expect(fleets).toBe(197);
    expect(new Set(lost)).toEqual(new Set(lost.length ? ['Caspian Sea'] : []));
  });

  it('an order to water in the ice, or to a port on it, is rejected, and the fleet stands', () => {
    const s = sim();
    const w = s.world;
    const fc = w.formations.cols;
    const z = seaOf(w);
    const lanes = laneOf(w);
    const gib = portWater(w, 'Gibraltar');
    let fleet = 0;
    w.formations.forEach((id) => {
      if (fleet === 0 && w.afloat(id) && Math.floor(fc.y[id]!) * W + Math.floor(fc.x[id]!) === gib) fleet = id;
    });
    expect(fleet).toBeGreaterThan(0);
    const at = [fc.x[fleet], fc.y[fleet]];
    const rejected = (cell: number): boolean => {
      s.command({ kind: 'moveFormation', id: fleet, x: (cell % W) + 0.5, y: Math.floor(cell / W) + 0.5 });
      let no = false;
      s.applyNow((world) => {
        for (let i = 0; i < world.out.events.length; i += 6) if (world.out.events[i + 1] === EventKind.MoveRejected && world.out.events[i + 2] === fleet) no = true;
        world.out.events.length = 0;
      });
      return no;
    };
    // The Laptev Sea's seed; and a port whose water is in the ice, by its land cell.
    const laptev = z.seedCell[[...z.seed].findIndex((i, zone) => zone > 0 && i >= 0 && w.seaSeeds[i]!.name === 'Laptev Sea')]!;
    expect(z.closed[z.zoneOf[laptev]!]).toBe(1);
    expect(rejected(laptev)).toBe(true);
    const iced = w.ports.findIndex((_, i) => lanes.portNode[i]! >= 0 && z.closed[z.zoneOf[lanes.cell[lanes.portNode[i]!]!]!] === 1);
    expect(iced).toBeGreaterThanOrEqual(0);
    expect(rejected(w.ports[iced]!.cell)).toBe(true);
    expect([fc.x[fleet], fc.y[fleet], fc.moving[fleet]]).toEqual([...at, 0]);
    expect(w.paths.has(fleet)).toBe(false);
    // The Barents Sea is open: Murmansk takes the order.
    const murmansk = w.ports.find((p) => p.def >= 0 && PORTS_1938.ports[p.def]!.name === 'Murmansk')!;
    expect(rejected(murmansk.cell)).toBe(false);
    expect(fc.moving[fleet]).toBe(1);
  });
});

describe('ice on a small sea', () => {
  // 64 × 32, all water: a seed "Open" at the west, "Ice" in the middle, "Far" at the east. With
  // "Ice" closed, the way from west to east goes round the ice's zone by the rows of the others.
  const w = 64;
  const h = 32;
  const cell = (x: number, y: number): number => y * w + x;
  const at = (x: number, y: number): [number, number] => {
    // The [lon, lat] of a cell's middle on this grid.
    return unproject((x + 0.5) / w, (y + 0.5) / h);
  };
  const make = (ice: string[]) => {
    const terrain = new Uint8Array(w * h).fill(Terrain.Water);
    const g = makeNavGrid(terrain, w, h, false);
    const z = buildSeaZones(g, [
      { name: 'Open', part: 0, lonLat: at(8, 16) },
      { name: 'Ice', part: 0, lonLat: at(32, 16) },
      { name: 'Far', part: 0, lonLat: at(56, 16) },
    ], new Set(ice));
    return { g, z, lanes: buildLaneGraph(g, z, []) };
  };

  it('a closed zone is in no way and no straight walk; with none closed the way goes through it', () => {
    const open = make([]);
    const through = sailRoute(open.g, open.z, open.lanes, cell(8, 16), cell(56, 16))!;
    expect([...through.cells].some((c) => open.z.zoneOf[c] === 2)).toBe(true);

    const { g, z, lanes } = make(['Ice']);
    expect([...z.closed]).toEqual([0, 0, 1, 0]);
    expect(lanes.edges.some((e) => e.a === 1 || e.b === 1)).toBe(false);
    // Open and Far touch only by Ice: no way, and no straight walk over it.
    expect(sailRoute(g, z, lanes, cell(8, 16), cell(56, 16))).toBeNull();
    expect(seaWalk(g, z, cell(8, 16), cell(56, 16))).toBe(false);
    // In the ice, from or to: none; within an open zone: as before.
    expect(sailRoute(g, z, lanes, cell(32, 16), cell(32, 18))).toBeNull();
    expect(sailRoute(g, z, lanes, cell(8, 16), cell(32, 16))).toBeNull();
    expect(sailRoute(g, z, lanes, cell(2, 2), cell(10, 30))).not.toBeNull();
    // A name that is no sea of the seeds closes nothing.
    expect([...make(['Nowhere']).z.closed]).toEqual([0, 0, 0, 0]);
  });
});

describe('ice.json', () => {
  const files = (closed: string[]): Record<string, unknown> => ({ 'maps/earth/map.json': mapJson, 'maps/earth/seas.json': seasJson, 'maps/earth/ice.json': { closed } });
  const iceErrors = (closed: string[]): string[] => validateDataSet(files(closed)).filter((e) => e.startsWith('maps/earth/ice.json'));

  it('names seas of seas.json, each once; the data set refuses another', () => {
    expect(iceErrors(iceJson.closed)).toEqual([]);
    expect(iceErrors(['Kara Sea', 'Sea of Ice', 'Kara Sea'])).toEqual([
      "maps/earth/ice.json: closed[1]: 'Sea of Ice' is no sea of maps/earth/seas.json",
      "maps/earth/ice.json: closed[2]: 'Kara Sea' twice",
    ]);
    expect(validateDataSet({ 'maps/earth/map.json': mapJson, 'maps/earth/ice.json': { closed: [] } })).toContain('maps/earth/ice.json: no seas.json next to this file');
  });
});
