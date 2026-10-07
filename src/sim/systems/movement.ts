/**
 * Land movement (PLAN 1.11, SPEC §4): `moveFormation` orders and the hourly movement system.
 *
 * An order stores origin cell, target cell, the index of the last path cell reached and the
 * fraction of the way to the next one, and its path: computed by `findRoute` from origin to
 * target when ordered, over the ground and its holders of that hour, and saved with the world
 * (`world.paths`; PLAN 3.4Rl: a path found again after a load would be one for the holders of
 * the hour of the load). Formations move along cell centres; the time to enter a
 * cell is step km × terrain move cost for the template's mobility ÷ (speed × MARCH_DUTY × the
 * template's own share of its speed on that ground, PLAN 3.3b).
 * A formation waits before a cell held by a nation it is at war with until the territory system
 * flips it, so armies advance with their front instead of running ahead of it; a formation on
 * the retreat (`systems/retreat.ts`) does not wait.
 * Water is impassable to land formations; crossing cells are walkable (straits). A target cell not
 * reachable from the formation (a coastal speck at map resolution) snaps to the nearest reachable
 * cell within TARGET_SNAP_CELLS; beyond that the order is rejected.
 *
 * No march across a nation that is not in the war (PLAN 3.4Rl, ADR-149). A formation enters the
 * ground of its own bloc, of a nation it is at war with, of one that fights beside it, and
 * nobody's (`foreignTo`); the route goes round any other nation's, and the order is rejected
 * when there is no way round (for a long march: none by the provinces that have such ground). A formation that stands on such ground (a peace found it there)
 * walks on that holder's cells and out of them: the way home. A march whose next cell has
 * become such ground since the order ends before it (`MoveRejected`).
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
import { Mobility, MOVE_COST, stepKm, type MobilityId, type Passage } from '../nav/grid';
import { nearestCellWhere } from '../data/ownership';
import { findRoute, nodeGroups } from '../nav/provinceGraph';
import { isDayStart } from '../../shared/calendar';
import { navOf, type World } from '../world';
import { noteMove } from './elements';
import { spawnPoint } from './production';
import { blocOf } from './supply';

/** Share of each hour a formation marches (rest, forming up, roads): infantry ≈ 29 km/day. */
export const MARCH_DUTY = 0.3;
/**
 * The share of its speed a formation that moves on engines keeps with no supply (PLAN 3.2b):
 * between that and all of it by its supply level. A panzer division of 1938 (12 km/h, the pace
 * of its motorised infantry) goes at 3 without fuel, behind a rifle division's 4. A formation with a manoeuvre element on foot goes at that
 * element's pace, fuel or none.
 */
export const DRY_SPEED = 0.25;
/** A target cell unreachable from the formation snaps to a reachable one within this many cells. */
export const TARGET_SNAP_CELLS = 3;
export const REPATRIATE_CELLS = 80;

/**
 * Whether `holder`'s ground is foreign to `nation`'s formations: a holder that is not of its
 * supply bloc, not at war with it and not fighting beside it. They do not march onto it, and
 * one that stands there idle is sent home.
 */
export function foreignTo(world: World, nation: number, holder: number): boolean {
  return holder !== 0 && holder !== nation && blocOf(world, holder) !== blocOf(world, nation) && !world.wars.atWar(nation, holder) && !world.wars.sameSide(nation, holder);
}

/**
 * The ground a nation's formations may be routed over at this hour (`Passage`). Who orders many
 * formations at once makes it once and hands it to each order.
 */
export function passageOf(world: World, nation: number): Passage {
  const ok = new Uint8Array(world.nations.highWater + 1).fill(1);
  world.nations.forEach((m) => {
    if (foreignTo(world, nation, m)) ok[m] = 0;
  });
  const graph = navOf(world).graph;
  const open = new Uint8Array(graph.nodeCount);
  for (const key of world.heldByNode().keys()) if (ok[key % 65536] === 1) open[Math.floor(key / 65536)] = 1;
  return { ok, holder: world.cells.controller, open, group: nodeGroups(graph, open) };
}

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
  // No saved path (a save from before PLAN 3.4Rl, or the editor dropped them): found again, on
  // the holders of now.
  const route = findRoute(nav.grid, nav.graph, rule.mobility as MobilityId, f.originCell[id]!, f.targetCell[id]!, passageOf(world, f.nation[id]!));
  if (!route) return null;
  p = Int32Array.from(route.cells);
  world.paths.set(id, p);
  return p;
}

/**
 * Applies a move order; returns false (and emits MoveRejected) when no land route exists that
 * keeps off the ground of nations outside the formation's wars.
 */
export function orderMove(world: World, id: number, x: number, y: number, pass?: Passage): boolean {
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
  const route = target < 0 ? null : findRoute(nav.grid, nav.graph, rule.mobility as MobilityId, origin, target, pass ?? passageOf(world, c.nation[id]!));
  if (!route) {
    world.out.emit(world.tick, EventKind.MoveRejected, id, c.nation[id]!, NaN, NaN);
    return false;
  }
  noteMove(world, id);
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
    if (!foreignTo(world, nation, holder)) return;
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
    noteMove(world, id);
    const costRow = MOVE_COST[rule.mobility]!;
    const fuelled = rule.mobility === Mobility.foot ? 1 : DRY_SPEED + (1 - DRY_SPEED) * c.supply[id]!;
    const kmPerHour = rule.speedKmh * MARCH_DUTY * fuelled * Math.max(0.05, 1 + world.buffs.sum('speed', 'nation', c.nation[id]!) + world.buffs.sum('speed', 'formation', id));
    let i = c.pathStep[id]!;
    let frac = c.stepFrac[id]!;
    let budget = 1; // hours this tick
    const nation = c.nation[id]!;
    let barred = false;
    while (budget > 0 && i < path.length - 1) {
      const a = path[i]!;
      const b = path[i + 1]!;
      // Enemy-held ground is entered only once it flips (PLAN 1.14): the advance follows the front.
      const holder = world.cells.controller[b]!;
      if (holder !== 0 && holder !== nation) {
        // Not a formation on the retreat (PLAN 3.5a): it goes back over ground the enemy has taken behind it.
        if (world.wars.atWar(nation, holder) && c.retreat[id] === 0) break;
        // Ground that has become a third nation's since the order: the march ends before it.
        if (holder !== world.cells.controller[a] && foreignTo(world, nation, holder)) {
          barred = true;
          frac = 0;
          break;
        }
      }
      const ay = Math.floor(a / w);
      const by = Math.floor(b / w);
      let dx = (b % w) - (a % w);
      if (dx > 1) dx -= w; // wrap
      if (dx < -1) dx += w;
      const ground = world.cells.terrain[b]!;
      const segHours = (stepKm(nav.grid, by > ay ? ay : by, dx, by - ay) * costRow[ground]!) / (kmPerHour * rule.terrainSpeed[ground]!);
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
    if (barred) {
      c.x[id] = ax;
      c.y[id] = ay;
      c.moving[id] = 0;
      world.paths.delete(id);
      world.out.emit(world.tick, EventKind.MoveRejected, id, nation, NaN, NaN);
      return;
    }
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
    // A step across the seam of a looping map goes the short way: its two ends are a map
    // apart in x. (Not "more than 1 apart": that was the seam's mark while every place was a
    // cell's middle. Two neighbouring cells' land points can be 1.9 apart, and the step was
    // then walked round the world: PLAN 2.11i.)
    if (bx - ax > w / 2) bx -= w;
    else if (ax - bx > w / 2) bx += w;
    const x = ax + (bx - ax) * frac;
    c.x[id] = x < 0 ? x + w : x >= w ? x - w : x;
    c.y[id] = ay + (by - ay) * frac;
    c.facing[id] = atan2(by - ay, bx - ax);
  });
}
