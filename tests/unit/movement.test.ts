import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { Terrain } from '../../src/shared/terrain';
import { slotGrid, slotPose } from '../../src/sim/core/pose';
import { cellOf } from '../../src/sim/data/terrain';
import { boundKm, findPath, makeNavGrid, MIN_COST, Mobility, MOVE_COST, octileKm, stepKm, type MobilityId } from '../../src/sim/nav/grid';
import { findRoute } from '../../src/sim/nav/provinceGraph';
import { SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { MARCH_DUTY } from '../../src/sim/systems/movement';
import { equipFormation } from '../../src/sim/systems/elements';
import { navOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 1.11: land movement over the coarse province graph + cell A*, with mobility × terrain
// costs. AT: a route across the Alps is slower than one across the plains; a formation never
// enters water except on a crossing.

const sim = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(SIZE_1938.w) });
const W = SIZE_1938.w;
const H = SIZE_1938.h;
const nav = navOf(sim.world);
const cell = (lon: number, lat: number): number => {
  const [x, y] = cellOf(lon, lat, W, H);
  return Math.floor(y) * W + Math.floor(x);
};
/** Route hours per straight-line km for a mobility class (×speed cancels: compare costs). */
const costPerKm = (m: MobilityId, a: number, b: number): number => findRoute(nav.grid, nav.graph, m, a, b)!.cost / boundKm(nav.grid, a, b);
const INF = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');
const PZ = TEMPLATES_LAND.findIndex((t) => t.id === 'panzer_div');

function spawn(world: World, nation: string, template: number, lon: number, lat: number): number {
  const f = world.formations;
  const id = f.create();
  const [x, y] = cellOf(lon, lat, W, H);
  f.cols.nation[id] = nationId(nation);
  f.cols.template[id] = template;
  f.cols.x[id] = Math.floor(x) + 0.5;
  f.cols.y[id] = Math.floor(y) + 0.5;
  f.cols.strength[id] = 10_000;
  return id;
}

/** Steps until the formation arrives (or maxHours); returns hours and every cell it stood on. */
function march(s: Sim, id: number, maxHours: number): { hours: number; cells: number[]; arrived: boolean } {
  const cells: number[] = [];
  let arrived = false;
  let hours = 0;
  while (!arrived && hours < maxHours) {
    s.step(1, (w) => {
      const ev = w.out.events;
      for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.FormationArrived && ev[i + 2] === id) arrived = true;
      ev.length = 0;
    });
    hours++;
    const f = s.world.formations.cols;
    cells.push(Math.floor(f.y[id]!) * W + Math.floor(f.x[id]!));
  }
  return { hours, cells, arrived };
}

describe('land movement (PLAN 1.11)', () => {
  it('crossing the Alps costs more per km than crossing the plains, most of all for tracked units', () => {
    const alpsFoot = costPerKm(Mobility.foot, cell(11.58, 48.14), cell(9.19, 45.46)); // Munich → Milan
    const plainsFoot = costPerKm(Mobility.foot, cell(21.0, 52.23), cell(16.92, 52.41)); // Warsaw → Poznań
    expect(alpsFoot).toBeGreaterThan(plainsFoot * 1.3);
    const alpsTracked = costPerKm(Mobility.tracked, cell(11.58, 48.14), cell(9.19, 45.46));
    const plainsTracked = costPerKm(Mobility.tracked, cell(21.0, 52.23), cell(16.92, 52.41));
    expect(alpsTracked / plainsTracked).toBeGreaterThan(alpsFoot / plainsFoot);
  });

  it('a marching formation never stands on water; it reaches Zealand over the Danish belts', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const id = spawn(s.world, 'DEN', INF, 9.4, 56.2); // central Jutland
    s.command({ kind: 'moveFormation', id, x: cellOf(12.2, 55.5, W, H)[0], y: cellOf(12.2, 55.5, W, H)[1] }); // Zealand
    const r = march(s, id, 24 * 30);
    expect(r.arrived).toBe(true);
    expect(r.cells.every((c) => s.world.cells.terrain[c] !== Terrain.Water)).toBe(true);
    expect(r.cells.some((c) => s.world.cells.terrain[c] === Terrain.Crossing)).toBe(true);
  });

  it('there is no land route to Britain (no Dover crossing): the order is rejected', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const id = spawn(s.world, 'FRA', INF, 2.35, 48.86);
    const [tx, ty] = cellOf(-0.13, 51.51, W, H);
    s.command({ kind: 'moveFormation', id, x: tx, y: ty });
    let rejected = false;
    s.step(1, (w) => {
      for (let i = 0; i < w.out.events.length; i += 6) if (w.out.events[i + 1] === EventKind.MoveRejected) rejected = true;
    });
    expect(rejected).toBe(true);
    expect(s.world.formations.cols.moving[id]).toBe(0);
  });

  it('infantry marches ~30 km a day on the plains; armour is faster', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    s.world.settings.aiEnabled = false; // isolate the mechanism from the AI (PLAN 1.24–1.26)
    const inf = spawn(s.world, 'POL', INF, 21.0, 52.23);
    const pz = spawn(s.world, 'POL', PZ, 21.0, 52.0);
    const [tx, ty] = cellOf(16.92, 52.41, W, H);
    s.command({ kind: 'moveFormation', id: inf, x: tx, y: ty });
    s.command({ kind: 'moveFormation', id: pz, x: tx, y: ty });
    const km = boundKm(navOf(s.world).grid, cell(21.0, 52.23), cell(16.92, 52.41));
    const r = march(s, inf, 24 * 40);
    expect(r.arrived).toBe(true);
    const kmPerDay = km / (r.hours / 24);
    expect(kmPerDay).toBeGreaterThan(18);
    expect(kmPerDay).toBeLessThan(4 * 24 * MARCH_DUTY + 1);
    expect(s.world.formations.cols.moving[pz]).toBe(0); // the panzer division arrived first
  });

  it('a march is deterministic across save/load (paths are rebuilt from origin and target)', () => {
    const run = (split: boolean): number => {
      const s = new Sim({ scenario: '1938', seed: 5, assets: assets1938(W) });
      const id = spawn(s.world, 'GER', INF, 13.4, 52.5);
      const [tx, ty] = cellOf(10.0, 48.8, W, H);
      s.command({ kind: 'moveFormation', id, x: tx, y: ty });
      s.step(100);
      if (!split) {
        s.step(150);
        return s.hash();
      }
      const t = new Sim({ scenario: '1938', seed: 9, assets: assets1938(W) });
      t.load(s.save());
      t.step(150);
      return t.hash();
    };
    expect(run(true)).toBe(run(false));
  });

  it('the coarse graph links Sicily to Italy by the Messina crossing and keeps Britain apart', () => {
    const g = nav.graph;
    const reach = (from: number): Set<number> => {
      const seen = new Set([from]);
      const q = [from];
      while (q.length) {
        for (const n of g.adj[q.pop()!]!) {
          if (seen.has(n)) continue;
          seen.add(n);
          q.push(n);
        }
      }
      return seen;
    };
    const sicily = g.nodeOf[cell(14.0, 37.5)]!;
    const rome = g.nodeOf[cell(12.5, 41.9)]!;
    const london = g.nodeOf[cell(-0.13, 51.51)]!;
    const fromRome = reach(rome);
    expect(fromRome.has(sicily)).toBe(true);
    expect(fromRome.has(london)).toBe(false);
  });
});

describe('slotted poses', () => {
  it('lay elements out in a block centred on the formation, front row first, rotated with facing', () => {
    expect(slotGrid(24)).toEqual({ cols: 7, rows: 4 });
    const pts = Array.from({ length: 24 }, (_, i) => slotPose(10, 20, 0, i, 24, 0.1));
    const mean = pts.reduce((a, p) => [a[0] + p[0] / 24, a[1] + p[1] / 24], [0, 0]);
    expect(mean[0]).toBeCloseTo(10, 1); // centred within a fraction of a slot
    expect(pts[0]![0]).toBeGreaterThan(10); // facing east: the front row is east of the centre
    const east = slotPose(0, 0, 0, 3, 24, 1);
    const south = slotPose(0, 0, Math.PI / 2, 3, 24, 1);
    expect(Math.hypot(...east)).toBeCloseTo(Math.hypot(...south), 9);
    expect(slotPose(0, 0, 1.234, 5, 24, 1)).toEqual(slotPose(0, 0, 1.234, 5, 24, 1));
  });
});

describe('route edge cases', () => {
  it('cell A* is the same search as a plain open list popped by (f, insertion order) (PLAN 1.42a)', () => {
    const GW = 24;
    const GH = 16;
    let seed = 12345;
    const rand = (): number => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32;
    const kinds = [Terrain.Water, Terrain.Plains, Terrain.Plains, Terrain.Forest, Terrain.Mountains];
    const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
    for (let trial = 0; trial < 20; trial++) {
      const terrain = Uint8Array.from({ length: GW * GH }, () => kinds[Math.floor(rand() * kinds.length)]!);
      const g = makeNavGrid(terrain, GW, GH, trial % 2 === 0);
      const cost = MOVE_COST[Mobility.foot]!;
      const land = [...terrain.keys()].filter((c) => terrain[c] !== Terrain.Water);
      const start = land[Math.floor(rand() * land.length)]!;
      // The search of PLAN 1.11, written plainly: the heap and the inlined arithmetic of the real
      // one must not change which route wins a tie.
      const reference = (goal: number): { cells: number[]; cost: number } | null => {
        const gs = new Map<number, number>([[start, 0]]);
        const came = new Map<number, number>();
        const closed = new Set<number>();
        const open = [{ key: octileKm(g, start, goal) * MIN_COST[Mobility.foot]!, seq: 0, cell: start }];
        let seq = 1;
        while (open.length > 0) {
          let bi = 0;
          for (let i = 1; i < open.length; i++) if (open[i]!.key < open[bi]!.key || (open[i]!.key === open[bi]!.key && open[i]!.seq < open[bi]!.seq)) bi = i;
          const c = open.splice(bi, 1)[0]!.cell;
          if (c === goal) break;
          if (closed.has(c)) continue;
          closed.add(c);
          const cx = c % GW;
          const cy = (c - cx) / GW;
          for (const [dx, dy] of STEPS) {
            const ny = cy + dy;
            let nx = cx + dx;
            if (ny < 0 || ny >= GH) continue;
            if (nx < 0 || nx >= GW) {
              if (!g.wrapX) continue;
              nx = (nx + GW) % GW;
            }
            const n = ny * GW + nx;
            if (closed.has(n) || terrain[n] === Terrain.Water) continue;
            if (dx !== 0 && dy !== 0 && (terrain[cy * GW + nx] === Terrain.Water || terrain[ny * GW + cx] === Terrain.Water)) continue;
            const t = gs.get(c)! + stepKm(g, dy > 0 ? cy : ny, dx, dy) * cost[terrain[n]!]!;
            if (!gs.has(n) || t < gs.get(n)!) {
              gs.set(n, t);
              came.set(n, c);
              open.push({ key: t + octileKm(g, n, goal) * MIN_COST[Mobility.foot]!, seq: seq++, cell: n });
            }
          }
        }
        if (!gs.has(goal)) return null;
        const cells = [goal];
        for (let c = goal; c !== start; ) cells.push((c = came.get(c)!));
        return { cells: cells.reverse(), cost: gs.get(goal)! };
      };
      let routes = 0;
      for (const goal of land) {
        const want = reference(goal);
        expect(findPath(g, Mobility.foot, start, goal)).toEqual(want);
        if (want) routes++;
      }
      expect(routes).toBeGreaterThan(1);
    }
  });

  it('the octile bound is never below the straight-line bound and is the walk on one row (ADR-56)', () => {
    let seed = 99;
    const rand = (): number => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32;
    for (const [GW, GH, wrap] of [[24, 16, true], [64, 32, false], [2048, 1024, true]] as const) {
      const g = makeNavGrid(new Uint8Array(GW * GH).fill(Terrain.Plains), GW, GH, wrap);
      for (let i = 0; i < 2000; i++) {
        const a = Math.floor(rand() * GW * GH);
        const b = Math.floor(rand() * GW * GH);
        expect(octileKm(g, a, b)).toBeGreaterThanOrEqual(boundKm(g, a, b) * (1 - 1e-12));
      }
      // Along one row the walk is straight steps; on a diagonal from a row towards the equator's
      // side it is diagonal steps at the smaller endpoint scales.
      const row = Math.floor(GH / 4);
      const c = row * GW + 2;
      expect(octileKm(g, c, c + 5)).toBeCloseTo(5 * stepKm(g, row, 1, 0), 9);
      const kx = Math.min(g.kx[row]!, g.kx[row + 3]!);
      const ky = Math.min(g.ky[row]!, g.ky[row + 3]!);
      expect(octileKm(g, c, c + 3 * GW + 3)).toBeCloseTo(3 * Math.hypot(kx, ky), 9);
    }
  });

  it('unreachable pairs are rejected at once; a coastal speck target snaps to reachable land', () => {
    const g = nav.grid;
    const lisbon = cell(-9.0, 39.0);
    const vladivostok = cell(131.9, 43.1);
    const t0 = performance.now();
    expect(findRoute(g, nav.graph, Mobility.foot, lisbon, cell(-0.13, 51.51))).toBeNull();
    expect(performance.now() - t0).toBeLessThan(5); // component check, no search
    expect(g.component[vladivostok]).not.toBe(g.component[lisbon]); // isolated at M resolution

    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const id = spawn(s.world, 'SOV', INF, 132.0, 44.0);
    const [tx, ty] = cellOf(131.9, 43.1, W, H);
    s.command({ kind: 'moveFormation', id, x: tx, y: ty });
    s.step(1);
    expect(s.world.formations.cols.moving[id]).toBe(1);
    const target = s.world.formations.cols.targetCell[id]!;
    expect(g.component[target]).toBe(g.component[s.world.formations.cols.originCell[id]!]);
  });

  it('repatriation: an idle formation on land of a nation it is not at war with marches home', () => {
    const s = new Sim({ scenario: '1938', seed: 3, assets: assets1938(W) });
    const w = s.world;
    w.settings.aiEnabled = false;
    const GER = nationId('GER');
    const id = spawn(w, 'GER', INF, 21.0, 52.23); // Warsaw, at peace with Poland
    equipFormation(w, id, INF);
    const f = w.formations.cols;
    const at = (): number => Math.floor(f.y[id]!) * W + Math.floor(f.x[id]!);
    expect(w.cells.controller[at()]).toBe(nationId('POL'));
    s.step(1); // 00:00: the daily check orders it home
    expect(f.moving[id]).toBe(1);
    const r = march(s, id, 24 * 30);
    expect(r.arrived).toBe(true);
    expect(w.cells.controller[at()]).toBe(GER);
    // At home it stays.
    s.step(48);
    expect(f.moving[id]).toBe(0);
  });
});
