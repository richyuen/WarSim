/**
 * Amphibious movement (PLAN 4.5a, SPEC §6.2): a land formation embarks on its nation's transports
 * at a port, sails with them, and lands on the coast its order was for.
 *
 * The order (`orderLanding`, from `orderMove` when the target is on another land than the
 * formation's): the formation stands at a port its nation holds (its water within
 * `AT_PORT_CELLS` of the formation's cell), and a transport group of its nation stands there
 * too, not under way, with room for it (`TRANSPORT_MEN` men a transport, less what it carries).
 * The landing is at the land cell of the target's land nearest to the zoned water nearest the
 * target (its `water`), one a nation owns where the target is owned (PLAN 4.6b); the
 * transports are ordered there (`orderSail`). The formation is then
 * embarked (`World.embarked`, state): `World.afloat` is true of it, so no rule of the land reads
 * it (supply, contact, the fronts, the AI), and it is where its transports are.
 *
 * Hourly after the movement (`amphibiousSystem`): an embarked formation is at its transports'
 * place. When they stand at the landing water it lands: at the landing cell, its org at most
 * `LANDING_ORG`, and ordered on to its target if that is another cell. When they stand anywhere
 * else (broken off from a sea battle, PLAN 4.3c, at a port of their own) it lands at the land
 * nearest them within `AT_PORT_CELLS` of its side or no one's (`strayLanding`, PLAN 4.8n), if
 * any, and stays aboard otherwise. Transports that are gone
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
import { EventKind, RejectReason } from '../../shared/events';
import { isLand } from '../../shared/terrain';
import { nearestCellWhere } from '../data/ownership';
import { FlipCause, navOf, portSeaOf, seaOf, seaRangeOf, type World } from '../world';
import { destroyFormation, elementIndex } from './elements';
import { AT_PORT_CELLS, sailHome } from './navalCombat';
import { orderMove } from './movement';
import { portShut } from './bombing';
import { orderSail } from './sail';
import { seaHolder } from './seaControl';
import { blocOf } from './supply';

/**
 * Men a transport carries. A transport group's 12 carry 25,200: two infantry divisions of 1938
 * (12,460 each, `infantry_div` at full strength) with 280 to spare (PLAN 7.90d, ADR-647). Before,
 * 2,000: the group's 24,000 took one such division a trip, half what it was set for.
 */
export const TRANSPORT_MEN = 2100;
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
/**
 * The transport groups of nation `n` standing at a port it holds (as `invasion.ts`'s `transportsAtPort` takes
 * them): fleet, room, port index; the most room first, the lower id on a tie.
 */
export function transportGroupsAtPort(world: World, n: number): { fleet: number; room: number; port: number }[] {
  const c = world.formations.cols;
  const w = world.cells.w;
  const water = portSeaOf(world);
  const ctl = world.cells.controller;
  const out: { fleet: number; room: number; port: number }[] = [];
  world.formations.forEach((id) => {
    if (c.nation[id] !== n || !world.isFleet(id) || c.moving[id] === 1 || c.engaged[id] === 1 || seaRangeOf(world, id) !== undefined) return;
    const room = transportRoom(world, id);
    if (room <= 0) return;
    const at = Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!);
    const port = world.ports.findIndex((p, k) => water[k]! >= 0 && ctl[p.cell] === n && near(world, at, water[k]!, world.atSize(AT_PORT_CELLS)));
    if (port >= 0) out.push({ fleet: id, room, port });
  });
  return out.sort((a, b) => b.room - a.room || a.fleet - b.fleet);
}

/**
 * Whether a formation on `cell` stands at a port, anyone's, shut or not (those `tryLanding` looks
 * for, their holders aside): where it does not, an order over the sea from there is refused the
 * sea (`NoPort`) whoever holds what, and is a march over its land (PLAN 1.42g).
 */
export function atAnyPort(world: World, cell: number): boolean {
  const water = portSeaOf(world);
  const r = world.atSize(AT_PORT_CELLS);
  return world.ports.some((p, i) => water[i]! >= 0 && (near(world, cell, p.cell, r) || near(world, cell, water[i]!, r)));
}

/**
 * Of a nation's formations `ids`, the land cells of the ports its nation holds at which one of its
 * transport groups stands (not under way, with room; its water within `AT_PORT_CELLS` of the
 * group): where the invasion AI sends its formations to go aboard (`sendToPort`, PLAN 7.56a).
 */
export function transportPorts(world: World, ids: readonly number[]): number[] {
  const c = world.formations.cols;
  const w = world.cells.w;
  const water = portSeaOf(world);
  const r = world.atSize(AT_PORT_CELLS);
  const cells: number[] = [];
  for (const id of ids) {
    if (!world.isFleet(id) || c.moving[id] === 1 || transportRoom(world, id) <= 0) continue;
    const at = Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!);
    const i = world.ports.findIndex((p, k) => water[k]! >= 0 && world.cells.controller[p.cell] === c.nation[id] && near(world, at, water[k]!, r));
    if (i >= 0 && !cells.includes(world.ports[i]!.cell)) cells.push(world.ports[i]!.cell);
  }
  return cells;
}

/** Whether land formation `id` is on the march to one of the port cells `ports` (`transportPorts`): its target within `AT_PORT_CELLS` of it. */
export function marchingToPort(world: World, id: number, ports: readonly number[]): boolean {
  const c = world.formations.cols;
  if (c.moving[id] !== 1) return false;
  const r = world.atSize(AT_PORT_CELLS);
  return ports.some((p) => near(world, c.targetCell[id]!, p, r));
}

/** Whether cells a and b lie within r cells of each other on both axes (the map's loop taken). */
export const near = (world: World, a: number, b: number, r: number): boolean => {
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
export function orderLanding(world: World, id: number, x: number, y: number, via = 0): boolean {
  return tryLanding(world, id, x, y, via) === 0;
}

/**
 * `orderLanding`, with why it refused (`RejectReason`, PLAN 4.9a); 0 when ordered. `via`: the
 * transport group to take it, and no other (PLAN 7.90g, ADR-649), which may be under way already
 * when it carries a formation embarked on it (a group going aboard one after another in one hour,
 * PLAN 7.70b: the first's order sets the transports sailing, and the standing test refused the
 * rest; every landing and ferry trip of the invasion AI passes its group, PLAN 7.72, ADR-625).
 * Before PLAN 7.90g, `via` was one more group the search might take: with `via` full, the next
 * formation went on another group standing at the port and set it sailing with it alone (critic
 * run 12, 1129 year 10: four divisions at Norfolk aboard three groups, 2 / 1 / 1; 6421 year 20: 21
 * groups at Norfolk sailed with one each on one turn).
 */
export function tryLanding(world: World, id: number, x: number, y: number, via = 0): 0 | RejectReason {
  const f = world.formations;
  const c = f.cols;
  if (!f.has(id) || world.afloat(id) || !world.rules) return world.afloat(id) ? RejectReason.Aboard : RejectReason.NotLand;
  // Transports carry the land's formations alone: no air wing (PLAN 5.8o).
  if (world.isWing(id)) return RejectReason.NotLand;
  const { w, h, terrain } = world.cells;
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || tx >= w || ty < 0 || ty >= h) return RejectReason.NotLand;
  const target = ty * w + tx;
  const nation = c.nation[id]!;
  const here = cellOfPlace(world, id);
  // A port of its nation it stands at.
  const water = portSeaOf(world);
  // At the port: by its land cell or by its water (PLAN 4.9b: London's water is 7.5 cells down
  // the Thames). Of the ports it stands at, the first with transports for it.
  const at: number[] = [];
  world.ports.forEach((p, i) => {
    if (water[i]! >= 0 && world.cells.controller[p.cell] === nation && !portShut(world, i) && (near(world, here, p.cell, world.atSize(AT_PORT_CELLS)) || near(world, here, water[i]!, world.atSize(AT_PORT_CELLS)))) at.push(i);
  });
  if (at.length === 0) return RejectReason.NoPort;
  // Transports of its nation there, standing, with room.
  const men = c.strength[id]!;
  let fleet = 0;
  for (const i of at) {
    f.forEach((o) => {
      // `via` named: that group alone (PLAN 7.90g, ADR-649).
      if (fleet !== 0 || (via !== 0 && o !== via) || !world.isFleet(o) || c.nation[o] !== nation || c.engaged[o] === 1) return;
      if (c.moving[o] === 1 && !(o === via && carrying(world, o))) return;
      if (!near(world, cellOfPlace(world, o), water[i]!, world.atSize(AT_PORT_CELLS))) return;
      if (transportRoom(world, o) - aboard(world, o) >= men) fleet = o;
    });
    if (fleet !== 0) break;
  }
  if (fleet === 0) return RejectReason.NoTransports;
  // The landing: the zoned water nearest the target, and the land of the target's nearest to it.
  const z = seaOf(world);
  const comp = navOf(world).grid.component;
  const targetComp = comp[target]!;
  if (!isLand(terrain[target]!) || targetComp === 0) return RejectReason.NoLanding;
  const sea = nearestCellWhere((k) => z.zoneOf[k] !== 0 && z.closed[z.zoneOf[k]!] !== 1, tx + 0.5, ty + 0.5, w, h, world.atSize(LANDING_REACH), world.settings.loopingMap);
  if (sea < 0) return RejectReason.NoLanding;
  // A cell of a nation's where the target is one's (PLAN 4.6b: a speck of no one's by the water
  // took no beachhead), else any.
  const owner = world.cells.owner;
  const owned = owner[target] !== 0;
  let land = owned ? nearestCellWhere((k) => comp[k] === targetComp && owner[k] !== 0, (sea % w) + 0.5, Math.floor(sea / w) + 0.5, w, h, world.atSize(LANDING_REACH), world.settings.loopingMap) : -1;
  if (land < 0) land = nearestCellWhere((k) => comp[k] === targetComp, (sea % w) + 0.5, Math.floor(sea / w) + 0.5, w, h, world.atSize(LANDING_REACH), world.settings.loopingMap);
  if (land < 0) return RejectReason.NoLanding;
  if (!orderSail(world, fleet, (sea % w) + 0.5, Math.floor(sea / w) + 0.5)) return RejectReason.NoSeaWay;
  world.embarked.set(id, { fleet, land, water: sea, target });
  c.moving[id] = 0;
  c.home[id] = 0;
  world.paths.delete(id);
  c.x[id] = c.x[fleet]!;
  c.y[id] = c.y[fleet]!;
  world.out.emit(world.tick, EventKind.FormationEmbarked, id, nation, c.x[id]!, c.y[id]!);
  return 0;
}

/** Whether transport group `fleet` carries a formation embarked on it. */
function carrying(world: World, fleet: number): boolean {
  for (const e of world.embarked.values()) if (e.fleet === fleet) return true;
  return false;
}

/**
 * The port a player's land formation `id` marches to for an order over the sea (PLAN 4.9b), index
 * in `world.ports`, or -1: of the ports on its land that its nation holds, with transports of its
 * nation standing at them (not under way, in no battle) with room for it, the nearest by straight
 * cells. `withTransports` false: of the ports on its land that its nation holds, with transports
 * or not (whether a refusal is for no port or for no transports).
 */
export function transportsPort(world: World, id: number, withTransports = true): number {
  const f = world.formations;
  const c = f.cols;
  const nation = c.nation[id]!;
  const men = c.strength[id]!;
  const w = world.cells.w;
  const water = portSeaOf(world);
  const comp = navOf(world).grid.component;
  const here = cellOfPlace(world, id);
  const fleets: number[] = [];
  f.forEach((o) => {
    if (world.isFleet(o) && c.nation[o] === nation && c.moving[o] !== 1 && c.engaged[o] !== 1 && transportRoom(world, o) - aboard(world, o) >= men) fleets.push(o);
  });
  let best = -1;
  let bd = Infinity;
  world.ports.forEach((p, i) => {
    if (water[i]! < 0 || world.cells.controller[p.cell] !== nation || comp[p.cell] !== comp[here] || portShut(world, i)) return;
    if (withTransports && !fleets.some((o) => near(world, cellOfPlace(world, o), water[i]!, world.atSize(AT_PORT_CELLS)))) return;
    let dx = Math.abs((p.cell % w) - (here % w));
    if (world.settings.loopingMap && dx > w / 2) dx = w - dx;
    const dy = Math.floor(p.cell / w) - Math.floor(here / w);
    const d = dx * dx + dy * dy;
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

/** Lands embarked formation `id` at land cell `cell`. */
function land(world: World, id: number, cell: number, target: number): void {
  const c = world.formations.cols;
  world.embarked.delete(id);
  [c.x[id], c.y[id]] = world.cellPoint(cell);
  c.org[id] = Math.min(c.org[id]!, LANDING_ORG);
  // The beachhead (PLAN 4.5b): an enemy's cell it lands on is its nation's, for the front to
  // spread from; or its owner's, where that is a living nation not at war with it (ADR-147, as
  // a flip of the front: Italy had held 18 cells of Hungary's at peace).
  const n = c.nation[id]!;
  const held = world.cells.controller[cell]!;
  if (held !== 0 && world.wars.atWar(held, n)) {
    const o = world.cells.owner[cell]!;
    const freed = o !== 0 && o !== n && world.nations.cols.living[o] === 1 && !world.wars.atWar(n, o);
    world.setController(cell, freed ? o : n, false, FlipCause.landing);
  }
  world.out.emit(world.tick, EventKind.FormationLanded, id, c.nation[id]!, c.x[id]!, c.y[id]!);
  if (target !== cell) {
    const w = world.cells.w;
    // On to its target over the land it stands on, as any march.
    orderMove(world, id, (target % w) + 0.5, Math.floor(target / w) + 0.5);
  }
}

/**
 * Where a formation of `nation`'s aboard transports standing at cell `at`, not the landing's
 * water, goes ashore (PLAN 4.8n): the land nearest within `AT_PORT_CELLS` held by its nation, its
 * supply bloc or a nation fighting beside it, or by no one; no one's not where a nation at war
 * with it holds the sea about `at` (as at the landing's own water). -1 for none: it stays aboard.
 * An enemy's coast is the landing's alone, and a neutral's no one's to land on.
 */
export function strayLanding(world: World, nation: number, at: number): number {
  const { w, h, terrain, controller } = world.cells;
  const holder = seaHolder(world, seaOf(world).zoneOf[at]!);
  const enemySea = holder !== 0 && world.wars.atWar(holder, nation);
  const bloc = blocOf(world, nation);
  const comp = navOf(world).grid.component;
  const ours = (k: number): boolean => {
    const o = controller[k]!;
    if (o === 0) return !enemySea;
    return o === nation || blocOf(world, o) === bloc || world.wars.sameSide(nation, o);
  };
  return nearestCellWhere((k) => isLand(terrain[k]!) && comp[k] !== 0 && ours(k), (at % w) + 0.5, Math.floor(at / w) + 0.5, w, h, world.atSize(AT_PORT_CELLS), world.settings.loopingMap);
}

export function amphibiousSystem(world: World): void {
  const f = world.formations;
  const c = f.cols;
  // At the port (PLAN 4.9b): a player's order over the sea, its march ended, embarks or says why not.
  if (world.seaBound.size > 0) {
    const w = world.cells.w;
    for (const [id, target] of [...world.seaBound].sort((a, b) => a[0] - b[0])) {
      if (!f.has(id)) {
        world.seaBound.delete(id);
        continue;
      }
      if (c.moving[id] === 1) continue;
      world.seaBound.delete(id);
      const why = tryLanding(world, id, (target % w) + 0.5, Math.floor(target / w) + 0.5);
      if (why !== 0) world.out.emit(world.tick, EventKind.MoveRejected, id, c.nation[id]!, why, NaN);
    }
  }
  if (world.embarked.size === 0) return;
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
    // Stood elsewhere: ashore at the land nearest of its side or no one's (PLAN 4.8n).
    const ashore = strayLanding(world, c.nation[id]!, at);
    if (ashore >= 0) land(world, id, ashore, ashore);
  }
}
