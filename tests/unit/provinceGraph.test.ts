import { describe, expect, it } from 'vitest';
import { encodeRuns } from '../../src/shared/mapImport';
import { Terrain } from '../../src/shared/terrain';
import { boundKm, MIN_COST, Mobility, type MobilityId, type NavGrid, type Passage } from '../../src/sim/nav/grid';
import { coarseRoute, findRoute, mayReach, nodeGroups, SHUT_PRICE, type ProvinceGraph } from '../../src/sim/nav/provinceGraph';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { orderMove, passageOf } from '../../src/sim/systems/movement';
import { navOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 3.7j (ADR-170): a walkable cell that no province has is a node of the province graph, so
// the groups of provinces with open ground (`Passage.group`) are joined wherever cells are.

const W = SIZE_1938.w;
const at = (x: number, y: number): number => y * W + x;
const world1938 = (): World => new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) }).world;

/** A passage with every holder open. */
function allOpen(world: World): Passage {
  const graph = navOf(world).graph;
  const open = new Uint8Array(graph.nodeCount).fill(1);
  return { ok: new Uint8Array(world.nations.highWater + 1).fill(1), holder: world.cells.controller, open, group: nodeGroups(graph, open) };
}

describe('a land cell with no province joins the provinces about it (PLAN 3.7j)', () => {
  it('a Japanese division is ordered from Honshu to Kyushu over the forest cell that no province has, and back', () => {
    const world = world1938();
    const JAP = nationId('JAP');
    const { grid, graph } = navOf(world);
    const [from, between, to] = [at(1769, 395), at(1768, 396), at(1766, 397)];
    // The ground of the case: both ends Japan's, on one landmass, and the cell between them of no province.
    expect([world.cells.controller[from], world.cells.controller[to]]).toEqual([JAP, JAP]);
    expect(grid.component[from]).toBe(grid.component[to]);
    expect(world.cells.province[between]).toBe(0);
    expect(grid.component[between]).toBe(grid.component[from]);
    const pass = passageOf(world, JAP);
    expect(mayReach(grid, graph, from, to, pass)).toBe(true);
    expect(mayReach(grid, graph, to, from, pass)).toBe(true);
    const there = addDivision(world, JAP, 1769.5, 395.5);
    expect(orderMove(world, there, 1766.5, 397.5)).toBe(true);
    const back = addDivision(world, JAP, 1766.5, 397.5);
    expect(orderMove(world, back, 1769.5, 395.5)).toBe(true);
  });

  it('on the 1938 map every walkable cell has a node, and with every holder open no landmass falls into two groups', () => {
    const world = world1938();
    const { grid, graph } = navOf(world);
    const group = allOpen(world).group!;
    const groupOf = new Map<number, number>();
    const split = new Set<number>();
    let noNode = 0;
    for (let c = 0; c < grid.component.length; c++) {
      const land = grid.component[c]!;
      if (land === 0) continue;
      const node = graph.nodeOf[c]!;
      if (node === 0) {
        noNode++;
        continue;
      }
      const g = group[node]!;
      if (!groupOf.has(land)) groupOf.set(land, g);
      else if (groupOf.get(land) !== g) split.add(land);
    }
    expect(noNode).toBe(0);
    expect([...split]).toEqual([]);
  });

  it('land that a map import puts between two landmasses joins their provinces', () => {
    const sim = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) });
    const world = sim.world;
    const { terrain, province } = world.cells;
    const before = navOf(world);
    // The first water cell with land of a province on its left and on its right, of two landmasses.
    let c = 1;
    for (; c < terrain.length - 1; c++) {
      const [l, r] = [before.grid.component[c - 1]!, before.grid.component[c + 1]!];
      if (terrain[c] === Terrain.Water && c % W !== 0 && c % W !== W - 1 && l !== 0 && r !== 0 && l !== r && province[c - 1] !== 0 && province[c + 1] !== 0) break;
    }
    expect(c).toBeLessThan(terrain.length - 1);
    expect(findRoute(before.grid, before.graph, Mobility.foot, c - 1, c + 1, allOpen(world))).toBeNull();
    const values = Uint16Array.from(terrain);
    values[c] = Terrain.Plains;
    sim.command({ kind: 'importLayer', layer: 'terrain', runs: encodeRuns(values) });
    sim.applyNow();
    expect(world.cells.terrain[c]).toBe(Terrain.Plains);
    expect(world.cells.province[c]).toBe(0);
    const { grid, graph } = navOf(world);
    const pass = allOpen(world);
    expect(graph.nodeOf[c]).not.toBe(0);
    expect(pass.group![graph.nodeOf[c - 1]!]).toBe(pass.group![graph.nodeOf[c + 1]!]);
    expect(mayReach(grid, graph, c - 1, c + 1, pass)).toBe(true);
    expect(findRoute(grid, graph, Mobility.foot, c - 1, c + 1, pass)?.cells).toEqual([c - 1, c, c + 1]);
  });

  it('a long route whose only way is over land of no province is found in its corridor', () => {
    const world = world1938();
    const { grid, graph } = navOf(world);
    // The reader's pair on Japan's landmass: 120 cells apart by the way, more than 500 km.
    const [from, to] = [at(1831, 319), at(1766, 397)];
    expect(grid.component[from]).toBe(grid.component[to]);
    expect(findRoute(grid, graph, Mobility.foot, from, to, allOpen(world))).not.toBeNull();
    expect(findRoute(grid, graph, Mobility.foot, from, to, passageOf(world, nationId('JAP')))).not.toBeNull();
  });
});

// PLAN 3.10c1c (ADR-189): the groups say where a route may be, by province. Where the cells
// give none, a short search walked all the ground the formation could reach (30 ms an order,
// and the operational AI asked again the day after).
describe('a short route over open ground is held to the provinces (PLAN 3.10c1c)', () => {
  it('a place walled off inside its province is refused after a search of the provinces about it', () => {
    const world = world1938();
    const [GER, POL] = [nationId('GER'), nationId('POL')];
    const { grid, graph } = navOf(world);
    // A ring of Polish ground (at peace with Germany: closed) around a German cell near Berlin.
    const [gx, gy] = cellOf(13.4, 52.5, W, SIZE_1938.h).map(Math.floor) as [number, number];
    const goal = at(gx, gy);
    const start = at(gx - 12, gy);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === 3) world.setController(at(gx + dx, gy + dy), POL);
    expect([world.cells.controller[start], world.cells.controller[goal]]).toEqual([GER, GER]);
    const pass = passageOf(world, GER);
    expect(mayReach(grid, graph, start, goal, pass), 'the premise: the provinces say there may be a way').toBe(true);
    const seen = (): number => {
      const before = grid.scratch?.gen ?? 0;
      expect(findRoute(grid, graph, Mobility.foot, start, goal, pass)).toBeNull();
      const stamp = grid.scratch!.stamp;
      let n = 0;
      for (let c = 0; c < stamp.length; c++) if (stamp[c]! >= 2 * (before + 1)) n++;
      return n;
    };
    expect(seen()).toBeLessThan(1500);
    // The same order again, from the same ground: no search.
    expect(seen()).toBe(0);
    // The way out of the ring is as before: found, from closed ground or from open.
    expect(findRoute(grid, graph, Mobility.foot, at(gx - 6, gy), start, pass)).not.toBeNull();
    // And with the ring open (Poland in the war), the way in.
    world.wars.start([GER], [POL], world.tick);
    world.wars.changed();
    expect(findRoute(grid, graph, Mobility.foot, start, goal, passageOf(world, GER))?.cells.length).toBe(13);
  });
});

// PLAN 3.10c2b3b (ADR-194): the coarse route is planned over the provinces with open ground, and
// one of them need not be open from side to side. Where the way by the cells goes round such a
// province by provinces that are not its neighbours, the corridor did not hold it and the order
// was refused (4,878 times in five years of seed 99, 2,666 of them at one province).
describe('the coarse route goes round a province with closed ground (PLAN 3.10c2b3b)', () => {
  it('a wall across the provinces of the straight way and their neighbours: the route goes round it', () => {
    const world = world1938();
    const [SOV, POL] = [nationId('SOV'), nationId('POL')];
    const { grid, graph } = navOf(world);
    // East of Moscow, 60 cells along one row of Soviet ground.
    const [mx, my] = cellOf(40, 56, W, SIZE_1938.h).map(Math.floor) as [number, number];
    const [start, goal] = [at(mx, my), at(mx + 60, my)];
    expect([world.cells.controller[start], world.cells.controller[goal]]).toEqual([SOV, SOV]);
    const straight = findRoute(grid, graph, Mobility.foot, start, goal, passageOf(world, SOV))!;
    expect(straight.cells.length).toBe(61);
    // The provinces of that route and their neighbours, as the provinces alone plan it: every cell
    // of theirs in the column half way is Poland's (at peace with the Soviet Union: closed).
    const plain = coarseRoute(grid, graph, Mobility.foot, graph.nodeOf[start]!, graph.nodeOf[goal]!, passageOf(world, SOV).open)!;
    const about = new Set<number>();
    for (const a of plain) for (const b of [a, ...graph.adj[a]!]) about.add(b);
    let wall = 0;
    for (let y = 0; y < SIZE_1938.h; y++) {
      const c = at(mx + 30, y);
      if (!about.has(graph.nodeOf[c]!) || world.cells.controller[c] !== SOV) continue;
      world.setController(c, POL);
      wall++;
    }
    expect(wall).toBeGreaterThan(10);
    const pass = passageOf(world, SOV);
    // The premise: every province of the plain route still has open ground, and the cells have a way.
    expect(plain.every((a) => pass.open![a] === 1)).toBe(true);
    expect(plain.some((a) => pass.shut![a] === 1)).toBe(true);
    expect(mayReach(grid, graph, start, goal, pass)).toBe(true);
    const before = grid.scratch!.gen;
    const route = findRoute(grid, graph, Mobility.foot, start, goal, pass);
    expect(route, 'the way round the wall').not.toBeNull();
    expect(route!.cells.every((c) => world.cells.controller[c] === SOV)).toBe(true);
    expect(route!.cost).toBeGreaterThan(straight.cost);
    // Found in one search, in a corridor of provinces: not by a walk of the Soviet Union's ground.
    expect(grid.scratch!.gen).toBe(before + 1);
    const stamp = grid.scratch!.stamp;
    let seen = 0;
    for (let c = 0; c < stamp.length; c++) if (stamp[c]! >= 2 * (before + 1)) seen++;
    expect(seen).toBeLessThan(3000);
  });
});

// PLAN 7.1g: the coarse route's open nodes are a heap whose f is lowered in place. It takes them in
// the order of the list that was scanned before: the lowest f, of equals the first put in.
describe('the coarse route of a heap is the route of the scanned list (PLAN 7.1g)', () => {
  /** The coarse route as it was before PLAN 7.1g: the open list scanned for the lowest f. */
  function scanned(grid: NavGrid, graph: ProvinceGraph, mobility: MobilityId, from: number, to: number, only?: Uint8Array, dear?: Uint8Array): number[] | null {
    const cost = graph.meanCost[mobility]!;
    const price = (a: number): number => (dear !== undefined && dear[a] === 1 ? SHUT_PRICE * cost[a]! : cost[a]!);
    if (!Number.isFinite(cost[from]!) || !Number.isFinite(cost[to]!)) return null;
    const h = (a: number): number => boundKm(grid, graph.centre[a]!, graph.centre[to]!) * MIN_COST[mobility]!;
    const dist = new Float64Array(graph.nodeCount).fill(Infinity);
    const came = new Int32Array(graph.nodeCount).fill(-1);
    const done = new Uint8Array(graph.nodeCount);
    const f = new Float64Array(graph.nodeCount).fill(Infinity);
    dist[from] = 0;
    f[from] = h(from);
    const open: number[] = [from];
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (f[open[i]!]! < f[open[bi]!]!) bi = i;
      const a = open.splice(bi, 1)[0]!;
      if (a === to) break;
      if (done[a]) continue;
      done[a] = 1;
      for (const b of graph.adj[a]!) {
        if (done[b] || !Number.isFinite(cost[b]!) || (only !== undefined && only[b] !== 1)) continue;
        const t = dist[a]! + boundKm(grid, graph.centre[a]!, graph.centre[b]!) * 0.5 * (price(a) + price(b));
        if (t < dist[b]!) {
          dist[b] = t;
          came[b] = a;
          f[b] = t + h(b);
          open.push(b);
        }
      }
    }
    if (!Number.isFinite(dist[to]!)) return null;
    const route = [to];
    for (let a = to; a !== from; ) {
      a = came[a]!;
      route.push(a);
    }
    return route.reverse();
  }

  it('the same nodes for 2,000 pairs of the 1938 graph, each mobility, open to all or to a nation, closed ground dear or not', () => {
    const world = world1938();
    const { grid, graph } = navOf(world);
    const nations: number[] = [];
    world.nations.forEach((n) => {
      nations.push(n);
    });
    let s = 12345;
    const rnd = (n: number): number => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return (s >>> 0) % n;
    };
    let found = 0;
    let none = 0;
    for (let i = 0; i < 2000; i++) {
      const a = 1 + rnd(graph.nodeCount - 1);
      // The other end a walk of up to 300 steps over neighbours away: mostly on the same land.
      let b = a;
      for (let k = rnd(300); k > 0 && graph.adj[b]!.length > 0; k--) b = graph.adj[b]![rnd(graph.adj[b]!.length)]!;
      const mobility = ([Mobility.foot, Mobility.motor, Mobility.tracked] as MobilityId[])[rnd(3)]!;
      // Open to all, or to the holder of the first node's cell, or to a nation drawn.
      const holder = world.cells.controller[graph.centre[a]!]!;
      const draw = rnd(3);
      const pass = draw === 0 ? undefined : passageOf(world, draw === 1 && holder !== 0 ? holder : nations[rnd(nations.length)]!);
      const dear = pass !== undefined && rnd(2) === 1 ? pass.shut : undefined;
      const want = scanned(grid, graph, mobility, a, b, pass?.open, dear);
      expect(coarseRoute(grid, graph, mobility, a, b, pass?.open, dear)).toEqual(want);
      if (want === null) none++;
      else if (want.length > 2) found++;
    }
    // The pairs are not all refused or next to each other (823 routes of more than two nodes
    // and 969 refused, when written).
    expect(found).toBeGreaterThan(600);
    expect(none).toBeLessThan(1200);
  });
});
