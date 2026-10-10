import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { maskLand } from '../../src/shared/landMask';
import { encodeRuns } from '../../src/shared/mapImport';
import { isLand, Terrain } from '../../src/shared/terrain';
import { unproject } from '../../src/sim/data/projection';
import { brushCells } from '../../src/sim/editor';
import { makeNavGrid, type NavGrid } from '../../src/sim/nav/grid';
import { buildLaneGraph, greatCircleKm } from '../../src/sim/nav/lanes';
import { sailRoute, sailStepKm, seaNeighbours, seaWalk, type SailRoute } from '../../src/sim/nav/sailRoute';
import { buildSeaZones, type SeaZones } from '../../src/sim/nav/seaZones';
import { PORTS_1938, RULES_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { elementIndex } from '../../src/sim/systems/elements';
import { CRUISE_SHARE, sailKmh } from '../../src/sim/systems/sail';
import { laneOf, navOf, seaOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId, runEvents } from '../helpers/sim1938';

// PLAN 4.2c: a fleet sails along the lanes. AT: Gibraltar → Suez takes the route's km over the
// pace; no place of it on land of the fine mask but in a passage; the route's km against
// great-circle legs is counted, and the way straightened if it is far over.

const { w: W, h: H } = SIZE_1938;
const sim = (seed = 99): Sim => new Sim({ scenario: '1938', seed, assets: assets1938(W) });
const lonLat = (c: number, w = W, h = H): [number, number] => unproject(((c % w) + 0.5) / w, (Math.floor(c / w) + 0.5) / h);
const cellAt = (w: World, id: number): number => Math.floor(w.formations.cols.y[id]!) * W + Math.floor(w.formations.cols.x[id]!);
const move = (s: Sim, id: number, cell: number): boolean => s.command({ kind: 'moveFormation', id, x: (cell % W) + 0.5, y: Math.floor(cell / W) + 0.5 });

/** The water of a port of the 1938 list, by its name. */
function portWater(w: World, name: string): number {
  const lanes = laneOf(w);
  const i = w.ports.findIndex((p) => p.def >= 0 && PORTS_1938.ports[p.def]!.name === name);
  expect(lanes.portNode[i], name).toBeGreaterThanOrEqual(0);
  return lanes.cell[lanes.portNode[i]!]!;
}

/** The fleet of `tag` that stands in `cell`. */
function fleetIn(w: World, tag: string, cell: number): number {
  let found = 0;
  w.formations.forEach((id) => {
    if (w.afloat(id) && w.formations.cols.nation[id] === nationId(tag) && cellAt(w, id) === cell) found = id;
  });
  expect(found, `a fleet of ${tag} in cell ${cell}`).toBeGreaterThan(0);
  return found;
}

/** What holds of any fleet's way: zoned water, step by step with no corner of land cut, `jumps` passages; its km and its turns. */
function checkRoute(g: NavGrid, z: SeaZones, r: SailRoute, from: number, to: number, jumps: number, what: string): void {
  const { w } = g;
  expect(r.cells[0], what).toBe(from);
  expect(r.cells[r.cells.length - 1], what).toBe(to);
  let km = 0;
  let seen = 0;
  for (let k = 0; k < r.cells.length; k++) {
    const c = r.cells[k]!;
    expect(z.zoneOf[c], `${what}: cell ${c} has no zone`).toBeGreaterThan(0);
    expect(isLand(g.terrain[c]!), `${what}: cell ${c} is land`).toBe(false);
    if (k === 0) continue;
    const p = r.cells[k - 1]!;
    km += sailStepKm(g, p, c);
    if (!seaNeighbours(g, p, c)) {
      seen++;
      continue;
    }
    const px = p % w;
    const cx = c % w;
    const py = (p - px) / w;
    const cy = (c - cx) / w;
    if (px !== cx && py !== cy) expect(isLand(g.terrain[py * w + cx]!) || isLand(g.terrain[cy * w + px]!), `${what}: ${p} to ${c} cuts a corner of land`).toBe(false);
  }
  expect(seen, `${what}: its passages`).toBe(jumps);
  expect(r.km, what).toBeCloseTo(km, 6);
  // The turns are cells of the way, in its order, its ends among them.
  let at = 0;
  for (const t of r.turns) {
    at = r.cells.indexOf(t, at);
    expect(at, `${what}: turn ${t}`).toBeGreaterThanOrEqual(0);
  }
  expect([r.turns[0], r.turns[r.turns.length - 1]], what).toEqual([from, to]);
}

/** The great circles between the turns of a way, km. */
const legsKm = (r: SailRoute, w = W, h = H): number => r.turns.reduce((s, t, i) => (i === 0 ? 0 : s + greatCircleKm(lonLat(r.turns[i - 1]!, w, h), lonLat(t, w, h))), 0);

describe('sailRoute on a small sea', () => {
  // 64 × 32, all water but a wall of land in column 20 from the top down to row 19, and the
  // cell (40, 16): one zone (water no seed reaches is given its own).
  const w = 64;
  const h = 32;
  const make = (wrapX: boolean): { g: NavGrid; z: SeaZones } => {
    const terrain = new Uint8Array(w * h).fill(Terrain.Water);
    for (let y = 0; y < 20; y++) terrain[y * w + 20] = Terrain.Plains;
    terrain[16 * w + 40] = Terrain.Plains;
    const g = makeNavGrid(terrain, w, h, wrapX);
    return { g, z: buildSeaZones(g, []) };
  };
  const cell = (x: number, y: number): number => y * w + x;

  it('the straight walk: clear over open water, not over land, and not past a corner of it', () => {
    const { g, z } = make(false);
    const out: number[] = [];
    expect(seaWalk(g, z, cell(30, 10), cell(34, 12), out)).toBe(true);
    expect(out).toEqual([cell(31, 10), cell(32, 11), cell(33, 11), cell(34, 12)]);
    expect(seaWalk(g, z, cell(10, 10), cell(30, 10))).toBe(false);
    expect(seaWalk(g, z, cell(38, 16), cell(42, 16))).toBe(false);
    // Diagonally past the island: the step from (39, 15) to (40, 14)... has it beside it at (40, 15)? No: (40, 16) is the land.
    expect(seaWalk(g, z, cell(39, 17), cell(41, 15))).toBe(false); // through (40, 16)
    expect(seaWalk(g, z, cell(39, 16), cell(40, 17))).toBe(false); // (40, 16) beside the step
    expect(seaWalk(g, z, cell(39, 15), cell(40, 14))).toBe(true);
    // To itself: no step.
    expect(seaWalk(g, z, cell(5, 5), cell(5, 5))).toBe(true);
  });

  it('round the wall: over water, by the wall’s end, and straight where the water is open', () => {
    const { g, z } = make(false);
    const lanes = buildLaneGraph(g, z, []);
    for (const [from, to] of [[cell(10, 5), cell(30, 5)], [cell(30, 5), cell(10, 5)], [cell(2, 2), cell(60, 30)], [cell(19, 0), cell(21, 0)]] as const) {
      const r = sailRoute(g, z, lanes, from, to)!;
      const what = `${from} to ${to}`;
      checkRoute(g, z, r, from, to, 0, what);
      expect(r.km, what).toBeLessThanOrEqual(r.laneKm + 1e-9);
    }
    // Clear of the wall and along the equator's rows it is one straight walk: two turns, its
    // ends, and as many steps as the longer of its two sides.
    const open = sailRoute(g, z, lanes, cell(24, 17), cell(30, 21))!;
    expect(open.turns).toEqual([cell(24, 17), cell(30, 21)]);
    expect(open.cells.length).toBe(7);
    expect(open.laneKm).toBeGreaterThan(open.km);
    // The way from one side of the wall to the other passes below its end, row 19.
    const r = sailRoute(g, z, lanes, cell(19, 0), cell(21, 0))!;
    expect(Math.max(...[...r.cells].map((c) => Math.floor(c / w)))).toBe(20);
    // To the cell it stands in: one cell and no km.
    const here = sailRoute(g, z, lanes, cell(7, 7), cell(7, 7))!;
    expect([[...here.cells], here.km]).toEqual([[cell(7, 7)], 0]);
    // Land has no way.
    expect(sailRoute(g, z, lanes, cell(20, 3), cell(7, 7))).toBeNull();
    expect(sailRoute(g, z, lanes, cell(7, 7), cell(20, 3))).toBeNull();
  });

  it('on a map that loops the straight walk goes over the seam', () => {
    const { g, z } = make(true);
    const out: number[] = [];
    expect(seaWalk(g, z, cell(62, 25), cell(1, 25), out)).toBe(true);
    expect(out).toEqual([cell(63, 25), cell(0, 25), cell(1, 25)]);
    expect(seaNeighbours(g, cell(63, 4), cell(0, 5))).toBe(true);
    expect(sailStepKm(g, cell(63, 4), cell(0, 5))).toBeCloseTo(Math.hypot(g.kx[4]!, g.ky[4]!), 9);
    const edged = make(false);
    expect(seaNeighbours(edged.g, cell(63, 4), cell(0, 5))).toBe(false);
  });
});

describe('a fleet sails (PLAN 4.2c)', () => {
  it('Gibraltar to Suez: the route’s km over the pace, through the canal, and no hour of it on land but in the canal', () => {
    const s = sim();
    const w = s.world;
    const fc = w.formations.cols;
    const g = navOf(w).grid;
    const z = seaOf(w);
    const lanes = laneOf(w);
    const from = portWater(w, 'Gibraltar');
    const fleet = fleetIn(w, 'ENG', from);
    // The canal's end in the Gulf of Suez: the further south of its edge's two.
    const suez = lanes.edges.find((e) => e.passage === w.seaPassages.findIndex((p) => p.id === 'suez'))!;
    const ends = [suez.cells[suez.landAt - 1]!, suez.cells[suez.landAt]!].sort((a, b) => a - b);
    const to = ends[1]!;
    const ships = elementIndex(w).get(fleet)!.length;

    expect(move(s, fleet, to)).toBe(true);
    s.applyNow();
    expect(fc.moving[fleet]).toBe(1);
    expect(fc.targetCell[fleet]).toBe(to);
    const r = sailRoute(g, z, lanes, from, to)!;
    expect([...w.paths.get(fleet)!]).toEqual([...r.cells]);
    checkRoute(g, z, r, from, to, 1, 'Gibraltar to Suez');
    const jump = r.cells.findIndex((c, k) => k > 0 && !seaNeighbours(g, r.cells[k - 1]!, c));
    expect([r.cells[jump - 1], r.cells[jump]]).toEqual(ends);
    // The canal is one step, of the km between its two ends' cells: the passage's own, to the cells its ends were set in.
    const passage = w.seaPassages[suez.passage]!;
    const canalKm = sailStepKm(g, ends[0]!, ends[1]!);
    expect(greatCircleKm(passage.a, passage.b)).toBeGreaterThan(150);
    expect(Math.abs(canalKm - greatCircleKm(passage.a, passage.b))).toBeLessThan(2 * g.kd[Math.floor(ends[0]! / W)]!);

    // The length: by the zones' middles it is far over the legs between the turns (ADR-250: more
    // than a tenth is far), drawn tight it is within a tenth (the steps are of 8 ways).
    const legs = legsKm(r);
    expect(r.laneKm / legs).toBeGreaterThan(1.1);
    expect(r.km / legs).toBeLessThan(1.1);
    // About 3,600 km by sea to Port Said and 160 of canal; ours stands off the shores by cells.
    expect(r.km).toBeGreaterThan(3600);
    expect(r.km).toBeLessThan(4300);

    // The pace: the slowest ship's top speed × the cruising share.
    const rule = RULES_1938.templates[fc.template[fleet]!]!;
    const kmh = sailKmh(w, fleet);
    expect(kmh).toBeCloseTo(rule.speedKmh * CRUISE_SHARE, 9);
    const hours = r.km / kmh;

    let arrived = -1;
    let inCanal = 0;
    let onLand = 0;
    let last: [number, number] = [fc.x[fleet]!, fc.y[fleet]!];
    let furthest = 0;
    for (let hour = 1; hour <= Math.ceil(hours) + 48 && arrived < 0; hour++) {
      for (const e of runEvents(s, 1)) if (e[1] === EventKind.FormationArrived && e[2] === fleet) arrived = hour;
      const path = w.paths.get(fleet);
      const i = fc.pathStep[fleet]!;
      const canal = path !== undefined && i < path.length - 1 && !seaNeighbours(g, path[i]!, path[i + 1]!);
      if (canal) inCanal++;
      else if (maskLand(w.landMask!, W, H, fc.x[fleet]!, fc.y[fleet]!, w.settings.loopingMap)) onLand++;
      // An hour's sail on the map: never further than the pace allows (but over the canal, whose ends are cells apart).
      if (!canal) furthest = Math.max(furthest, Math.hypot(fc.x[fleet]! - last[0], fc.y[fleet]! - last[1]) * g.kx[Math.floor(fc.y[fleet]!)]!);
      last = [fc.x[fleet]!, fc.y[fleet]!];
    }
    expect(arrived, 'the hour of its arrival').toBe(Math.ceil(hours - 1e-9));
    expect(onLand, 'hours on land of the fine mask').toBe(0);
    expect(inCanal).toBeGreaterThanOrEqual(Math.floor(sailStepKm(g, ends[0]!, ends[1]!) / kmh));
    expect(inCanal).toBeLessThanOrEqual(Math.ceil(sailStepKm(g, ends[0]!, ends[1]!) / kmh) + 1);
    // At its place, standing, whole.
    expect([fc.x[fleet], fc.y[fleet]]).toEqual(w.seaPoint(to));
    expect(fc.moving[fleet]).toBe(0);
    expect(w.paths.has(fleet)).toBe(false);
    expect(elementIndex(w).get(fleet)!.length).toBe(ships);
    expect([fc.supply[fleet], fc.org[fleet], fc.engaged[fleet]]).toEqual([1, 1, 0]);
    process.stderr.write(
      `Gibraltar to Suez: ${r.cells.length} cells, ${r.turns.length} turns; by the zones' seeds ${r.laneKm.toFixed(0)} km, drawn tight ${r.km.toFixed(0)} km, great-circle legs ${legs.toFixed(0)} km (× ${(r.laneKm / legs).toFixed(3)} and × ${(r.km / legs).toFixed(3)}); ${kmh.toFixed(2)} km/h, ${hours.toFixed(1)} h, arrived in hour ${arrived}, ${inCanal} h in the canal of ${canalKm.toFixed(0)} km, the longest hour ${furthest.toFixed(1)} km on the map\n`,
    );
  });

  it('ways between the bases of the world: all over water, drawn tight, and counted against the fine mask', () => {
    const w = sim().world;
    const g = navOf(w).grid;
    const z = seaOf(w);
    const lanes = laneOf(w);
    const names = ['Scapa Flow', 'Gibraltar', 'Alexandria', 'Singapore', 'Pearl Harbor', 'Yokosuka', 'Kiel', 'Kronstadt', 'Portsmouth', 'Plymouth'];
    let samples = 0;
    let land = 0;
    let worst = 0;
    let worstWay = '';
    let lane = 0;
    const far: string[] = [];
    let ms = 0;
    let count = 0;
    for (const a of names) {
      for (const b of names) {
        if (a === b) continue;
        const what = `${a} to ${b}`;
        const from = portWater(w, a);
        const to = portWater(w, b);
        const t = performance.now();
        const r = sailRoute(g, z, lanes, from, to)!;
        ms += performance.now() - t;
        count++;
        expect(r, what).not.toBeNull();
        const jumps = [...r.cells].filter((c, k) => k > 0 && !seaNeighbours(g, r.cells[k - 1]!, c)).length;
        checkRoute(g, z, r, from, to, jumps, what);
        expect(r.km, what).toBeLessThanOrEqual(r.laneKm + 1e-9);
        // Against the great circles between its turns: counted, not held (a straight walk on
        // the map is no great circle: over an ocean in the north it is the longer by far).
        const over = r.km / legsKm(r);
        if (over > 1.1) far.push(`${what} × ${over.toFixed(3)}`);
        if (over > worst) worstWay = what;
        worst = Math.max(worst, over);
        lane = Math.max(lane, r.laneKm / legsKm(r));
        // Eight places of each step, on the line between its two cells' water points.
        for (let k = 1; k < r.cells.length; k++) {
          if (!seaNeighbours(g, r.cells[k - 1]!, r.cells[k]!)) continue;
          const p = w.seaPoint(r.cells[k - 1]!)!;
          const q = w.seaPoint(r.cells[k]!)!;
          if (q[0] - p[0] > W / 2) q[0] -= W;
          else if (p[0] - q[0] > W / 2) q[0] += W;
          for (let i = 0; i < 8; i++) {
            samples++;
            const x = p[0] + ((q[0] - p[0]) * i) / 8;
            if (maskLand(w.landMask!, W, H, x < 0 ? x + W : x >= W ? x - W : x, p[1] + ((q[1] - p[1]) * i) / 8, true)) land++;
          }
        }
      }
    }
    // A step between two water points can clip a shore of the fine mask (PLAN 4.7): few do.
    expect(land / samples).toBeLessThan(0.002);
    process.stderr.write(`${count} ways between ${names.length} bases: ${land} of ${samples} places on land of the fine mask, the longest × ${worst.toFixed(3)} its great-circle legs, ${worstWay} (by the zones' seeds × ${lane.toFixed(3)}), over a tenth: ${far.join(', ') || 'none'}; ${(ms / count).toFixed(2)} ms a way\n`);
  });

  it('an order to a port goes to its water; to land that is no port, and to a lake with no zone, it is rejected and the fleet stands', () => {
    const s = sim();
    const w = s.world;
    const fc = w.formations.cols;
    const z = seaOf(w);
    const fleet = fleetIn(w, 'ENG', portWater(w, 'Gibraltar'));
    const at = [fc.x[fleet], fc.y[fleet]];
    const rejected = (cell: number): boolean => {
      move(s, fleet, cell);
      let no = false;
      s.applyNow((world) => {
        for (let i = 0; i < world.out.events.length; i += 6) if (world.out.events[i + 1] === EventKind.MoveRejected && world.out.events[i + 2] === fleet) no = true;
        world.out.events.length = 0;
      });
      return no;
    };
    // Inland Spain; and water with no zone (a lake under the size of a zone).
    const madrid = Math.floor(fc.y[fleet]! - 12) * W + Math.floor(fc.x[fleet]! + 8);
    expect(isLand(w.cells.terrain[madrid]!)).toBe(true);
    expect(w.ports.some((p) => p.cell === madrid)).toBe(false);
    expect(rejected(madrid)).toBe(true);
    let lake = -1;
    for (let c = 0; c < W * H && lake < 0; c++) if (w.cells.terrain[c] === Terrain.Water && z.zoneOf[c] === 0) lake = c;
    expect(lake).toBeGreaterThanOrEqual(0);
    expect(rejected(lake)).toBe(true);
    // The Caspian has zones and no lane to the sea.
    let caspian = -1;
    const [cx, cy] = [Math.floor(((50.5 + 180) / 360) * W), 0];
    for (let y = 0; y < H && caspian < 0; y++) {
      const c = y * W + cx;
      const [, lat] = lonLat(c);
      if (lat < 43 && lat > 40 && z.zoneOf[c] !== 0) caspian = c;
    }
    void cy;
    expect(caspian).toBeGreaterThanOrEqual(0);
    expect(rejected(caspian)).toBe(true);
    expect([fc.x[fleet], fc.y[fleet], fc.moving[fleet]]).toEqual([...at, 0]);
    expect(w.paths.has(fleet)).toBe(false);
    // Its own base, by its land cell: the water it stands in. It is there in the hour.
    const base = w.ports.find((p) => p.def >= 0 && PORTS_1938.ports[p.def]!.name === 'Gibraltar')!;
    expect(rejected(base.cell)).toBe(false);
    expect(runEvents(s, 1).some((e) => e[1] === EventKind.FormationArrived && e[2] === fleet)).toBe(true);
    expect([fc.x[fleet], fc.y[fleet], fc.moving[fleet]]).toEqual([...at, 0]);
    // Alexandria, by its land cell: to its water.
    const alex = w.ports.find((p) => p.def >= 0 && PORTS_1938.ports[p.def]!.name === 'Alexandria')!;
    expect(isLand(w.cells.terrain[alex.cell]!)).toBe(true);
    expect(rejected(alex.cell)).toBe(false);
    expect(fc.moving[fleet]).toBe(1);
    expect(fc.targetCell[fleet]).toBe(portWater(w, 'Alexandria'));
    // A division is not sent to sea by the fleets' order: a march to water is rejected as before.
    const division = addDivision(w, nationId('ENG'), w.cellPoint(alex.cell)[0], w.cellPoint(alex.cell)[1]);
    s.command({ kind: 'moveFormation', id: division, x: (portWater(w, 'Gibraltar') % W) + 0.5, y: Math.floor(portWater(w, 'Gibraltar') / W) + 0.5 });
    s.applyNow();
    expect(fc.moving[division]).toBe(0);
  });

  it('the fleet in a crossing cell sails: Denmark’s from Copenhagen to Kiel’s water', () => {
    const s = sim();
    const w = s.world;
    const fc = w.formations.cols;
    const from = portWater(w, 'Copenhagen');
    expect(w.cells.terrain[from]).toBe(Terrain.Crossing);
    const fleet = fleetIn(w, 'DEN', from);
    const to = portWater(w, 'Kiel');
    expect(move(s, fleet, to)).toBe(true);
    let arrived = false;
    for (let hour = 0; hour < 24 * 5 && !arrived; hour++) {
      for (const e of runEvents(s, 1)) if (e[1] === EventKind.FormationArrived && e[2] === fleet) arrived = true;
      expect(isLand(w.cells.terrain[cellAt(w, fleet)]!), `hour ${hour}`).toBe(false);
    }
    expect(arrived).toBe(true);
    expect(cellAt(w, fleet)).toBe(to);
    // No division marched with it, and no land formation was moved by the sail.
    expect(fc.moving[fleet]).toBe(0);
  });

  it('a save in the middle of a sail: loaded, the fleet sails on as it would have', () => {
    const s = sim();
    const fleet = fleetIn(s.world, 'ENG', portWater(s.world, 'Gibraltar'));
    move(s, fleet, portWater(s.world, 'Alexandria'));
    s.step(30);
    const fc = s.world.formations.cols;
    expect(fc.moving[fleet]).toBe(1);
    expect(fc.stepFrac[fleet]).toBeGreaterThan(0);
    const bytes = s.save();
    const t = sim(7);
    t.load(bytes);
    expect(Buffer.from(t.save()).equals(Buffer.from(bytes))).toBe(true);
    expect([...t.world.paths.get(fleet)!]).toEqual([...s.world.paths.get(fleet)!]);
    s.step(60);
    t.step(60);
    expect(t.hash()).toBe(s.hash());
    expect([t.world.formations.cols.x[fleet], t.world.formations.cols.y[fleet]]).toEqual([fc.x[fleet], fc.y[fleet]]);
    // The hash reads where it is: a fleet that did not sail leaves another world.
    const still = sim();
    still.step(90);
    expect(still.hash()).not.toBe(s.hash());
  });

  it('a new order in the middle of a step leaves the fleet where it is, and it sails from there', () => {
    const s = sim();
    const w = s.world;
    const fc = w.formations.cols;
    const home = portWater(w, 'Gibraltar');
    const fleet = fleetIn(w, 'ENG', home);
    move(s, fleet, portWater(w, 'Alexandria'));
    s.step(30);
    expect(fc.stepFrac[fleet]).toBeGreaterThan(0);
    const at = [fc.x[fleet]!, fc.y[fleet]!];
    const step = [w.paths.get(fleet)![fc.pathStep[fleet]!]!, w.paths.get(fleet)![fc.pathStep[fleet]! + 1]!];
    // Back to Gibraltar.
    move(s, fleet, home);
    s.applyNow();
    expect([fc.x[fleet], fc.y[fleet]]).toEqual(at);
    expect(fc.targetCell[fleet]).toBe(home);
    const path = w.paths.get(fleet)!;
    expect(step).toContain(path[0]);
    expect(step).toContain(path[1]);
    let km = 0;
    for (let k = 1; k < path.length; k++) km += sailStepKm(navOf(w).grid, path[k - 1]!, path[k]!);
    const kmh = sailKmh(w, fleet);
    let arrived = -1;
    for (let hour = 1; hour <= 40 && arrived < 0; hour++) {
      const before = [fc.x[fleet]!, fc.y[fleet]!];
      for (const e of runEvents(s, 1)) if (e[1] === EventKind.FormationArrived && e[2] === fleet) arrived = hour;
      // No leap: an hour's way is an hour's (a cell at this latitude is about 16 km; the pace 32 km/h).
      expect(Math.hypot(fc.x[fleet]! - before[0]!, fc.y[fleet]! - before[1]!), `hour ${hour}`).toBeLessThan(3);
    }
    // Thirty hours out, and as long back at most (the step it was in is walked back, or on).
    expect(arrived).toBeGreaterThanOrEqual(29);
    expect(arrived).toBeLessThanOrEqual(Math.ceil(km / kmh) + 1);
    expect(cellAt(w, fleet)).toBe(home);
  });

  it('water made land ahead of a fleet: it stops before it and goes round', () => {
    const s = sim();
    const w = s.world;
    const fc = w.formations.cols;
    const fleet = fleetIn(w, 'ENG', portWater(w, 'Gibraltar'));
    const to = portWater(w, 'Alexandria');
    move(s, fleet, to);
    s.step(20);
    const path = w.paths.get(fleet)!;
    const ahead = path[fc.pathStep[fleet]! + 4]!;
    // An island of five cells across on its way, four cells ahead (a map import: no brush makes water land).
    const values = Uint16Array.from(w.cells.terrain);
    for (const c of brushCells(W, H, (ahead % W) + 0.5, Math.floor(ahead / W) + 0.5, 2, true)) values[c] = Terrain.Plains;
    s.command({ kind: 'importLayer', layer: 'terrain', runs: encodeRuns(values) });
    s.applyNow();
    expect(isLand(w.cells.terrain[ahead]!)).toBe(true);
    expect(w.formations.has(fleet)).toBe(true);
    let arrived = false;
    for (let hour = 0; hour < 24 * 8 && !arrived; hour++) {
      for (const e of runEvents(s, 1)) if (e[1] === EventKind.FormationArrived && e[2] === fleet) arrived = true;
      expect(isLand(w.cells.terrain[cellAt(w, fleet)]!), `hour ${hour}: in a land cell`).toBe(false);
    }
    expect(arrived).toBe(true);
    expect(cellAt(w, fleet)).toBe(to);
  });
});
