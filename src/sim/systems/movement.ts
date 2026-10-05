/**
 * Land movement (PLAN 1.11, SPEC §4): `moveFormation` orders and the hourly movement system.
 *
 * An order stores origin cell, target cell, the index of the last path cell reached and the
 * fraction of the way to the next one (all state). The path itself is derived: computed by
 * `findRoute` from origin to target when ordered and recomputed identically after a load
 * (it depends only on static layers). Formations move along cell centres; the time to enter a
 * cell is step km × terrain move cost for the template's mobility ÷ (speed × MARCH_DUTY).
 * A formation waits before a cell held by a nation it is at war with until the territory system
 * flips it, so armies advance with their front instead of running ahead of it.
 * Water is impassable to land formations; crossing cells are walkable (straits). A target cell not
 * reachable from the formation (a coastal speck at map resolution) snaps to the nearest reachable
 * cell within TARGET_SNAP_CELLS; beyond that the order is rejected.
 *
 * Repatriation (daily at 00:00; critic B1, 2026-10-03): an idle formation standing on land held
 * by a nation outside its supply bloc that it is neither at war with nor fighting beside
 * (occupied land handed back at a peace, mostly) marches to the nearest cell its own nation controls within REPATRIATE_CELLS; if
 * there is none or no route, it is moved to its nation's spawn point. Such formations used to
 * stay where the peace found them, out of supply, until attrition had killed them: most of an
 * army that had just won a war.
 */
import { EventKind } from '../../shared/events';
import { atan2 } from '../core/dmath';
import { MOVE_COST, stepKm, type MobilityId } from '../nav/grid';
import { nearestCellWhere } from '../data/ownership';
import { findRoute } from '../nav/provinceGraph';
import { isDayStart } from '../../shared/calendar';
import { navOf, type World } from '../world';
import { spawnPoint } from './production';
import { blocOf } from './supply';

/** Share of each hour a formation marches (rest, forming up, roads): infantry ≈ 29 km/day. */
export const MARCH_DUTY = 0.3;
/** A target cell unreachable from the formation snaps to a reachable one within this many cells. */
export const TARGET_SNAP_CELLS = 3;
export const REPATRIATE_CELLS = 80;

/** Where a formation stands in a cell of its path: the middle, or the cell's land point (PLAN 2.9a). */
function centre(world: World, cell: number): [number, number] {
  return world.cellPoint(cell);
}

/** Path of a moving formation (cached; rebuilt from its origin and target when missing). */
export function formationPath(world: World, id: number): Int32Array | null {
  let p = world.paths.get(id);
  if (p) return p;
  const f = world.formations.cols;
  const rule = world.rules?.templates[f.template[id]!];
  if (!rule) return null;
  const nav = navOf(world);
  const route = findRoute(nav.grid, nav.graph, rule.mobility as MobilityId, f.originCell[id]!, f.targetCell[id]!);
  if (!route) return null;
  p = Int32Array.from(route.cells);
  world.paths.set(id, p);
  return p;
}

/** Applies a move order; returns false (and emits MoveRejected) when no land route exists. */
export function orderMove(world: World, id: number, x: number, y: number): boolean {
  const f = world.formations;
  const { w, h } = world.cells;
  const rule = f.has(id) ? world.rules?.templates[f.cols.template[id]!] : undefined;
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (!rule || ty < 0 || ty >= h || tx < 0 || tx >= w) {
    world.out.emit(world.tick, EventKind.MoveRejected, id, 0, NaN, NaN);
    return false;
  }
  const c = f.cols;
  const origin = Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!);
  const nav = navOf(world);
  // Targets on coastal specks or across a strait-less sea snap to the nearest reachable cell.
  const comp = nav.grid.component;
  const target = nearestCellWhere((k) => comp[k] !== 0 && comp[k] === comp[origin], tx + 0.5, ty + 0.5, w, h, TARGET_SNAP_CELLS);
  const route = target < 0 ? null : findRoute(nav.grid, nav.graph, rule.mobility as MobilityId, origin, target);
  if (!route) {
    world.out.emit(world.tick, EventKind.MoveRejected, id, c.nation[id]!, NaN, NaN);
    return false;
  }
  c.moving[id] = 1;
  c.originCell[id] = origin;
  c.targetCell[id] = target;
  c.pathStep[id] = 0;
  c.stepFrac[id] = 0;
  world.paths.set(id, Int32Array.from(route.cells));
  [c.x[id], c.y[id]] = centre(world, origin);
  return true;
}

export function repatriationSystem(world: World): void {
  if (!isDayStart(world.tick)) return;
  const f = world.formations;
  const c = f.cols;
  const { w, h, controller } = world.cells;
  const comp = navOf(world).grid.component;
  f.forEach((id) => {
    if (c.moving[id] === 1 || c.engaged[id] === 1 || !world.rules?.templates[c.template[id]!]) return;
    const nation = c.nation[id]!;
    const cell = Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!);
    const holder = controller[cell]!;
    if (holder === 0 || holder === nation || blocOf(world, holder) === blocOf(world, nation) || world.wars.atWar(nation, holder) || world.wars.sameSide(nation, holder)) return;
    const home = nearestCellWhere((k) => controller[k] === nation && comp[k] === comp[cell], c.x[id]!, c.y[id]!, w, h, REPATRIATE_CELLS);
    if (home >= 0 && orderMove(world, id, (home % w) + 0.5, Math.floor(home / w) + 0.5)) return;
    const at = spawnPoint(world, nation);
    if (!at) return;
    c.x[id] = at[0];
    c.y[id] = at[1];
  });
}

export function movementSystem(world: World): void {
  const f = world.formations;
  const c = f.cols;
  const nav = navOf(world);
  const w = world.cells.w;
  f.forEach((id) => {
    if (c.moving[id] !== 1 || c.engaged[id] === 1) return; // in contact: holds and fights (PLAN 1.13)
    const path = formationPath(world, id);
    const rule = world.rules?.templates[c.template[id]!];
    if (!path || !rule) {
      c.moving[id] = 0;
      return;
    }
    const costRow = MOVE_COST[rule.mobility]!;
    const kmPerHour = rule.speedKmh * MARCH_DUTY * Math.max(0.05, 1 + world.buffs.sum('speed', 'nation', c.nation[id]!) + world.buffs.sum('speed', 'formation', id));
    let i = c.pathStep[id]!;
    let frac = c.stepFrac[id]!;
    let budget = 1; // hours this tick
    const nation = c.nation[id]!;
    while (budget > 0 && i < path.length - 1) {
      const a = path[i]!;
      const b = path[i + 1]!;
      // Enemy-held ground is entered only once it flips (PLAN 1.14): the advance follows the front.
      const holder = world.cells.controller[b]!;
      if (holder !== 0 && world.wars.atWar(nation, holder)) break;
      const ay = Math.floor(a / w);
      const by = Math.floor(b / w);
      let dx = (b % w) - (a % w);
      if (dx > 1) dx -= w; // wrap
      if (dx < -1) dx += w;
      const segHours = (stepKm(nav.grid, by > ay ? ay : by, dx, by - ay) * costRow[world.cells.terrain[b]!]!) / kmPerHour;
      const left = segHours * (1 - frac);
      if (budget >= left) {
        budget -= left;
        i++;
        frac = 0;
      } else {
        frac += budget / segHours;
        budget = 0;
      }
    }
    c.pathStep[id] = i;
    c.stepFrac[id] = frac;
    const [ax, ay] = centre(world, path[i]!);
    if (i >= path.length - 1) {
      c.x[id] = ax;
      c.y[id] = ay;
      c.moving[id] = 0;
      world.paths.delete(id);
      world.out.emit(world.tick, EventKind.FormationArrived, id, c.nation[id]!, ax, ay);
      return;
    }
    const [bx0, by] = centre(world, path[i + 1]!);
    let bx = bx0;
    if (bx - ax > 1) bx -= w;
    if (ax - bx > 1) bx += w;
    const x = ax + (bx - ax) * frac;
    c.x[id] = x < 0 ? x + w : x >= w ? x - w : x;
    c.y[id] = ay + (by - ay) * frac;
    c.facing[id] = atan2(by - ay, bx - ax);
  });
}
