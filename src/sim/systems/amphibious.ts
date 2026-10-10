/**
 * Amphibious movement (PLAN 4.5a, SPEC §6.2): a land formation embarks on its nation's transports
 * at a port, sails with them, and lands on the coast its order was for.
 *
 * The order (`orderLanding`, from `orderMove` when the target is on another land than the
 * formation's): the formation stands at a port its nation holds (its water within
 * `AT_PORT_CELLS` of the formation's cell), and a transport group of its nation stands there
 * too, not under way, with room for it (`TRANSPORT_MEN` men a transport, less what it carries).
 * The landing is at the land cell of the target's land nearest to the zoned water nearest the
 * target (its `water`); the transports are ordered there (`orderSail`). The formation is then
 * embarked (`World.embarked`, state): `World.afloat` is true of it, so no rule of the land reads
 * it (supply, contact, the fronts, the AI), and it is where its transports are.
 *
 * Hourly after the movement (`amphibiousSystem`): an embarked formation is at its transports'
 * place. When they stand at the landing water it lands: at the landing cell, its org at most
 * `LANDING_ORG`, and ordered on to its target if that is another cell. When they stand anywhere
 * else (broken off from a sea battle, PLAN 4.3c, at a port of their own) it lands at the land
 * nearest them within `AT_PORT_CELLS`, if any, and stays aboard otherwise. Transports that are gone
 * (sunk) take the formation with them.
 *
 * A landing needs the sea (PLAN 4.5b): when the transports stand at the landing water and the
 * zone of that water is held by a bloc at war with the formation's nation (`seaHolder`, PLAN
 * 4.4a), the landing is thrown back (`LandingRepulsed`): the transports sail for their nation's
 * nearest port (`sailHome`) and the formation lands where they stand next. A formation that
 * lands on a cell held by a nation at war with its own takes it (the beachhead): the front
 * spreads only from held land (`territorySystem`), so without it a landing took nothing. The landing's
 * penalty in a fight is its disorder: a formation fires by its org (`ORG_FIRE`), at 0.625 of
 * its fire with `LANDING_ORG`, and recovers it as any formation.
 *
 * Not here: the bombardment (PLAN 4.5c); the AI's invasions (PLAN 4.6).
 */
import { EventKind } from '../../shared/events';
import { isLand } from '../../shared/terrain';
import { nearestCellWhere } from '../data/ownership';
import { navOf, portSeaOf, seaOf, type World } from '../world';
import { destroyFormation, elementIndex } from './elements';
import { AT_PORT_CELLS, sailHome } from './navalCombat';
import { orderMove } from './movement';
import { orderSail } from './sail';
import { seaHolder } from './seaControl';

/** Men a transport carries. A transport group's 12 carry 24,000: two infantry divisions of 1938. */
export const TRANSPORT_MEN = 2000;
/** The org a formation has at most when it has landed (PLAN 4.5a): a landing leaves it in disorder. */
export const LANDING_ORG = 0.5;
/** How far, in cells, the landing's water is looked for from the target. */
const LANDING_REACH = 8;

/** An embarked formation: its transports, the land cell it lands at, the water there, the cell its order was for. */
export interface Embarked {
  fleet: number;
  land: number;
  water: number;
  target: number;
}

/** Men the transports of fleet `fleet` carry at most. */
export function transportRoom(world: World, fleet: number): number {
  const units = world.rules!.units;
  const ec = world.elements.cols;
  let n = 0;
  for (const e of elementIndex(world).get(fleet) ?? []) if (units[ec.unit[e]!]!.cls === 'tp') n += ec.strength[e]!;
  return n * TRANSPORT_MEN;
}

/** Men aboard fleet `fleet` now. */
function aboard(world: World, fleet: number): number {
  let men = 0;
  for (const [id, e] of world.embarked) if (e.fleet === fleet) men += world.formations.cols.strength[id]!;
  return men;
}

const cellOfPlace = (world: World, id: number): number => Math.floor(world.formations.cols.y[id]!) * world.cells.w + Math.floor(world.formations.cols.x[id]!);
const near = (world: World, a: number, b: number, r: number): boolean => {
  const w = world.cells.w;
  let dx = Math.abs((a % w) - (b % w));
  if (world.settings.loopingMap && dx > w / 2) dx = w - dx;
  return dx <= r && Math.abs(Math.floor(a / w) - Math.floor(b / w)) <= r;
};

/**
 * Orders land formation `id` across the sea to (`x`, `y`) (see the head of the file); false where
 * it is at no port of its nation, no transport of its nation there has room, the target has no
 * water near it, or the transports have no way there. Nothing is changed then.
 */
export function orderLanding(world: World, id: number, x: number, y: number): boolean {
  const f = world.formations;
  const c = f.cols;
  if (!f.has(id) || world.afloat(id) || !world.rules) return false;
  const { w, h, terrain } = world.cells;
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || tx >= w || ty < 0 || ty >= h) return false;
  const target = ty * w + tx;
  const nation = c.nation[id]!;
  const here = cellOfPlace(world, id);
  // A port of its nation it stands at.
  const water = portSeaOf(world);
  let port = -1;
  world.ports.forEach((p, i) => {
    if (port < 0 && water[i]! >= 0 && world.cells.controller[p.cell] === nation && near(world, here, water[i]!, AT_PORT_CELLS)) port = i;
  });
  if (port < 0) return false;
  // Transports of its nation there, standing, with room.
  const men = c.strength[id]!;
  let fleet = 0;
  f.forEach((o) => {
    if (fleet !== 0 || !world.isFleet(o) || c.nation[o] !== nation || c.moving[o] === 1 || c.engaged[o] === 1) return;
    if (!near(world, cellOfPlace(world, o), water[port]!, AT_PORT_CELLS)) return;
    if (transportRoom(world, o) - aboard(world, o) >= men) fleet = o;
  });
  if (fleet === 0) return false;
  // The landing: the zoned water nearest the target, and the land of the target's nearest to it.
  const z = seaOf(world);
  const comp = navOf(world).grid.component;
  const targetComp = comp[target]!;
  if (!isLand(terrain[target]!) || targetComp === 0) return false;
  const sea = nearestCellWhere((k) => z.zoneOf[k] !== 0 && z.closed[z.zoneOf[k]!] !== 1, tx + 0.5, ty + 0.5, w, h, LANDING_REACH, world.settings.loopingMap);
  if (sea < 0) return false;
  const land = nearestCellWhere((k) => comp[k] === targetComp, (sea % w) + 0.5, Math.floor(sea / w) + 0.5, w, h, LANDING_REACH, world.settings.loopingMap);
  if (land < 0) return false;
  if (!orderSail(world, fleet, (sea % w) + 0.5, Math.floor(sea / w) + 0.5)) return false;
  world.embarked.set(id, { fleet, land, water: sea, target });
  c.moving[id] = 0;
  c.home[id] = 0;
  world.paths.delete(id);
  c.x[id] = c.x[fleet]!;
  c.y[id] = c.y[fleet]!;
  world.out.emit(world.tick, EventKind.FormationEmbarked, id, nation, c.x[id]!, c.y[id]!);
  return true;
}

/** Lands embarked formation `id` at land cell `cell`. */
function land(world: World, id: number, cell: number, target: number): void {
  const c = world.formations.cols;
  world.embarked.delete(id);
  [c.x[id], c.y[id]] = world.cellPoint(cell);
  c.org[id] = Math.min(c.org[id]!, LANDING_ORG);
  // The beachhead (PLAN 4.5b): an enemy's cell it lands on is its nation's, for the front to spread from.
  const held = world.cells.controller[cell]!;
  if (held !== 0 && world.wars.atWar(held, c.nation[id]!)) world.setController(cell, c.nation[id]!);
  world.out.emit(world.tick, EventKind.FormationLanded, id, c.nation[id]!, c.x[id]!, c.y[id]!);
  if (target !== cell) {
    const w = world.cells.w;
    // On to its target over the land it stands on, as any march.
    orderMove(world, id, (target % w) + 0.5, Math.floor(target / w) + 0.5);
  }
}

export function amphibiousSystem(world: World): void {
  if (world.embarked.size === 0) return;
  const f = world.formations;
  const c = f.cols;
  const { terrain } = world.cells;
  const w = world.cells.w;
  for (const [id, e] of [...world.embarked].sort((a, b) => a[0] - b[0])) {
    if (!f.has(id)) {
      world.embarked.delete(id);
      continue;
    }
    if (!f.has(e.fleet)) {
      // Its transports sunk: lost at sea with them.
      world.embarked.delete(id);
      destroyFormation(world, id);
      continue;
    }
    c.x[id] = c.x[e.fleet]!;
    c.y[id] = c.y[e.fleet]!;
    if (c.moving[e.fleet] === 1 || c.engaged[e.fleet] === 1) continue;
    const at = cellOfPlace(world, e.fleet);
    if (at === e.water) {
      // The sea about the landing held by an enemy (PLAN 4.5b): thrown back, home with the transports.
      const holder = seaHolder(world, seaOf(world).zoneOf[e.water]!);
      if (holder !== 0 && world.wars.atWar(holder, c.nation[id]!)) {
        e.water = -1;
        e.land = -1;
        world.out.emit(world.tick, EventKind.LandingRepulsed, id, holder, c.x[id]!, c.y[id]!);
        sailHome(world, e.fleet);
        continue;
      }
      land(world, id, e.land, e.target);
      continue;
    }
    // Stood elsewhere: ashore at the land nearest, of any holder of its side or none.
    const ashore = nearestCellWhere((k) => isLand(terrain[k]!) && navOf(world).grid.component[k] !== 0, (at % w) + 0.5, Math.floor(at / w) + 0.5, w, world.cells.h, AT_PORT_CELLS, world.settings.loopingMap);
    if (ashore >= 0) land(world, id, ashore, ashore);
  }
}
