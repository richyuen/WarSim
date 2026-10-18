import { Refusal } from '../shared/commands';
import { airbaseRoom } from './data/airbases';
import { nearestCellWhere } from './data/ownership';
import { BASE_PICK_CELLS, wingAircraft } from './systems/air';
import { equipFormation } from './systems/elements';
import { Domain, seaOf, type World } from './world';

/**
 * A fleet or an air wing set down by the editor (PLAN 7.13a; critic run 7: "warheads, fleets,
 * airbases and wings still cannot be placed, so a scenario cannot set up a nuclear standoff or a
 * navy"). Whole and in supply, as the start's (`addFleets`, `addWings`) and production's.
 */

/** Whether template `t` of the world's rules is of `domain`. */
function ofDomain(world: World, t: number, domain: number): boolean {
  return (world.rules?.templates[t]?.domain ?? -1) === domain;
}

/** A new formation of `nation` and template `t` at (x, y), equipped. */
function make(world: World, nation: number, t: number, x: number, y: number): number {
  const f = world.formations;
  const id = f.create();
  f.cols.nation[id] = nation;
  f.cols.x[id] = x;
  f.cols.y[id] = y;
  f.cols.facing[id] = 0;
  f.cols.template[id] = t;
  f.cols.supply[id] = 1;
  f.cols.org[id] = 1;
  equipFormation(world, id, t); // elements and strength
  return id;
}

/**
 * A fleet of `nation`, sea template `t`, at the water nearest (x, y) within BASE_PICK_CELLS (at
 * the map's size) that is of a sea zone, at its water point (`World.seaPoint`): the click may fall
 * on the coast beside it. Refused for a template not of the sea and for a place with no such water.
 */
export function placeFleet(world: World, nation: number, t: number, x: number, y: number): Refusal {
  if (!ofDomain(world, t, Domain.sea)) return Refusal.NoSuch;
  const { w, h } = world.cells;
  const zone = seaOf(world).zoneOf;
  const cell = nearestCellWhere((c) => zone[c] !== 0 && world.seaPoint(c) !== null, x, y, w, h, Math.ceil(world.atSize(BASE_PICK_CELLS)), world.settings.loopingMap);
  if (cell < 0) return Refusal.NotAtSea;
  const [px, py] = world.seaPoint(cell)!;
  // It holds its place (PLAN 7.22c; critic run 8: "placed fleets wander away at once").
  world.station.set(make(world, nation, t, px, py), [px, py]);
  return Refusal.None;
}

/**
 * An air wing of `nation`, air template `t`, at the airbase nearest (x, y) within BASE_PICK_CELLS
 * (at the map's size) that `nation` controls and that has room for its aircraft beside the wings
 * based there (`airbaseRoom`). Refused for a template not of the air and where no base takes it.
 */
export function placeWing(world: World, nation: number, t: number, x: number, y: number): Refusal {
  if (!ofDomain(world, t, Domain.air)) return Refusal.NoSuch;
  const need = wingAircraft(world, t);
  const used = new Map<number, number>();
  for (const [o, b] of world.wingBase) if (b > 0) used.set(b, (used.get(b) ?? 0) + wingAircraft(world, world.formations.cols.template[o]!));
  const reach = world.atSize(BASE_PICK_CELLS);
  const { w } = world.cells;
  let best = -1;
  let bd = Infinity;
  world.airbases.forEach((b, i) => {
    if (world.cells.controller[b.cell] !== nation || (used.get(i + 1) ?? 0) + need > airbaseRoom(b)) return;
    const [bx, by] = world.cellPoint(b.cell);
    let dx = Math.abs(bx - x);
    if (world.settings.loopingMap) dx = Math.min(dx, w - dx);
    const dy = Math.abs(by - y);
    if (dx > reach + 0.5 || dy > reach + 0.5) return;
    const d = dx * dx + dy * dy;
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  if (best < 0) return Refusal.NoAirbase;
  const id = make(world, nation, t, ...world.cellPoint(world.airbases[best]!.cell));
  world.wingBase.set(id, best + 1);
  return Refusal.None;
}
