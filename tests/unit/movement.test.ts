import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { Terrain } from '../../src/shared/terrain';
import { slotGrid, slotPose } from '../../src/sim/core/pose';
import { cellOf } from '../../src/sim/data/terrain';
import { boundKm, boundWeight, findPath, makeNavGrid, MIN_COST, Mobility, MOVE_COST, octileKm, stepKm, type MobilityId } from '../../src/sim/nav/grid';
import { findRoute } from '../../src/sim/nav/provinceGraph';
import { SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { foreignTo, MARCH_DUTY } from '../../src/sim/systems/movement';
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

  // PLAN 2.16Rk: a freed id goes to the next formation made. A player's order names its nation,
  // and an order for an id that is another nation's by now moves nothing.
  it('an order that names a nation moves a formation of that nation only', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    s.world.settings.aiEnabled = false;
    const pol = spawn(s.world, 'POL', INF, 21.0, 52.23);
    s.command({ kind: 'removeFormation', id: pol });
    s.step(1);
    const ger = spawn(s.world, 'GER', INF, 13.4, 52.5);
    expect(ger, 'the freed id is given to the German division').toBe(pol);
    const [tx, ty] = cellOf(10.0, 48.8, W, H);
    const c = s.world.formations.cols;
    s.command({ kind: 'moveFormation', id: ger, x: tx, y: ty, nation: nationId('POL') });
    s.step(1);
    expect(c.moving[ger], 'ordered in the name of Poland').toBe(0);
    s.command({ kind: 'moveFormation', id: ger + 1000, x: tx, y: ty, nation: nationId('GER') });
    s.step(1); // an id that no formation has: nothing, as before
    s.command({ kind: 'moveFormation', id: ger, x: tx, y: ty, nation: nationId('GER') });
    s.step(1);
    expect(c.moving[ger], 'ordered in the name of Germany').toBe(1);
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

  it('a march is deterministic across save/load (paths are saved: PLAN 3.4Rl)', () => {
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

  it('a long search has its bound scaled up, and a short one is the same to the cell (PLAN 3.10c2d1b, ADR-195)', () => {
    expect([1, 120, 121, 300, 301, 2000].map(boundWeight)).toEqual([1, 1, 1.5, 1.5, 2, 2]);
    // Ground in patches of 8 by 8 cells, a third of them dearer than the cheapest: the bound is
    // short of the way's cost, as on the map, and an unscaled search fills an ellipse.
    const GW = 512;
    const GH = 256;
    let seed = 4242;
    const rand = (): number => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32;
    const kinds = [Terrain.Plains, Terrain.Plains, Terrain.Plains, Terrain.Plains, Terrain.Forest, Terrain.Mountains];
    const patch = Uint8Array.from({ length: (GW / 8) * (GH / 8) }, () => kinds[Math.floor(rand() * kinds.length)]!);
    const terrain = Uint8Array.from({ length: GW * GH }, (_, c) => patch[Math.floor(Math.floor(c / GW) / 8) * (GW / 8) + Math.floor((c % GW) / 8)]!);
    const g = makeNavGrid(terrain, GW, GH, false);
    const at = (x: number): number => (GH / 2) * GW + x;
    const run = (cells: number, weight?: number): { cells: number[]; cost: number; closed: number } => {
      const way = findPath(g, Mobility.foot, at(40), at(40 + cells), undefined, undefined, weight)!;
      const mark = 2 * g.scratch!.gen + 1;
      let closed = 0;
      for (const s of g.scratch!.stamp) if (s === mark) closed++;
      return { ...way, closed };
    };
    // Short: the search of before, to the cell and to the count of closed cells.
    for (const cells of [60, 120]) expect(run(cells), `${cells} cells`).toEqual(run(cells, 1));
    // Over 120 cells and over 300: the rule's weight, fewer cells closed by the stated share, and
    // a way that costs no more than the weight times the best.
    for (const [cells, weight, share] of [[200, 1.5, 1 / 2], [420, 2, 1 / 3]] as const) {
      const best = run(cells, 1);
      const got = run(cells);
      expect(got, `${cells} cells`).toEqual(run(cells, weight));
      expect(got.closed, `${cells} cells: closed, of ${best.closed}`).toBeLessThan(best.closed * share);
      expect(got.cost).toBeGreaterThanOrEqual(best.cost);
      expect(got.cost, `${cells} cells: cost, of ${best.cost}`).toBeLessThanOrEqual(best.cost * weight);
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

// PLAN 3.4Rl (ADR-149). A route asked the ground and not its holder: France, at war with
// Portugal, marched through Nationalist Spain and fought and starved there. In seed 99's first
// year 550,194 formation-hours were on the ground of a nation outside the formation's wars, nine
// tenths of all the hours with no supply.
describe('no march across a nation that is not in the war (PLAN 3.4Rl)', () => {
  /** A 1938 world at peace, the AI off, with one war. */
  function world(a: string, d: string): Sim {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    s.world.settings.aiEnabled = false;
    for (const war of [...s.world.wars.list]) s.world.wars.end(war);
    s.world.wars.start([nationId(a)], [nationId(d)], 0);
    return s;
  }
  /** Steps an hour; whether `kind` was emitted for the formation. */
  function hour(s: Sim, id: number, kind: number): boolean {
    let seen = false;
    s.step(1, (w) => {
      const ev = w.out.events;
      for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === kind && ev[i + 2] === id) seen = true;
      ev.length = 0;
    });
    return seen;
  }
  const order = (s: Sim, id: number, lon: number, lat: number): void => {
    const [x, y] = cellOf(lon, lat, W, H);
    s.command({ kind: 'moveFormation', id, x, y });
  };

  it('the route goes round: Aachen to Lille by the French border, not through the Netherlands and Belgium', () => {
    const s = world('GER', 'FRA');
    const w = s.world;
    const GER = nationId('GER');
    const through = findRoute(nav.grid, nav.graph, Mobility.foot, cell(6.1, 50.77), cell(3.06, 50.63))!;
    expect(through.cells.some((c) => foreignTo(w, GER, w.cells.controller[c]!)), 'the premise: the short way crosses a nation that is in no war').toBe(true);
    const id = spawn(w, 'GER', INF, 6.1, 50.77);
    order(s, id, 3.06, 50.63);
    s.step(1);
    expect(w.formations.cols.moving[id]).toBe(1);
    const path = [...w.paths.get(id)!];
    expect(path[path.length - 1]).toBe(cell(3.06, 50.63));
    expect(path.length).toBeGreaterThan(through.cells.length);
    expect(path.filter((c) => foreignTo(w, GER, w.cells.controller[c]!))).toEqual([]);
    // And it is walked: two weeks of it, on German ground and up to the French.
    const stood = new Set<number>();
    for (let h = 0; h < 24 * 14; h++) {
      s.step(1);
      stood.add(Math.floor(w.formations.cols.y[id]!) * W + Math.floor(w.formations.cols.x[id]!));
    }
    expect(stood.size).toBeGreaterThan(5);
    expect([...stood].filter((c) => foreignTo(w, GER, w.cells.controller[c]!))).toEqual([]);
  });

  it('no way round: France, at war with Portugal, is refused the march through Spain', () => {
    const s = world('FRA', 'POR');
    const w = s.world;
    expect(findRoute(nav.grid, nav.graph, Mobility.foot, cell(2.35, 48.86), cell(-8.6, 41.15)), 'the premise: there is a way by land').not.toBeNull();
    const id = spawn(w, 'FRA', INF, 2.35, 48.86);
    order(s, id, -8.6, 41.15);
    expect(hour(s, id, EventKind.MoveRejected)).toBe(true);
    expect(w.formations.cols.moving[id]).toBe(0);
    // With Spain in the war on either side the way is open.
    for (const [side, name] of [[0, 'beside France'], [1, 'against France']] as const) {
      const t = world('FRA', 'POR');
      t.world.wars.list[0]!.sides[side].push(nationId('NSP'));
      t.world.wars.changed();
      const f = spawn(t.world, 'FRA', INF, 2.35, 48.86);
      order(t, f, -8.6, 41.15);
      t.step(1);
      expect(t.world.formations.cols.moving[f], name).toBe(1);
    }
  });

  it('a march ends before ground that has become a third nation\'s since the order', () => {
    const s = world('GER', 'FRA');
    const w = s.world;
    const c = w.formations.cols;
    const id = spawn(w, 'GER', INF, 13.4, 52.5);
    order(s, id, 10.0, 48.8);
    s.step(1);
    const path = [...w.paths.get(id)!];
    expect(path.length).toBeGreaterThan(12);
    w.setController(path[6]!, nationId('POL'));
    let refused = false;
    const stood = new Set<number>();
    for (let h = 0; h < 24 * 20 && !refused; h++) {
      refused = hour(s, id, EventKind.MoveRejected);
      stood.add(Math.floor(c.y[id]!) * W + Math.floor(c.x[id]!));
    }
    expect(refused).toBe(true);
    expect(c.moving[id]).toBe(0);
    expect(w.paths.has(id)).toBe(false);
    expect(Math.floor(c.y[id]!) * W + Math.floor(c.x[id]!)).toBe(path[5]);
    expect(stood.has(path[6]!)).toBe(false);
  });

  // PLAN 3.7l (ADR-172). The march that ended in the middle of a step was set on the middle of
  // the cell behind it: 0.76 and 1.25 cells in the hour, in 400 hours of seed 99.
  /** A German division on the march from Berlin, past the middle of the step from `path[5]` to `path[6]`; `d`: what it walked in the last hour. */
  function midStep(): { s: Sim; id: number; path: number[]; d: number } {
    const s = world('GER', 'FRA');
    const c = s.world.formations.cols;
    const id = spawn(s.world, 'GER', INF, 13.4, 52.5);
    order(s, id, 10.0, 48.8);
    s.step(1);
    const path = [...s.world.paths.get(id)!];
    let d = 0;
    for (let h = 0; h < 24 * 20 && !(c.pathStep[id] === 5 && c.stepFrac[id]! > 0.5); h++) {
      const [x, y] = [c.x[id]!, c.y[id]!];
      s.step(1);
      d = Math.hypot(c.x[id]! - x, c.y[id]! - y);
    }
    expect(c.pathStep[id], 'the premise: in the middle of the sixth step').toBe(5);
    expect(c.stepFrac[id]).toBeGreaterThan(0.5);
    expect(d, 'the premise: a step of several hours').toBeLessThan(0.45);
    return { s, id, path, d };
  }
  /** Hours until the formation is idle; fails on an hour of more than `d`, or one that takes it further from `to`. */
  function walkBack(s: Sim, id: number, to: number, d: number): { hours: number; refused: number } {
    const c = s.world.formations.cols;
    const [tx, ty] = s.world.cellPoint(to);
    let refused = 0;
    let hours = 0;
    for (; hours < 48 && (hours === 0 || c.moving[id] === 1); hours++) {
      const [x, y] = [c.x[id]!, c.y[id]!];
      if (hour(s, id, EventKind.MoveRejected)) refused++;
      expect(Math.hypot(c.x[id]! - x, c.y[id]! - y), `hour ${hours}: no more than an hour's march`).toBeLessThanOrEqual(d + 1e-9);
      expect(Math.hypot(c.x[id]! - tx, c.y[id]! - ty), `hour ${hours}: no further into the step`).toBeLessThanOrEqual(Math.hypot(x - tx, y - ty) + 1e-9);
    }
    return { hours, refused };
  }

  it('a march that ends in the middle of a step, the next cell turned a third nation\'s, walks back to the cell behind it', () => {
    const { s, id, path, d } = midStep();
    const w = s.world;
    const c = w.formations.cols;
    w.setController(path[6]!, nationId('POL'));
    const { hours, refused } = walkBack(s, id, path[5]!, d);
    expect(refused, 'the march is refused once, in the hour the ground turned').toBe(1);
    expect(hours).toBeGreaterThan(1);
    expect(c.moving[id]).toBe(0);
    expect(c.home[id]).toBe(0);
    expect(w.paths.has(id)).toBe(false);
    expect([c.x[id], c.y[id]]).toEqual(w.cellPoint(path[5]!));
    expect(foreignTo(w, nationId('GER'), w.cells.controller[path[5]!]!)).toBe(false);
  });

  it('and so where the cell behind it has turned another third nation\'s in the same hour', () => {
    const { s, id, path, d } = midStep();
    const w = s.world;
    const c = w.formations.cols;
    w.setController(path[5]!, nationId('SWE'));
    w.setController(path[6]!, nationId('POL'));
    expect(foreignTo(w, nationId('GER'), nationId('SWE')), 'the premise: no ground of its own behind it').toBe(true);
    const { refused } = walkBack(s, id, path[5]!, d);
    expect(refused).toBe(1);
    expect(c.moving[id]).toBe(0);
    expect([c.x[id], c.y[id]]).toEqual(w.cellPoint(path[5]!));
  });

  // PLAN 3.7h (ADR-169). Until then this test was "the way home keeps off a second such nation:
  // an Italian division in Germany at peace is moved to its spawn point": 80 formations a year
  // of two seeds were gone from one place and stood in another.
  /** A 1938 world at peace, the AI off, with an Italian division in central Germany: Austria and Switzerland lie between. */
  function farFromHome(): { s: Sim; far: number } {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    s.world.settings.aiEnabled = false;
    for (const war of [...s.world.wars.list]) s.world.wars.end(war);
    const far = spawn(s.world, 'ITA', INF, 10.0, 51.0);
    equipFormation(s.world, far, INF);
    return { s, far };
  }
  const acrossX = (a: number, b: number): number => Math.min(Math.abs(a - b), W - Math.abs(a - b));

  it('the way home crosses a second such nation: an Italian division in Germany at peace marches home through Austria and arrives', () => {
    const { s, far } = farFromHome();
    const w = s.world;
    const c = w.formations.cols;
    const at = (f: number): number => w.cells.controller[Math.floor(c.y[f]!) * W + Math.floor(c.x[f]!)]!;
    const near = spawn(w, 'ITA', INF, 4.83, 45.76); // Lyon: France borders Italy
    expect(at(far)).toBe(nationId('GER'));
    expect(at(near)).toBe(nationId('FRA'));
    const men = c.strength[far]!;
    const stood = new Map<number, Set<number>>([[far, new Set()], [near, new Set()]]);
    let furthest = 0;
    for (let h = 0; h < 24 * 60 && (h === 0 || c.moving[far] === 1 || c.moving[near] === 1); h++) {
      const was = [c.x[far]!, c.y[far]!];
      s.step(1); // the first is 00:00: the daily check
      if (h === 0) expect([c.moving[far], c.home[far], c.moving[near], c.home[near]]).toEqual([1, 1, 1, 1]);
      furthest = Math.max(furthest, Math.hypot(acrossX(c.x[far]!, was[0]!), c.y[far]! - was[1]!));
      for (const f of [far, near]) stood.get(f)!.add(at(f));
    }
    expect(furthest, 'cells in an hour').toBeLessThanOrEqual(1);
    expect([c.moving[far], c.home[far], at(far)]).toEqual([0, 0, nationId('ITA')]);
    expect([c.moving[near], c.home[near], at(near)]).toEqual([0, 0, nationId('ITA')]);
    const third = [...stood.get(far)!].filter((n) => n !== nationId('GER') && n !== nationId('ITA'));
    expect(third.length, 'nations crossed between Germany and Italy').toBeGreaterThan(0);
    expect(third.every((n) => n === nationId('AUT') || n === nationId('SWI'))).toBe(true);
    expect([...stood.get(near)!].sort((a, b) => a - b)).toEqual([nationId('FRA'), nationId('ITA')].sort((a, b) => a - b));
    // Not fed on the way (ADR-143): the march costs men.
    expect(c.strength[far]).toBeLessThan(men);
    expect(c.strength[far]).toBeGreaterThan(men * 0.5);
    // At home it stays.
    s.step(48);
    expect(c.moving[far]).toBe(0);
  });

  it('an order of a player from there is refused as before, and one that is taken ends the march home', () => {
    const { s, far } = farFromHome();
    const c = s.world.formations.cols;
    s.step(2);
    expect([c.moving[far], c.home[far]]).toEqual([1, 1]);
    const target = c.targetCell[far];
    order(s, far, 9.19, 45.46); // Milan
    expect(hour(s, far, EventKind.MoveRejected)).toBe(true);
    expect([c.moving[far], c.home[far], c.targetCell[far]]).toEqual([1, 1, target]);
    order(s, far, 11.0, 50.0); // on in Germany: its holder's ground, which it may walk
    expect(hour(s, far, EventKind.MoveRejected)).toBe(false);
    expect([c.moving[far], c.home[far]]).toEqual([1, 0]);
    expect(c.targetCell[far]).not.toBe(target);
  });

  // Seed 7, formation 897 (French Equatorial Africa's, in Angola): its AI ordered it to a front
  // every day from the middle of a step into the Belgian Congo, the march ended at once before
  // that ground, and the next midnight sent it home again: 23 times, and never home.
  it('the operational AI leaves a formation on its march home alone', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    for (const war of [...w.wars.list]) w.wars.end(war);
    w.wars.start([nationId('ITA')], [nationId('SWI')], 0);
    const c = w.formations.cols;
    const id = spawn(w, 'ITA', INF, 4.83, 45.76); // Lyon: France, and the Swiss front is nearer than home (taken for it at hour 5, before)
    equipFormation(w, id, INF);
    s.step(1);
    expect([c.moving[id], c.home[id]]).toEqual([1, 1]);
    const target = c.targetCell[id]!;
    expect(w.cells.controller[target]).toBe(nationId('ITA'));
    for (let h = 0; h < 24 * 4 && c.moving[id] === 1; h++) {
      s.step(1);
      if (c.moving[id] === 1) expect([c.home[id], c.targetCell[id]], `hour ${h}`).toEqual([1, target]);
    }
  });

  // PLAN 3.12Rk (ADR-222). Until then this test was "a march home waits before a cell that has
  // become an enemy's": it waited there, marked, for as long as the war lasted, and the mark kept
  // the AI off it (seed 77, three years: 112 marches home of 90 days or more).
  it('a march home goes round a cell that has become an enemy\'s, takes no cell, and arrives', () => {
    const { s, far } = farFromHome();
    const w = s.world;
    const c = w.formations.cols;
    w.wars.start([nationId('ITA')], [nationId('POL')], 0);
    s.step(1);
    const path = [...w.paths.get(far)!];
    const held = Uint16Array.from(w.cells.controller);
    held[path[9]!] = nationId('POL');
    w.setController(path[9]!, nationId('POL'));
    const stood = new Set<number>();
    for (let h = 0; h < 24 * 60 && c.moving[far] === 1; h++) {
      s.step(1);
      stood.add(Math.floor(c.y[far]!) * W + Math.floor(c.x[far]!));
      if (c.moving[far] === 1) expect(c.home[far], `hour ${h}: the march home is one still`).toBe(1);
    }
    expect([c.moving[far], c.home[far]]).toEqual([0, 0]);
    expect(w.cells.controller[Math.floor(c.y[far]!) * W + Math.floor(c.x[far]!)]).toBe(nationId('ITA'));
    expect(stood.has(path[8]!), 'the premise: it came to the cell before the enemy\'s').toBe(true);
    expect(stood.has(path[9]!)).toBe(false);
    const changed: number[] = [];
    for (let k = 0; k < held.length; k++) if (w.cells.controller[k] !== held[k]) changed.push(k);
    expect(changed).toEqual([]);
  });

  it('a march home on ground that has become an enemy\'s walks on across it and out', () => {
    const { s, far } = farFromHome();
    const w = s.world;
    const c = w.formations.cols;
    const AUT = nationId('AUT');
    const at = (): number => w.cells.controller[Math.floor(c.y[far]!) * W + Math.floor(c.x[far]!)]!;
    const behind = (): number => w.cells.controller[w.paths.get(far)![c.pathStep[far]!]!]!;
    s.step(1);
    for (let h = 0; h < 24 * 40 && behind() !== AUT; h++) s.step(1);
    expect([c.moving[far], c.home[far], at(), behind()], 'the premise: on its way, in Austria').toEqual([1, 1, AUT, AUT]);
    w.wars.start([nationId('ITA')], [AUT], w.tick);
    const path = [...w.paths.get(far)!];
    const ahead = path.slice(c.pathStep[far]! + 1).filter((k) => w.cells.controller[k] === AUT);
    expect(ahead.length, 'the premise: Austrian cells on the way yet').toBeGreaterThan(1);
    const stood = new Set<number>();
    const entered = new Set<number>();
    for (let h = 0; h < 24 * 30 && c.moving[far] === 1; h++) {
      const [x, y] = [c.x[far]!, c.y[far]!];
      s.step(1);
      const k = Math.floor(c.y[far]!) * W + Math.floor(c.x[far]!);
      if (!stood.has(k) && w.cells.controller[k] === AUT) entered.add(k);
      stood.add(k);
      if (c.moving[far] !== 1) break;
      expect([c.home[far], c.engaged[far]], `hour ${h}: the march home is one still`).toEqual([1, 0]);
      expect([c.x[far], c.y[far]], `hour ${h}: it does not wait`).not.toEqual([x, y]);
    }
    expect(ahead.filter((k) => !stood.has(k)), 'cells of its way that it did not walk').toEqual([]);
    expect(entered.size, 'cells it came into while they were Austrian').toBeGreaterThan(1);
    expect([c.moving[far], c.home[far], at()]).toEqual([0, 0, nationId('ITA')]);
    expect([c.x[far], c.y[far]]).toEqual(w.cellPoint(path[path.length - 1]!));
  });

  it('no way round: the march home ends before the enemy\'s ground, the mark with it, and the formation is not set down elsewhere', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    w.settings.aiEnabled = false;
    for (const war of [...w.wars.list]) w.wars.end(war);
    const c = w.formations.cols;
    const id = spawn(w, 'ITA', INF, -9.14, 38.72); // Lisbon: every way out of Portugal by land is through Spain
    equipFormation(w, id, INF);
    const spain = [nationId('NSP'), nationId('REP')];
    const at = (): number => w.cells.controller[Math.floor(c.y[id]!) * W + Math.floor(c.x[id]!)]!;
    s.step(2);
    expect([c.moving[id], c.home[id], at()]).toEqual([1, 1, nationId('POR')]);
    for (const n of spain) w.wars.start([nationId('ITA')], [n], w.tick);
    let refused = 0;
    let marked = -1;
    const stood = new Set<number>();
    for (let h = 0; h < 24 * 20; h++) {
      if (hour(s, id, EventKind.MoveRejected)) refused++;
      if (c.home[id] !== 0) marked = h;
      stood.add(at());
    }
    expect(refused).toBeGreaterThan(0);
    expect([c.moving[id], c.home[id]]).toEqual([0, 0]);
    expect(w.paths.has(id)).toBe(false);
    expect([...stood]).toEqual([nationId('POR')]);
    // It stands before the Spanish border, in the middle of its cell, and the mark went in the hour it came there.
    const [x, y] = [c.x[id]!, c.y[id]!];
    expect([x, y]).toEqual(w.cellPoint(Math.floor(y) * W + Math.floor(x)));
    const near: number[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) near.push(w.cells.controller[(Math.floor(y) + dy) * W + Math.floor(x) + dx]!);
    expect(near.some((n) => spain.includes(n))).toBe(true);
    expect(marked, 'the last hour it bore the mark').toBeGreaterThan(24);
    expect(marked, 'the last hour it bore the mark').toBeLessThan(24 * 10);
    // The midnights after leave it there: no way home, and it is not set on its spawn point.
    s.step(24 * 3);
    expect([c.x[id], c.y[id], c.moving[id], c.home[id]]).toEqual([x, y, 0, 0]);
    // It is a formation as any other: an order on its holder's ground is taken.
    s.command({ kind: 'moveFormation', id, x: x - 3, y });
    expect(hour(s, id, EventKind.MoveRejected)).toBe(false);
    expect([c.moving[id], c.home[id], at()]).toEqual([1, 0, nationId('POR')]);
    // And with the wars over the next midnight sends it home.
    for (const war of [...w.wars.list]) w.wars.end(war);
    s.step(24 * 6);
    expect([c.moving[id], c.home[id]]).toEqual([1, 1]);
  });

  it('the walk back from a step that was barred does not keep its mark before an enemy\'s cell', () => {
    const { s, id, path } = midStep();
    const w = s.world;
    const c = w.formations.cols;
    w.setController(path[6]!, nationId('POL'));
    s.step(1);
    expect([c.moving[id], c.home[id]], 'the premise: on the walk back').toEqual([1, 2]);
    w.setController(path[5]!, nationId('FRA'));
    const [x, y] = [c.x[id]!, c.y[id]!];
    s.step(3);
    expect(w.cells.controller[path[5]!], 'the premise: the cell behind it is the enemy\'s still').toBe(nationId('FRA'));
    expect([c.x[id], c.y[id]], 'it waits').toEqual([x, y]);
    expect([c.moving[id], c.home[id]]).toEqual([1, 0]);
  });

  it('a march home saved on its way and loaded goes on as the game that ran on', () => {
    const { s, far } = farFromHome();
    s.step(24 * 3);
    const c = s.world.formations.cols;
    expect([c.moving[far], c.home[far]]).toEqual([1, 1]);
    const bytes = s.save();
    const loaded = new Sim({ scenario: '1938', seed: 9, assets: assets1938(W) });
    loaded.load(bytes);
    expect(Buffer.from(loaded.save()).equals(Buffer.from(bytes))).toBe(true);
    expect(loaded.world.formations.cols.home[far]).toBe(1);
    for (const t of [s, loaded]) t.step(24 * 40);
    expect(c.moving[far]).toBe(0);
    expect(s.world.cells.controller[Math.floor(c.y[far]!) * W + Math.floor(c.x[far]!)]).toBe(nationId('ITA'));
    expect(loaded.hash()).toBe(s.hash());
  });

  // Before: seed 7 at hours 769 and 1225 (Estonian divisions in Lithuania and the Soviet Union, 26
  // and 16 cells in the hour).
  it('1938, seed 7, the first 55 days: no formation is more than 3 cells from where it was an hour before, but one set on another landmass', () => {
    const s = new Sim({ scenario: '1938', seed: 7, assets: assets1938(W) });
    const w = s.world;
    const fc = w.formations.cols;
    const comp = navOf(w).grid.component;
    const before = new Map<number, { x: number; y: number; generation: number }>();
    const jumps: string[] = [];
    let homeward = 0;
    for (let hour = 1; hour <= 24 * 55; hour++) {
      before.clear();
      w.formations.forEach((f) => before.set(f, { x: fc.x[f]!, y: fc.y[f]!, generation: w.formations.generation[f]! }));
      s.step(1);
      for (const [f, was] of before) {
        if (!w.formations.has(f) || w.formations.generation[f] !== was.generation) continue;
        if (fc.home[f] === 1) homeward++;
        const d = Math.hypot(acrossX(fc.x[f]!, was.x), fc.y[f]! - was.y);
        if (d > 3 && comp[Math.floor(was.y) * W + Math.floor(was.x)] === comp[Math.floor(fc.y[f]!) * W + Math.floor(fc.x[f]!)]) jumps.push(`hour ${hour}: formation ${f} from ${was.x.toFixed(2)}, ${was.y.toFixed(2)} to ${fc.x[f]!.toFixed(2)}, ${fc.y[f]!.toFixed(2)}: ${d.toFixed(1)} cells`);
      }
    }
    expect(homeward, 'formation-hours on a march home').toBeGreaterThan(100);
    expect(jumps.length, jumps.slice(0, 5).join('; ')).toBe(0);
  }, 120_000);

  it('a march is the march that was ordered after a load: its path is saved, not found again', () => {
    const s = world('GER', 'FRA');
    const id = spawn(s.world, 'GER', INF, 13.4, 52.5);
    order(s, id, 10.0, 48.8);
    s.step(10);
    // Ground ahead changes hands: the march that was ordered ends before it; a route found now would go round.
    s.world.setController(s.world.paths.get(id)![12]!, nationId('POL'));
    const bytes = s.save();
    const loaded = new Sim({ scenario: '1938', seed: 9, assets: assets1938(W) });
    loaded.load(bytes);
    expect(Buffer.from(loaded.save()).equals(Buffer.from(bytes))).toBe(true);
    const again = new Sim({ scenario: '1938', seed: 9, assets: assets1938(W) });
    again.load(bytes);
    again.world.paths.clear();
    for (const t of [s, loaded, again]) t.step(24 * 30);
    expect(s.world.formations.cols.moving[id]).toBe(0);
    expect(loaded.hash()).toBe(s.hash());
    expect(again.hash(), 'the premise: with its path found again it is another march').not.toBe(s.hash());
  });
});

// PLAN 2.11i (the fifth independent read, finding 1): since PLAN 2.9a a cell's place can be its
// land point, and the points of two neighbouring cells can be more than 1 apart in x. The march
// took "more than 1 apart" for a step across the seam of the looping map and walked it the long
// way round the world, some 100 cells an hour.
describe('a march between two neighbouring cells is not a crossing of the seam (PLAN 2.11i)', () => {
  /** The distance in x the short way round, cells. */
  const acrossX = (a: number, b: number): number => {
    const d = Math.abs(a - b);
    return Math.min(d, W - d);
  };
  const place = (world: World, nation: number, at: readonly [number, number]): number => {
    const f = world.formations;
    const id = f.create();
    f.cols.nation[id] = nation;
    f.cols.template[id] = INF;
    f.cols.x[id] = at[0];
    f.cols.y[id] = at[1];
    f.cols.strength[id] = 10_000;
    return id;
  };

  it('on the 1938 map, between cells whose standing points are more than 1 apart in x, a formation stays by the two cells and faces along the step', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    w.settings.aiEnabled = false;
    const { terrain, controller } = w.cells;
    const land = (c: number): boolean => terrain[c] !== Terrain.Water && terrain[c] !== Terrain.Crossing;
    // Land cells in neighbouring columns, of one nation, whose points are more than 1 apart in x.
    const pairs: [number, number][] = [];
    for (let y = 1; y < H - 1; y++) {
      for (let x = 0; x < W - 1; x++) {
        const a = y * W + x;
        if (!land(a) || controller[a] === 0) continue;
        for (const dy of [-1, 0, 1]) {
          const b = (y + dy) * W + x + 1;
          if (land(b) && controller[b] === controller[a] && Math.abs(w.cellPoint(a)[0] - w.cellPoint(b)[0]) > 1) pairs.push([a, b]);
        }
      }
    }
    expect(pairs.length).toBeGreaterThan(1000);
    // Forty of them, from all over the map, each walked both ways.
    const marches: { id: number; from: number; to: number }[] = [];
    for (let k = 0; k < 40; k++) {
      const [a, b] = pairs[Math.floor((k * pairs.length) / 40)]!;
      for (const [from, to] of [[a, b], [b, a]] as const) {
        const id = place(w, controller[from]!, w.cellPoint(from));
        s.command({ kind: 'moveFormation', id, x: (to % W) + 0.5, y: Math.floor(to / W) + 0.5 });
        marches.push({ id, from, to });
      }
    }
    const fc = w.formations.cols;
    const far: string[] = [];
    const turned: string[] = [];
    let direct = 0;
    let onTheStep = 0;
    for (let hour = 1; hour <= 24 * 4; hour++) {
      s.step(1);
      for (const m of marches) {
        if (!w.formations.has(m.id)) continue;
        const [ax, ay] = w.cellPoint(m.from);
        const [bx, by] = w.cellPoint(m.to);
        const [x, y] = [fc.x[m.id]!, fc.y[m.id]!];
        // By the two cells: no further from the start than the two points are apart, and a cell more.
        if (acrossX(x, ax) > 3 || Math.abs(y - ay) > 3) far.push(`hour ${hour}: formation ${m.id} at ${x.toFixed(2)}, ${y.toFixed(2)} on its way from ${ax.toFixed(2)}, ${ay.toFixed(2)} to ${bx.toFixed(2)}, ${by.toFixed(2)}`);
        const path = fc.moving[m.id] === 1 ? w.paths.get(m.id) : undefined;
        if (path?.length === 2 && fc.pathStep[m.id] === 0 && fc.stepFrac[m.id]! > 0) {
          // On the one step from the one cell to the other: facing along it.
          onTheStep++;
          const along = Math.atan2(by - ay, bx - ax);
          if (Math.cos(fc.facing[m.id]! - along) < 0.999) turned.push(`hour ${hour}: formation ${m.id} faces ${fc.facing[m.id]!.toFixed(3)} on a step along ${along.toFixed(3)}`);
        }
        if (hour === 1 && path?.length === 2) direct++;
      }
    }
    // Most of the marches are the one step (a route may go round by a third cell).
    expect(direct).toBeGreaterThan(40);
    expect(onTheStep).toBeGreaterThan(200);
    expect(far.slice(0, 5)).toEqual([]);
    expect(turned.slice(0, 5)).toEqual([]);
  });

  it('a march across the true seam still goes the short way', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    w.settings.aiEnabled = false;
    expect(w.settings.loopingMap).toBe(true);
    const { terrain, controller } = w.cells;
    // Land of one nation in the last column and the first (Chukotka lies across the 180th meridian).
    let pair: [number, number] | null = null;
    for (let y = 1; y < H - 1 && !pair; y++) {
      const [a, b] = [y * W + W - 1, y * W];
      if (terrain[a]! > Terrain.Crossing && terrain[b]! > Terrain.Crossing && controller[a] !== 0 && controller[a] === controller[b]) pair = [a, b];
    }
    expect(pair).not.toBeNull();
    const [east, west] = pair!;
    const id = place(w, controller[east]!, w.cellPoint(east));
    s.command({ kind: 'moveFormation', id, x: 0.5, y: Math.floor(west / W) + 0.5 });
    const fc = w.formations.cols;
    let widest = 0;
    let arrived = false;
    for (let hour = 1; hour <= 24 * 6 && !arrived; hour++) {
      s.step(1);
      // Never away from the seam: within two cells of it on one side or the other.
      widest = Math.max(widest, Math.min(fc.x[id]!, W - fc.x[id]!));
      arrived = fc.moving[id] === 0 && Math.floor(fc.x[id]!) === 0;
    }
    expect(arrived).toBe(true);
    expect(widest).toBeLessThan(2);
  });

  it('1938, seed 99, the first 60 days: no formation on the march is more than a cell from where it was an hour before', () => {
    const s = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) });
    const w = s.world;
    const fc = w.formations.cols;
    const before = new Map<number, { x: number; y: number; generation: number }>();
    const jumps: string[] = [];
    let looks = 0;
    for (let hour = 1; hour <= 24 * 60; hour++) {
      before.clear();
      w.formations.forEach((f) => {
        if (fc.moving[f] === 1) before.set(f, { x: fc.x[f]!, y: fc.y[f]!, generation: w.formations.generation[f]! });
      });
      s.step(1);
      for (const [f, was] of before) {
        // The same formation, still on its march (an order, an arrival or its end is not a step of the march).
        if (!w.formations.has(f) || w.formations.generation[f] !== was.generation || fc.moving[f] !== 1) continue;
        looks++;
        const d = Math.hypot(acrossX(fc.x[f]!, was.x), fc.y[f]! - was.y);
        if (d > 1) jumps.push(`hour ${hour}: formation ${f} from ${was.x.toFixed(2)}, ${was.y.toFixed(2)} to ${fc.x[f]!.toFixed(2)}, ${fc.y[f]!.toFixed(2)}: ${d.toFixed(1)} cells`);
      }
    }
    expect(looks).toBeGreaterThan(50_000);
    expect(jumps.length, jumps.slice(0, 5).join('; ')).toBe(0);
  }, 120_000);
});

// PLAN 3.5a1. An order began at the point of the cell the formation stood in: one given in the
// middle of a step put the formation back there, half a step away, and over a cell where the
// two cells' land points lie far apart (a retreat on the coast of Shandong, seed 99, hour 581:
// 1.03 cells in the hour).
describe('an order to a formation on the march (PLAN 3.5a1)', () => {
  const acrossX = (a: number, b: number): number => Math.min(Math.abs(a - b), W - Math.abs(a - b));
  for (const [name, lon, lat] of [['onward', 8.0, 52.4], ['back', 13.4, 52.5], ['aside', 11.6, 49.5]] as const) {
    it(`leaves it where it stands, and it marches from there: ${name}`, () => {
      const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
      const w = s.world;
      w.settings.aiEnabled = false;
      const c = w.formations.cols;
      const id = spawn(w, 'GER', INF, 13.4, 52.5);
      const [x0, y0] = cellOf(10.0, 52.4, W, H);
      s.command({ kind: 'moveFormation', id, x: x0, y: y0 });
      // To the middle of a step that is not its first.
      let hours = 0;
      while (hours++ < 24 * 10 && !(c.pathStep[id]! >= 2 && c.stepFrac[id]! > 0.4 && c.stepFrac[id]! < 0.6)) s.step(1);
      expect(c.moving[id]).toBe(1);
      expect(c.stepFrac[id]).toBeGreaterThan(0.4);
      const was = [c.x[id]!, c.y[id]!] as const;
      const [x1, y1] = cellOf(lon, lat, W, H);
      const goal = Math.floor(y1) * W + Math.floor(x1);
      s.command({ kind: 'moveFormation', id, x: x1, y: y1 });
      s.step(1);
      expect(c.targetCell[id]).toBe(goal);
      // The hour of the order: an hour's march, not the way back to a cell's point.
      expect(Math.hypot(acrossX(c.x[id]!, was[0]), c.y[id]! - was[1])).toBeLessThan(0.3);
      // And every hour after it, to the place ordered.
      let widest = 0;
      let at = [c.x[id]!, c.y[id]!] as const;
      for (let h = 0; h < 24 * 30 && c.moving[id] === 1; h++) {
        s.step(1);
        widest = Math.max(widest, Math.hypot(acrossX(c.x[id]!, at[0]), c.y[id]! - at[1]));
        at = [c.x[id]!, c.y[id]!];
      }
      expect(widest).toBeLessThan(0.3);
      expect(c.moving[id]).toBe(0);
      expect(Math.floor(c.y[id]!) * W + Math.floor(c.x[id]!)).toBe(goal);
    });
  }
});
