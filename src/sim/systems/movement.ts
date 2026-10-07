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
 * An order to a formation in the middle of a step leaves it where it stands (PLAN 3.5a1): its
 * path begins with that step, on along it or back to the nearer of its two cells.
 *
 * No march across a nation that is not in the war (PLAN 3.4Rl, ADR-149). A formation enters the
 * ground of its own bloc, of a nation it is at war with, of one that fights beside it, and
 * nobody's (`foreignTo`); the route goes round any other nation's, and the order is rejected
 * when there is no way round (for a long march: none by the provinces that have such ground). A formation that stands on such ground (a peace found it there)
 * walks on that holder's cells and out of them: the way home. A march whose next cell has
 * become such ground since the order ends before it (`MoveRejected`).
 *
 * A path outlives a change of the ground (PLAN 3.7k, ADR-171): a paint of terrain, a map import
 * and a change of `loopingMap` leave `world.paths` alone. A step that the ground of now does not
 * allow (water ahead, a corner cut past new water, the seam of a map that loops no more) is not
 * taken: the formation is ordered to its target again from the cell behind it, and halts there
 * if there is no way. A path that is missing is found again from where the formation stands.
 *
 * Repatriation (daily at 00:00; critic B1, 2026-10-03): an idle formation standing on land held
 * by a nation outside its supply bloc that it is neither at war with nor fighting beside
 * (occupied land handed back at a peace, mostly) marches to the nearest cell its own nation controls within REPATRIATE_CELLS, or
 * with none there to its nation's spawn point. Such formations used to
 * stay where the peace found them, out of supply, until attrition had killed them: most of an
 * army that had just won a war.
 *
 * The march home crosses any nation (PLAN 3.7h, ADR-169). This order, and no other, is routed
 * over all ground (`everywhere`), and the formation is marked (`formations.home`): its march does
 * not end before a third nation's cell. It waits before an enemy's as any march does, and it is
 * not fed on the way. Any other order takes the mark away, and so does the march's end. A
 * formation is set on its spawn point only where no land leads home (another landmass): it was
 * set there whenever the way crossed a second nation at peace with it, an army gone from one
 * place and standing in another, 80 times in a year of two seeds.
 */
import { EventKind } from '../../shared/events';
import { atan2 } from '../core/dmath';
import { Mobility, MOVE_COST, stepKm, type MobilityId, type NavGrid, type Passage } from '../nav/grid';
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
 * formations at once makes it once and hands it to each order. `shared`: the passages made in
 * this hour by whoever asks for several nations, by the holders that are open; a nation with
 * the same ones gets the same object (PLAN 3.5b).
 */
export function passageOf(world: World, nation: number, shared?: Map<string, Passage>): Passage {
  const ok = new Uint8Array(world.nations.highWater + 1).fill(1);
  world.nations.forEach((m) => {
    if (foreignTo(world, nation, m)) ok[m] = 0;
  });
  const key = shared ? ok.join('') : '';
  const made = shared?.get(key);
  if (made) return made;
  const graph = navOf(world).graph;
  const open = new Uint8Array(graph.nodeCount);
  for (const key of world.heldByNode().keys()) if (ok[key % 65536] === 1) open[Math.floor(key / 65536)] = 1;
  const pass = { ok, holder: world.cells.controller, open, group: nodeGroups(graph, open) };
  shared?.set(key, pass);
  return pass;
}

/** The ground of a march home (ADR-169): every holder's. No order of an AI or a player has it. */
function everywhere(world: World): Passage {
  return { ok: new Uint8Array(world.nations.highWater + 1).fill(1), holder: world.cells.controller };
}

/** Where a formation stands in a cell of its path: the middle, or the cell's land point (PLAN 2.9a). */
function centre(world: World, cell: number): [number, number] {
  return world.cellPoint(cell);
}

/**
 * Path of a moving formation. One that is missing (a save from before PLAN 3.4Rl) is found
 * again on the holders of now, from the cell the formation stands in: the steps it had counted
 * were along the path that is gone (PLAN 3.7k), so they begin again with the new one.
 */
export function formationPath(world: World, id: number): Int32Array | null {
  let p = world.paths.get(id);
  if (p) return p;
  const f = world.formations.cols;
  const rule = world.rules?.templates[f.template[id]!];
  if (!rule) return null;
  const nav = navOf(world);
  const from = Math.floor(f.y[id]!) * world.cells.w + Math.floor(f.x[id]!);
  const route = findRoute(nav.grid, nav.graph, rule.mobility as MobilityId, from, f.targetCell[id]!, f.home[id] === 1 ? everywhere(world) : passageOf(world, f.nation[id]!));
  if (!route) return null;
  p = Int32Array.from(route.cells);
  f.originCell[id] = from;
  f.pathStep[id] = 0;
  f.stepFrac[id] = 0;
  world.paths.set(id, p);
  return p;
}

/**
 * Whether the step from the cell `a` to its neighbour `b` on a path can be taken on the ground
 * of now (PLAN 3.7k): `b` is no water, a diagonal step cuts no corner past water (as `findPath`
 * has it), and the step does not cross the seam of a map with edges.
 */
function stepOpen(grid: NavGrid, costRow: Float64Array, a: number, b: number): boolean {
  const { w, terrain } = grid;
  const passable = (c: number): boolean => Number.isFinite(costRow[terrain[c]!]!);
  if (!passable(b)) return false;
  const ax = a % w;
  const bx = b % w;
  if (ax === bx) return true;
  if (Math.abs(bx - ax) > 1 && !grid.wrapX) return false;
  return a - ax === b - bx || (passable(a - ax + bx) && passable(b - bx + ax));
}

/**
 * The cell an order from the cell `origin` to the cell (tx, ty) goes to: the target itself, or,
 * for one on a coastal speck or across a sea with no strait, the nearest cell of the origin's
 * landmass within TARGET_SNAP_CELLS (-1: none, and the order is refused). With `mayReach` it
 * is what `orderMove` asks before it searches; the operational AI asks the same before it
 * allots (PLAN 3.5b).
 */
export function snapTarget(world: World, origin: number, tx: number, ty: number): number {
  const grid = navOf(world).grid;
  const comp = grid.component;
  const { w, h } = world.cells;
  const from = comp[origin]!;
  const target = ty * w + tx;
  if (from !== 0 && comp[target] === from) return target;
  // By landmass and target: the land does not change, and a planner asks again every day.
  let snaps = SNAPS.get(grid);
  if (!snaps) SNAPS.set(grid, (snaps = new Map()));
  const key = from * w * h + target;
  let to = snaps.get(key);
  if (to === undefined) snaps.set(key, (to = nearestCellWhere((k) => comp[k] !== 0 && comp[k] === from, tx + 0.5, ty + 0.5, w, h, TARGET_SNAP_CELLS)));
  return to;
}
const SNAPS = new WeakMap<object, Map<number, number>>();

/**
 * Applies a move order; returns false (and emits MoveRejected) when no land route exists that
 * keeps off the ground of nations outside the formation's wars.
 */
export function orderMove(world: World, id: number, x: number, y: number, pass?: Passage): boolean {
  return order(world, id, x, y, pass, 0);
}

/** `orderMove`, or with `home` 1 the order of a march home, over any ground (ADR-169). */
function order(world: World, id: number, x: number, y: number, pass: Passage | undefined, home: 0 | 1): boolean {
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
  // In the middle of a step (PLAN 3.5a1) the route begins at the step's nearer end, and the
  // formation walks there from where it stands; `beyond` is the step's other end.
  const was = c.moving[id] === 1 && c.stepFrac[id]! > 0 ? world.paths.get(id) : undefined;
  const at = c.pathStep[id]!;
  const frac = c.stepFrac[id]!;
  const mid = was !== undefined && at < was.length - 1;
  const origin = mid ? was[frac < 0.5 ? at : at + 1]! : Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!);
  const beyond = mid ? was[frac < 0.5 ? at + 1 : at]! : -1;
  const nav = navOf(world);
  const target = snapTarget(world, origin, tx, ty);
  const route = target < 0 ? null : findRoute(nav.grid, nav.graph, rule.mobility as MobilityId, origin, target, home === 1 ? everywhere(world) : (pass ?? passageOf(world, c.nation[id]!)));
  if (!route) {
    world.out.emit(world.tick, EventKind.MoveRejected, id, c.nation[id]!, NaN, NaN);
    return false;
  }
  noteMove(world, id);
  c.moving[id] = 1;
  c.home[id] = home;
  c.targetCell[id] = target;
  c.pathStep[id] = 0;
  if (mid) {
    // The same step, read from the first cell of the new path: on along it if the route goes
    // by the other end, else back to the nearer end and on from there. Its place is the same.
    const onward = route.cells[1] === beyond;
    const cells = onward ? route.cells : [beyond, ...route.cells];
    c.originCell[id] = cells[0]!;
    c.stepFrac[id] = onward === frac < 0.5 ? frac : 1 - frac;
    world.paths.set(id, Int32Array.from(cells));
    return true;
  }
  c.originCell[id] = origin;
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
    if (home >= 0 && order(world, id, (home % w) + 0.5, Math.floor(home / w) + 0.5, undefined, 1)) return;
    const at = spawnPoint(world, nation);
    if (!at) return;
    // Further from home than that: to the spawn point on foot, if land leads there.
    if (comp[Math.floor(at[1]) * w + Math.floor(at[0])] === comp[cell] && order(world, id, at[0], at[1], undefined, 1)) return;
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
      c.home[id] = 0;
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
    let shut = false;
    while (budget > 0 && i < path.length - 1) {
      const a = path[i]!;
      const b = path[i + 1]!;
      // The ground has changed under the path (PLAN 3.7k): this step is not one any more.
      if (!stepOpen(nav.grid, costRow, a, b)) {
        shut = true;
        frac = 0;
        break;
      }
      // Enemy-held ground is entered only once it flips (PLAN 1.14): the advance follows the front.
      const holder = world.cells.controller[b]!;
      if (holder !== 0 && holder !== nation) {
        // Not a formation on the retreat (PLAN 3.5a): it goes back over ground the enemy has taken behind it.
        if (world.wars.atWar(nation, holder) && c.retreat[id] === 0) break;
        // Ground that has become a third nation's since the order: the march ends before it.
        // Not a march home (ADR-169): that one crosses it.
        if (c.home[id] === 0 && holder !== world.cells.controller[a] && foreignTo(world, nation, holder)) {
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
    if (shut) {
      // From the cell behind it, to where it was going, by the ground of now; or it halts there.
      const to = c.targetCell[id]!;
      c.x[id] = ax;
      c.y[id] = ay;
      c.moving[id] = 0;
      world.paths.delete(id);
      // The same order: a march home stays one.
      const home = c.home[id] === 1 ? 1 : 0;
      c.home[id] = 0;
      order(world, id, (to % w) + 0.5, Math.floor(to / w) + 0.5, undefined, home);
      return;
    }
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
      c.home[id] = 0;
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
