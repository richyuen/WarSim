/**
 * A fleet sails (PLAN 4.2c, SPEC §3.6): `orderSail` and the hour's step of a fleet under way.
 *
 * An order is to water, or to a port (its land cell: the fleet goes to the port's water, the
 * cell of its node of the lane graph). The way is found once, at the order (`sailRoute`: over
 * the lanes, drawn tight), from the cell the fleet stands in, and is kept as a march's path is:
 * `world.paths`, with `moving`, `originCell`, `targetCell`, `pathStep` and `stepFrac` of the
 * formation, so it is saved and hashed as a march is. No rule of the march reads it: the
 * movement system hands a fleet to `sailStep`.
 *
 * The pace is the slowest ship's top speed × `CRUISE_SHARE`, every hour of the day, whatever
 * the water; the time of a step is its km (`sailStepKm`) over that. A passage is one step, of
 * the great circle between its ends, and the fleet is drawn over its land for those hours.
 * The place is on the straight line between the two cells' water points (`World.seaPoint`).
 *
 * The seas that ice closes (PLAN 4.2d, `data/maps/<map>/ice.json`) are in no way and take no
 * order. A passage whose bank (`passageBank`) a nation at war with the fleet's holds is shut to
 * it when its way is found (PLAN 4.4e); a way found before keeps it. An enemy's fleet in the way
 * meets it in a sea battle (PLAN 4.3).
 *
 * Water made land under the way (the editor): the fleet stops in the cell before it and is
 * ordered to where it was going again, or stands there with no way.
 */
import { EventKind } from '../../shared/events';
import { isLand } from '../../shared/terrain';
import { atan2 } from '../core/dmath';
import { sailRoute, sailStepKm } from '../nav/sailRoute';
import { Domain, laneOf, navOf, seaOf, type World } from '../world';
import { noteMove } from './elements';
import { passageShut } from './seaSupply';

/**
 * The share of its slowest ship's top speed a fleet sails at (PLAN 4.2c, ADR-250): a battle
 * squadron of 50 km/h (27 knots) at 27.5 (15 knots), a flotilla of destroyers at 36 (19), the
 * submarines and transports at 16.5 (9): the cruising speeds of 1938, about.
 */
export const CRUISE_SHARE = 0.55;

/** The pace of fleet `id` now, km/h. */
export function sailKmh(world: World, id: number): number {
  const c = world.formations.cols;
  const rule = world.rules?.templates[c.template[id]!];
  if (!rule) return 0;
  return rule.speedKmh * CRUISE_SHARE * Math.max(0.05, 1 + world.buffs.sum('speed', 'nation', c.nation[id]!) + world.buffs.sum('speed', 'formation', id));
}

/** Where a fleet is in `cell`: its water point, or its middle where the fine mask has no water in it (a crossing). */
export function waterOf(world: World, cell: number): [number, number] {
  const w = world.cells.w;
  return world.seaPoint(cell) ?? [(cell % w) + 0.5, Math.floor(cell / w) + 0.5];
}

/** Where a fleet is that has done `frac` of the step from the cell `a` to the cell `b`, and the way it faces. */
export function sailPlace(world: World, a: number, b: number, frac: number): [number, number, number] {
  const w = world.cells.w;
  const [ax, ay] = waterOf(world, a);
  const [tx, by] = waterOf(world, b);
  let bx = tx;
  // Over the seam of a looping map the short way.
  if (world.settings.loopingMap) {
    if (bx - ax > w / 2) bx -= w;
    else if (ax - bx > w / 2) bx += w;
  }
  const x = ax + (bx - ax) * frac;
  return [x < 0 ? x + w : x >= w ? x - w : x, ay + (by - ay) * frac, atan2(by - ay, bx - ax)];
}

/**
 * The water cell an order to (`tx`, `ty`) sends a fleet to: that cell where it is water with a
 * zone; the water of a port that stands in it; else -1. Water in the ice is a target, and no
 * way leads to it (`sailRoute`).
 */
export function sailTarget(world: World, tx: number, ty: number): number {
  const { w, h, terrain } = world.cells;
  if (ty < 0 || ty >= h || tx < 0 || tx >= w) return -1;
  const cell = ty * w + tx;
  if (!isLand(terrain[cell]!)) return seaOf(world).zoneOf[cell] === 0 ? -1 : cell;
  const lanes = laneOf(world);
  for (let i = 0; i < world.ports.length; i++) {
    if (world.ports[i]!.cell === cell && lanes.portNode[i]! >= 0) return lanes.cell[lanes.portNode[i]!]!;
  }
  return -1;
}

/** Orders fleet `id` to (`x`, `y`), in cells; false (and `MoveRejected`) for no fleet, a place that is no water and no port, and water no lane leads to. */
export function orderSail(world: World, id: number, x: number, y: number): boolean {
  const f = world.formations;
  const c = f.cols;
  const w = world.cells.w;
  const rule = f.has(id) ? world.rules?.templates[c.template[id]!] : undefined;
  const reject = (): boolean => {
    world.out.emit(world.tick, EventKind.MoveRejected, id, rule ? c.nation[id]! : 0, NaN, NaN);
    return false;
  };
  if (!rule || rule.domain !== Domain.sea) return reject();
  const target = sailTarget(world, Math.floor(x), Math.floor(y));
  if (target < 0) return reject();
  // Under way and in the middle of a step, it stays where it is: the way begins at the nearer
  // end of the step, by the other end or back from it (as a march's does, PLAN 3.5a1).
  const was = c.moving[id] === 1 && c.stepFrac[id]! > 0 ? world.paths.get(id) : undefined;
  const at = c.pathStep[id]!;
  const frac = c.stepFrac[id]!;
  const mid = was !== undefined && at < was.length - 1;
  const near = frac < 0.5;
  const origin = mid ? was[near ? at : at + 1]! : Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!);
  const beyond = mid ? was[near ? at + 1 : at]! : -1;
  // A passage whose bank an enemy of the fleet holds is shut to it (PLAN 4.4e).
  const lanes = laneOf(world);
  const nation = c.nation[id]!;
  const shut = (e: number): boolean => lanes.edges[e]!.passage >= 0 && passageShut(world, lanes.edges[e]!.passage, nation);
  const route = sailRoute(navOf(world).grid, seaOf(world), lanes, origin, target, shut);
  if (!route) return reject();
  noteMove(world, id);
  c.moving[id] = 1;
  c.home[id] = 0;
  c.targetCell[id] = target;
  c.pathStep[id] = 0;
  if (mid) {
    const onward = route.cells[1] === beyond;
    const cells = onward ? route.cells : Int32Array.of(beyond, ...route.cells);
    c.originCell[id] = cells[0]!;
    c.stepFrac[id] = onward === near ? frac : 1 - frac;
    world.paths.set(id, cells);
    return true;
  }
  c.originCell[id] = origin;
  c.stepFrac[id] = 0;
  world.paths.set(id, route.cells);
  [c.x[id], c.y[id]] = waterOf(world, origin);
  return true;
}

/** The hour of a fleet under way (`movementSystem` calls it for a formation that is afloat and `moving`). */
export function sailStep(world: World, id: number): void {
  const c = world.formations.cols;
  const path = world.paths.get(id);
  const kmh = sailKmh(world, id);
  if (!path || kmh <= 0) {
    c.moving[id] = 0;
    world.paths.delete(id);
    return;
  }
  noteMove(world, id);
  const grid = navOf(world).grid;
  const terrain = world.cells.terrain;
  let i = c.pathStep[id]!;
  let frac = c.stepFrac[id]!;
  let budget = 1; // hours this tick
  let shut = false;
  while (budget > 0 && i < path.length - 1) {
    const a = path[i]!;
    const b = path[i + 1]!;
    if (isLand(terrain[b]!)) {
      shut = true;
      frac = 0;
      break;
    }
    const hours = sailStepKm(grid, a, b) / kmh;
    const left = hours * (1 - frac);
    if (budget >= left) {
      budget -= left;
      i++;
      frac = 0;
    } else {
      frac += budget / hours;
      budget = 0;
    }
  }
  c.pathStep[id] = i;
  c.stepFrac[id] = frac;
  if (shut || i >= path.length - 1) {
    const [x, y] = waterOf(world, path[i]!);
    c.x[id] = x;
    c.y[id] = y;
    c.moving[id] = 0;
    world.paths.delete(id);
    if (shut) {
      const w = world.cells.w;
      const to = c.targetCell[id]!;
      orderSail(world, id, (to % w) + 0.5, Math.floor(to / w) + 0.5);
    } else world.out.emit(world.tick, EventKind.FormationArrived, id, c.nation[id]!, x, y);
    return;
  }
  const [x, y, facing] = sailPlace(world, path[i]!, path[i + 1]!, frac);
  c.x[id] = x;
  c.y[id] = y;
  c.facing[id] = facing;
}
