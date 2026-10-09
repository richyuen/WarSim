import { describe, expect, it } from 'vitest';
import { encodeRuns } from '../../src/shared/mapImport';
import { Terrain } from '../../src/shared/terrain';
import { cellOf } from '../../src/sim/data/terrain';
import { brushCells } from '../../src/sim/editor';
import { applyGameOptions } from '../../src/sim/gameOptions';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 3.7k (the eighth independent read, finding 2): a paint of terrain and a change of
// `loopingMap` dropped every path, and each was found again from the order's first cell on the
// holders of now while the formation's step still counted along the path that was gone. One
// cell of ice painted to plains at the top of the map moved 85 formations, by up to 11.7 cells.

const W = SIZE_1938.w;
const H = SIZE_1938.h;

/** The distance between two places, the short way round in x, cells. */
const apart = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = Math.abs(ax - bx);
  return Math.hypot(Math.min(dx, W - dx), ay - by);
};
/** No march is longer in an hour than this, nor a step back to the cell behind (cells). */
const A_STEP = 2;

function places(world: World): Map<number, [number, number, number]> {
  const c = world.formations.cols;
  const out = new Map<number, [number, number, number]>();
  world.formations.forEach((id) => out.set(id, [c.x[id]!, c.y[id]!, c.moving[id]!]));
  return out;
}

/** A German division on the march from Berlin towards Stuttgart, ten hours out, in a world at peace. */
function onTheMarch(): { s: Sim; id: number } {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
  const w = s.world;
  w.settings.aiEnabled = false;
  for (const war of [...w.wars.list]) w.wars.end(war);
  const [x, y] = cellOf(13.4, 52.5, W, H);
  const id = addDivision(w, nationId('GER'), Math.floor(x) + 0.5, Math.floor(y) + 0.5);
  const [tx, ty] = cellOf(10.0, 48.8, W, H);
  s.command({ kind: 'moveFormation', id, x: tx, y: ty });
  s.step(10);
  expect(w.formations.cols.moving[id]).toBe(1);
  return { s, id };
}

/** Water by a map import on the cells within `r` of `cell` (a paint makes no water of land). */
function flood(s: Sim, cell: number, r: number): void {
  const values = Uint16Array.from(s.world.cells.terrain);
  for (const c of brushCells(W, H, (cell % W) + 0.5, Math.floor(cell / W) + 0.5, r, true)) values[c] = Terrain.Water;
  s.command({ kind: 'importLayer', layer: 'terrain', runs: encodeRuns(values) });
}

/** Steps hour by hour until the formation is idle; what it did on the way. */
function walk(s: Sim, id: number, hours: number): { leaps: string[]; wet: number; nan: number; idle: boolean } {
  const w = s.world;
  const c = w.formations.cols;
  const leaps: string[] = [];
  let wet = 0;
  let nan = 0;
  let [px, py] = [c.x[id]!, c.y[id]!];
  for (let hour = 1; hour <= hours && c.moving[id] === 1; hour++) {
    s.step(1);
    const [x, y] = [c.x[id]!, c.y[id]!];
    if (Number.isNaN(x) || Number.isNaN(y)) {
      nan++;
      continue;
    }
    if (apart(x, y, px, py) > A_STEP) leaps.push(`hour ${hour}: from ${px.toFixed(2)}, ${py.toFixed(2)} to ${x.toFixed(2)}, ${y.toFixed(2)}`);
    if (w.cells.terrain[Math.floor(y) * W + Math.floor(x)] === Terrain.Water) wet++;
    [px, py] = [x, y];
  }
  return { leaps, wet, nan, idle: c.moving[id] === 0 };
}

describe('a paint of terrain does not move a marching formation (PLAN 3.7k)', () => {
  it('a paint far from every formation leaves each where the game without it has it, an hour and 48 hours later', () => {
    const first = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) });
    first.step(1500);
    const bytes = first.save();
    const plain = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) });
    const painted = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) });
    plain.load(bytes);
    painted.load(bytes);
    const far = 1 * W + 727;
    expect(painted.world.cells.terrain[far]).toBe(Terrain.Ice);
    let marching = 0;
    let nearest = Infinity;
    for (const [x, y, moving] of places(painted.world).values()) {
      marching += moving;
      nearest = Math.min(nearest, apart(x, y, 727.5, 1.5));
    }
    expect(marching).toBeGreaterThan(100);
    expect(nearest).toBeGreaterThan(100);
    painted.command({ kind: 'editPaint', layer: 'terrain', tool: 'brush', x: 727.5, y: 1.5, x2: 0, y2: 0, r: 0, value: Terrain.Plains, mask: null });
    for (const hours of [1, 47]) {
      plain.step(hours);
      painted.step(hours);
      expect(painted.world.cells.terrain[far]).toBe(Terrain.Plains);
      const want = places(plain.world);
      const moved: string[] = [];
      for (const [id, [x, y, moving]] of places(painted.world)) {
        const p = want.get(id);
        if (!p || p[0] !== x || p[1] !== y || p[2] !== moving) moved.push(`formation ${id} at ${x.toFixed(2)}, ${y.toFixed(2)}${p ? `, without the paint at ${p[0].toFixed(2)}, ${p[1].toFixed(2)}` : ', which the game without the paint has not'}`);
      }
      expect(want.size).toBe(places(painted.world).size);
      expect(moved.length, moved.slice(0, 5).join('; ')).toBe(0);
    }
  }, 120_000);

  it('new water that bars the way: the formation goes on from where it stands by a new route, and is never more than a step from where it was', () => {
    const { s, id } = onTheMarch();
    const w = s.world;
    const c = w.formations.cols;
    const path = w.paths.get(id)!;
    const target = c.targetCell[id]!;
    const ahead = path[c.pathStep[id]! + 3]!;
    flood(s, ahead, 1);
    const went = walk(s, id, 24 * 40);
    expect(w.cells.terrain[ahead]).toBe(Terrain.Water);
    expect(went.nan).toBe(0);
    expect(went.leaps).toEqual([]);
    expect(went.wet).toBe(0);
    expect(went.idle).toBe(true);
    expect(Math.floor(c.y[id]!) * W + Math.floor(c.x[id]!)).toBe(target);
  });

  it('new water that leaves no way: the formation halts within a step of where it stood', () => {
    const { s, id } = onTheMarch();
    const w = s.world;
    const c = w.formations.cols;
    const target = c.targetCell[id]!;
    const [x0, y0] = [c.x[id]!, c.y[id]!];
    // The target and all about it under water: beyond what an order snaps to.
    flood(s, target, 6);
    const went = walk(s, id, 24 * 40);
    expect(went.nan).toBe(0);
    expect(went.leaps).toEqual([]);
    expect(went.wet).toBe(0);
    expect(went.idle).toBe(true);
    expect(w.paths.has(id)).toBe(false);
    // By the path it had as far as the water at the most, and no further.
    expect(apart(c.x[id]!, c.y[id]!, (target % W) + 0.5, Math.floor(target / W) + 0.5)).toBeLessThanOrEqual(apart(x0, y0, (target % W) + 0.5, Math.floor(target / W) + 0.5));
    expect(apart(c.x[id]!, c.y[id]!, (target % W) + 0.5, Math.floor(target / W) + 0.5)).toBeGreaterThan(5);
  });

  it('a path that is missing (an old save) is found again from where the formation stands', () => {
    const { s, id } = onTheMarch();
    const w = s.world;
    const c = w.formations.cols;
    const target = c.targetCell[id]!;
    // A route much shorter than the steps already counted: the place read was past its end.
    for (let hour = 0; hour < 24 * 40 && w.paths.get(id)!.length - c.pathStep[id]! > 4; hour++) s.step(1);
    expect(c.moving[id]).toBe(1);
    const walked = c.pathStep[id]!;
    expect(walked).toBeGreaterThan(8);
    const near = w.paths.get(id)![walked]!;
    c.originCell[id] = near;
    w.paths.clear();
    const went = walk(s, id, 24 * 10);
    expect(went.nan).toBe(0);
    expect(went.leaps).toEqual([]);
    expect(went.idle).toBe(true);
    expect(Math.floor(c.y[id]!) * W + Math.floor(c.x[id]!)).toBe(target);
  });

  it('the same for the looping map: a step over the seam of a map that loops no more is not taken', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    w.settings.aiEnabled = false;
    for (const war of [...w.wars.list]) w.wars.end(war);
    const { terrain, controller } = w.cells;
    // Land of one nation in the last column and the first (Chukotka lies across the 180th meridian).
    let pair: [number, number] | null = null;
    for (let y = 1; y < H - 1 && !pair; y++) {
      const [a, b] = [y * W + W - 3, y * W + 2];
      if ([a, a + 1, a + 2, b - 2, b - 1, b].every((k) => terrain[k]! > Terrain.Crossing && controller[k] === controller[a] && controller[a] !== 0)) pair = [a, b];
    }
    expect(pair).not.toBeNull();
    const [east, west] = pair!;
    const [ex, ey] = w.cellPoint(east);
    const id = addDivision(w, controller[east]!, ex, ey);
    s.command({ kind: 'moveFormation', id, x: (west % W) + 0.5, y: Math.floor(west / W) + 0.5 });
    const c = w.formations.cols;
    s.step(1);
    expect(c.moving[id]).toBe(1);
    expect(w.paths.get(id)!.length).toBeLessThan(12);
    applyGameOptions(w, { loopingMap: false });
    const went = walk(s, id, 24 * 20);
    expect(went.nan).toBe(0);
    expect(went.leaps).toEqual([]);
    expect(went.idle).toBe(true);
    // East of the seam still: the west is not to be reached on a map with edges.
    expect(c.x[id]!).toBeGreaterThan(W - 4);
  });
});
