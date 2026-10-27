/**
 * Production and recruitment (PLAN 1.10, SPEC §3.7).
 *
 * `queueFormation` (the command): a formation of a scenario template costs its elements' gold
 * and manpower (scenario rules), paid at once. The nation must have both (gold may not go below
 * zero for new orders) and know the techs of the template's unit types (PLAN 3.1a, `sim/tech.ts`);
 * otherwise the order is rejected with an event. Accepted orders become rows of
 * `world.production`.
 *
 * Rows store the day they are ready (queue day + training days), so a formation queued on day
 * d appears at 00:00 of day d + N. All orders train in parallel. Daily at 00:00, a bankrupt
 * nation's orders slip by a day (training stalls); ready ones appear at full strength at the
 * capital. If the capital is not under the nation's control, it appears at the nearest
 * cell the nation controls (within SPAWN_REACH_CELLS); with none, the order waits.
 *
 * Overseas muster (critic B1, 2026-10-03; an abstraction of sealift until PLAN 4.5): a nation at
 * war whose fronts all lie on other landmasses than its spawn point raises the formation in the
 * theatre instead: at the city it owns and controls nearest (and on the same landmass as) its
 * front cell nearest the capital (`cityStand`), or at that front cell without such a city.
 * Japan's divisions otherwise piled up on the home islands while its army in China withered.
 * A nation at war with no front cell of its own (its land front its allies' alone; PLAN 7.67,
 * ADR-619) takes as its front its allies' cells beside the enemies it fights with them (as the
 * ferry does, ADR-617): its city on a landmass of those cells nearest one of them; with none there,
 * its port nearest one of them by sea, where the ferry boards. Before, it raised its whole army at
 * home: the Netherlands' 16 divisions on a one-cell Caribbean islet with no port (critic run 11,
 * seed 1129 year 20), where no transport could take them aboard.
 *
 * Ships (PLAN 4.2e): a fleet of a sea template is queued only by a nation that controls a port a
 * ship reaches (`shipyard`), and is delivered at the water of that port on its ready day (its
 * node's cell of the lane graph, at the cell's water point); with no such port then, the order
 * waits. The water is by the zones, not the lane graph's edges (PLAN 4.2f: the page asks
 * every nation's shipyard). A fleet takes its slowest ship's own days (`SHIP_TIME_SCALE`), and
 * its gold is by the land's scale.
 *
 * Wings (PLAN 5.8s1): an air wing is queued only by a nation with an airbase it holds with room
 * for the wing's aircraft beside the wings based there (`airfield`), and is delivered there, its
 * base, on its ready day; with none then, the order waits.
 */
import { airbaseRoom } from '../data/airbases';
import { manDecks, wingAircraft } from './air';
import { cellX, elementIndex, equipFormation, recomputeStrength, wrapDx } from './elements';
import { isDayStart } from '../../shared/calendar';
import { EventKind } from '../../shared/events';
import { nearestCellWhere } from '../data/ownership';
import { knowsTechs } from '../tech';
import { basinOf, Domain, navOf, portSeaOf, seaOf, type World } from '../world';
import { portShut } from './bombing';
import { waterOf } from './sail';
import { frontierOf } from './territory';
import { neighbours4 } from '../nav/grid';
import { seaKm } from './navalCombat';

export const SPAWN_REACH_CELLS = 40;
/** Gold cost = PRODUCTION_COST_SCALE × Σ element unit gold cost (ADR-23). */
export const PRODUCTION_COST_SCALE = 3.5;
/** Training days = TRAIN_TIME_SCALE × the slowest element's days (ADR-23). */
export const TRAIN_TIME_SCALE = 3;

/**
 * Building days of a fleet = SHIP_TIME_SCALE × its slowest ship's days (PLAN 4.2e, ADR-252): a
 * ship's days in the data are its time from the keel to its trials (a battleship 900, a
 * destroyer 180), and a fleet's ships are built side by side.
 */
export const SHIP_TIME_SCALE = 1;

/**
 * The port where a new fleet of `nation` is delivered (index in `world.ports`), or -1: of the
 * ports whose land cell the nation controls and whose water a ship reaches (its water as the
 * lane graph's node has it, `portSeaOf`, in a zone of the world's seas, `basinOf`'s ocean: not a
 * lake, the Caspian or a sea ice closes, PLAN 4.8o), the highest naval
 * base, then the nearest to the capital, then the first.
 */
export function shipyard(world: World, nation: number): number {
  const { w, controller } = world.cells;
  const water = portSeaOf(world);
  const sea = seaOf(world);
  const { basin, ocean } = basinOf(world);
  const cx = world.nations.cols.capitalX[nation]!;
  const cy = world.nations.cols.capitalY[nation]!;
  let best = -1;
  let bd = Infinity;
  world.ports.forEach((p, i) => {
    // A port shut by bombs (PLAN 5.5b) delivers no fleet.
    if (controller[p.cell] !== nation || water[i]! < 0 || basin[sea.zoneOf[water[i]!]!] !== ocean || portShut(world, i)) return;
    let dx = Math.abs(p.x - cx);
    if (world.settings.loopingMap && dx > w / 2) dx = w - dx;
    const d = dx * dx + (p.y - cy) * (p.y - cy);
    const q = best < 0 ? undefined : world.ports[best]!;
    if (q === undefined || p.navalBase > q.navalBase || (p.navalBase === q.navalBase && d < bd)) {
      best = i;
      bd = d;
    }
  });
  return best;
}

/** Applies a queue order; returns the production row id, or 0 when rejected. */
export function queueFormation(world: World, nation: number, template: number): number {
  const rule = world.rules?.templates[template];
  const nc = world.nations.cols;
  // A fleet only where the nation has a port (PLAN 4.2e); a wing where it has an airbase with room (PLAN 5.8s1).
  const ok =
    rule !== undefined &&
    (rule.domain === Domain.land ||
      (rule.domain === Domain.sea && world.nations.has(nation) && shipyard(world, nation) >= 0) ||
      (rule.domain === Domain.air && world.nations.has(nation) && airfield(world, nation, template) >= 0));
  if (!rule || !ok || !world.nations.has(nation) || nc.living[nation] !== 1 || nc.gold[nation]! < rule.gold || nc.manpower[nation]! < rule.manpower || !knowsTechs(world, nation, rule.techs)) {
    world.out.emit(world.tick, EventKind.ProductionRejected, template, nation, NaN, NaN);
    return 0;
  }
  nc.gold[nation] = nc.gold[nation]! - rule.gold;
  nc.manpower[nation] = nc.manpower[nation]! - rule.manpower;
  const p = world.production;
  const id = p.create();
  p.cols.nation[id] = nation;
  p.cols.template[id] = template;
  p.cols.readyDay[id] = Math.floor(world.tick / 24) + Math.max(1, rule.days);
  world.out.emit(world.tick, EventKind.ProductionQueued, id, nation, NaN, NaN);
  return id;
}

/** Where a new formation of `nation` appears (cell centre), or null when it holds no land. */
export function spawnPoint(world: World, nation: number): [number, number] | null {
  const { w, h, controller } = world.cells;
  const nc = world.nations.cols;
  const cx = nc.capitalX[nation]!;
  const cy = nc.capitalY[nation]!;
  const c = nearestCellWhere((i) => controller[i] === nation, cx, cy, w, h, world.atSize(SPAWN_REACH_CELLS), world.settings.loopingMap);
  if (c < 0) return null;
  // The capital's own cell keeps the exact capital position; elsewhere the cell's middle. Either
  // way on land by the fine mask (PLAN 2.9a): a capital on the shore, a coastal cell's middle.
  if (c === Math.floor(cy) * w + Math.floor(cx)) return world.standPoint(cx, cy);
  return world.cellPoint(c);
}

/**
 * Where a formation stands by `city`: at the city's own place where that is in the city's cell
 * and on sure land by the fine mask (PLAN 2.11k: Gibraltar's is in a water pixel), else where a
 * formation stands in the city's cell. A city's place may lie over the cell beside its own
 * (PLAN 3.12Rm: 436 of the 5,757 of 1938, on the shore), which is water on the grid: no route
 * begins there, and a formation raised there took no order.
 */
export function cityStand(world: World, city: number): [number, number] {
  const cc = world.cities.cols;
  const x = cc.x[city]!;
  const y = cc.y[city]!;
  const cell = cc.cell[city]!;
  return cell === Math.floor(y) * world.cells.w + Math.floor(x) ? world.standPoint(x, y) : world.cellPoint(cell);
}

/** Where a formation raised now appears: `spawnPoint`, or the overseas theatre (module comment). */
export function musterPoint(world: World, nation: number): [number, number] | null {
  const home = spawnPoint(world, nation);
  if (!home || world.wars.list.length === 0) return home;
  const { w, controller, owner } = world.cells;
  const comp = navOf(world).grid.component;
  const homeComp = comp[Math.floor(home[1]) * w + Math.floor(home[0])]!;
  const nc = world.nations.cols;
  const dist2 = (x: number, y: number, tx: number, ty: number): number => {
    let dx = Math.abs(x - tx);
    if (world.settings.loopingMap && dx > w / 2) dx = w - dx;
    return dx * dx + (y - ty) * (y - ty);
  };
  // The front cell nearest the capital (lowest id on ties); a front on the home landmass wins.
  let front = -1;
  let fd = Infinity;
  for (const c of frontierOf(world)) {
    if (controller[c] !== nation) continue;
    if (comp[c] === homeComp) return home;
    const d = dist2((c % w) + 0.5, Math.floor(c / w) + 0.5, nc.capitalX[nation]!, nc.capitalY[nation]!);
    if (d < fd || (d === fd && c < front)) {
      fd = d;
      front = c;
    }
  }
  if (front < 0) return allyTheatre(world, nation, dist2) ?? home;
  const fx = (front % w) + 0.5;
  const fy = Math.floor(front / w) + 0.5;
  const cc = world.cities.cols;
  let best = 0;
  let bd = Infinity;
  world.cities.forEach((id) => {
    const cell = cc.cell[id]!;
    if (owner[cell] !== nation || controller[cell] !== nation || comp[cell] !== comp[front]) return;
    const d = dist2(cc.x[id]!, cc.y[id]!, fx, fy);
    if (d < bd) {
      bd = d;
      best = id;
    }
  });
  return best !== 0 ? cityStand(world, best) : world.cellPoint(front);
}

/**
 * Where a nation at war with no front cell of its own raises a land formation (PLAN 7.67, ADR-619;
 * module comment), or null for home: the theatre is its allies' cells beside the enemies it fights
 * with them (`wars.together`, the ferry's front, ADR-617). Its city (owned and controlled) on a
 * landmass of those cells nearest one of them on it; with none there, its port with water nearest
 * one of them by sea (`seaKm`), at its city in the port's cell, else the port's cell.
 */
function allyTheatre(world: World, nation: number, dist2: (x: number, y: number, tx: number, ty: number) => number): [number, number] | null {
  if (!world.wars.list.some((war) => war.sides[0].includes(nation) || war.sides[1].includes(nation))) return null;
  const { w, h, controller, owner } = world.cells;
  const comp = navOf(world).grid.component;
  const nb: number[] = [];
  const front: number[] = [];
  const lands = new Set<number>();
  for (const c of frontierOf(world)) {
    const a = controller[c]!;
    if (a === 0 || a === nation || !world.wars.sameSide(nation, a)) continue;
    if (!neighbours4(c, w, h, world.settings.loopingMap, nb).some((q) => controller[q] !== 0 && world.wars.together(nation, a, controller[q]!))) continue;
    front.push(c);
    lands.add(comp[c]!);
  }
  if (front.length === 0) return null;
  const cc = world.cities.cols;
  let best = 0;
  let bd = Infinity;
  world.cities.forEach((id) => {
    const cell = cc.cell[id]!;
    if (owner[cell] !== nation || controller[cell] !== nation || !lands.has(comp[cell]!)) return;
    for (const k of front) {
      if (comp[k] !== comp[cell]) continue;
      const d = dist2(cc.x[id]!, cc.y[id]!, (k % w) + 0.5, Math.floor(k / w) + 0.5);
      if (d < bd) [bd, best] = [d, id];
    }
  });
  if (best !== 0) return cityStand(world, best);
  const water = portSeaOf(world);
  let port = -1;
  let km = Infinity;
  world.ports.forEach((p, i) => {
    const at = water[i]!;
    if (at < 0 || owner[p.cell] !== nation || controller[p.cell] !== nation) return;
    const [x, y] = [(at % w) + 0.5, Math.floor(at / w) + 0.5];
    for (const k of front) {
      const d = seaKm(world, x, y, (k % w) + 0.5, Math.floor(k / w) + 0.5);
      if (d < km) [km, port] = [d, i];
    }
  });
  if (port < 0) return null;
  const cell = world.ports[port]!.cell;
  let city = 0;
  world.cities.forEach((id) => {
    if (city === 0 && cc.cell[id] === cell) city = id;
  });
  return city !== 0 ? cityStand(world, city) : world.cellPoint(cell);
}

/**
 * The airbase where a new wing of template `t` of `nation` is delivered (index in
 * `world.airbases`), or -1: of the airbases whose cell the nation holds, with room for the wing's
 * aircraft beside those of the wings based there (`airbaseRoom`), the nearest its capital, then
 * the first.
 */
export function airfield(world: World, nation: number, t: number): number {
  const need = wingAircraft(world, t);
  const used = new Map<number, number>();
  for (const [o, b] of world.wingBase) if (b > 0) used.set(b, (used.get(b) ?? 0) + wingAircraft(world, world.formations.cols.template[o]!));
  const nc = world.nations.cols;
  const [cx, cy] = [nc.capitalX[nation]!, nc.capitalY[nation]!];
  let best = -1;
  let bd = Infinity;
  world.airbases.forEach((b, i) => {
    if (world.cells.controller[b.cell] !== nation || (used.get(i + 1) ?? 0) + need > airbaseRoom(b)) return;
    const [x, y] = world.cellPoint(b.cell);
    const dx = wrapDx(world, cx, x);
    const d = dx * dx + (y - cy) * (y - cy);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

/** Where a new fleet of `nation` is delivered: the water of its `shipyard`; null with none. */
export function dockPoint(world: World, nation: number): [number, number] | null {
  const port = shipyard(world, nation);
  if (port < 0) return null;
  return waterOf(world, portSeaOf(world)[port]!);
}

export function productionSystem(world: World): void {
  if (!isDayStart(world.tick) || world.production.count === 0) return;
  const rules = world.rules;
  if (!rules) return;
  deliver(world, rules);
}

/** A formation is refilled only with at least this supply (PLAN 7.3e1): men reach it where its supplies do. */
export const REFILL_SUPPLY = 0.5;

/**
 * Whether land formation `id` may be refilled (PLAN 7.3e1, ADR-435; the economic AI's step 3a
 * pays for it): of a land template with elements, below the template's strength, of a living
 * nation, at rest from war (not engaged, not retreating, not on a march home, not aboard), with
 * supply of REFILL_SUPPLY or more, on a cell its nation controls. A fleet and a wing are not
 * refilled; nor is a formation of no template or no elements (the toy world's, tests').
 */
export function refillable(world: World, id: number): boolean {
  const fc = world.formations.cols;
  const rule = world.rules?.templates[fc.template[id]!];
  if (!world.formations.has(id)) return false;
  if (!rule || rule.domain !== Domain.land || rule.manpower <= 0 || world.offLand(id)) return false;
  const n = fc.nation[id]!;
  if (world.nations.cols.living[n] !== 1 || fc.strength[id]! >= rule.manpower) return false;
  if (fc.engaged[id] === 1 || fc.retreat[id] !== 0 || fc.home[id] !== 0 || fc.supply[id]! < REFILL_SUPPLY) return false;
  if (!elementIndex(world).has(id)) return false;
  const cx = cellX(world, Math.floor(fc.x[id]!));
  const cy = Math.floor(fc.y[id]!);
  return cx !== null && cy >= 0 && cy < world.cells.h && world.cells.controller[cy * world.cells.w + cx] === n;
}

/**
 * Gives formation `id` up to `men` men back (PLAN 7.3e1) and returns how many it took. The men go
 * to its elements in the order of their slots: a living element to its full size first, then a
 * slot whose element died gets a new one of the template's unit there. The slots stop at their
 * elements' sizes, so a formation is refilled to its template's strength and no further. Nothing
 * is paid here: the caller takes the men from the pool and the gold from the treasury.
 */
export function refillFormation(world: World, id: number, men: number): number {
  const rules = world.rules;
  const rule = rules?.templates[world.formations.cols.template[id]!];
  const list = elementIndex(world).get(id);
  if (!rules || !rule || !list) return 0;
  // A create may move the elements to new arrays: `ec` is read again after one.
  let ec = world.elements.cols;
  const bySlot = new Map<number, number>();
  for (const e of list) bySlot.set(ec.slot[e]!, e);
  let slot = 0;
  let grown = false;
  let added = 0;
  for (const { unit, count } of rule.elements) {
    const u = rules.units[unit]!;
    for (let k = 0; k < count; k++, slot++) {
      if (u.menPerUnit <= 0 || men < u.menPerUnit) continue;
      const e = bySlot.get(slot);
      const have = e === undefined ? 0 : ec.strength[e]!;
      const take = Math.min(u.size - have, Math.floor(men / u.menPerUnit));
      if (take <= 0) continue;
      if (e === undefined) {
        const ne = world.elements.create();
        ec = world.elements.cols;
        ec.formation[ne] = id;
        ec.slot[ne] = slot;
        ec.unit[ne] = unit;
        ec.strength[ne] = take;
        list.push(ne);
        grown = true;
      } else ec.strength[e] = have + take;
      men -= take * u.menPerUnit;
      added += take * u.menPerUnit;
    }
  }
  if (added === 0) return 0;
  // The index stays ascending (an id freed before may be given again), as a rebuilt one is.
  if (grown) list.sort((a, b) => a - b);
  recomputeStrength(world, id);
  return added;
}

/** The orders whose day has come appear (module comment). */
function deliver(world: World, rules: NonNullable<World['rules']>): void {
  if (world.production.count === 0) return;
  const p = world.production;
  const nc = world.nations.cols;
  const today = world.tick / 24;
  for (const id of p.ids()) {
    const nation = p.cols.nation[id]!;
    if (nc.living[nation] !== 1) continue;
    if (nc.bankrupt[nation] === 1) {
      p.cols.readyDay[id] = p.cols.readyDay[id]! + 1;
      continue;
    }
    if (today < p.cols.readyDay[id]!) continue;
    const t = p.cols.template[id]!;
    const domain = rules.templates[t]!.domain;
    const field = domain === Domain.air ? airfield(world, nation, t) : -1;
    const at = domain === Domain.sea ? dockPoint(world, nation) : domain === Domain.air ? (field >= 0 ? world.cellPoint(world.airbases[field]!.cell) : null) : musterPoint(world, nation);
    if (!at) continue; // no land to raise it on, no port, or no airbase with room: the order waits
    const f = world.formations;
    const fid = f.create();
    f.cols.nation[fid] = nation;
    f.cols.x[fid] = at[0];
    f.cols.y[fid] = at[1];
    f.cols.template[fid] = t;
    f.cols.supply[fid] = 1;
    f.cols.org[fid] = 1;
    equipFormation(world, fid, t); // elements + strength
    if (field >= 0) world.wingBase.set(fid, field + 1);
    p.remove(id);
    world.out.emit(world.tick, EventKind.FormationSpawned, fid, nation, at[0], at[1]);
    // Its carriers' air groups with it (PLAN 7.137).
    if (domain === Domain.sea) manDecks(world, fid);
  }
}
