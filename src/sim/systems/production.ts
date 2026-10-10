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
 *
 * Ships (PLAN 4.2e): a fleet of a sea template is queued only by a nation that controls a port a
 * ship reaches (`shipyard`), and is delivered at the water of that port on its ready day (its
 * node's cell of the lane graph, at the cell's water point); with no such port then, the order
 * waits. A fleet takes its slowest ship's own days (`SHIP_TIME_SCALE`), and its gold is by the
 * land's scale.
 */
import { equipFormation } from './elements';
import { isDayStart } from '../../shared/calendar';
import { EventKind } from '../../shared/events';
import { nearestCellWhere } from '../data/ownership';
import { knowsTechs } from '../tech';
import { Domain, laneOf, navOf, seaOf, type World } from '../world';
import { waterOf } from './sail';
import { frontierOf } from './territory';

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
 * ports whose land cell the nation controls and whose water a ship reaches (a node of the lane
 * graph, in a zone that ice does not close), the highest naval base, then the nearest to the
 * capital, then the first.
 */
export function shipyard(world: World, nation: number): number {
  const { w, controller } = world.cells;
  const lanes = laneOf(world);
  const sea = seaOf(world);
  const cx = world.nations.cols.capitalX[nation]!;
  const cy = world.nations.cols.capitalY[nation]!;
  let best = -1;
  let bd = Infinity;
  world.ports.forEach((p, i) => {
    if (controller[p.cell] !== nation || lanes.portNode[i]! < 0) return;
    if (sea.closed[sea.zoneOf[lanes.cell[lanes.portNode[i]!]!]!] === 1) return;
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
  // A fleet only where the nation has a port (PLAN 4.2e); no air formation yet.
  const ok = rule !== undefined && (rule.domain === Domain.land || (rule.domain === Domain.sea && world.nations.has(nation) && shipyard(world, nation) >= 0));
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
  const c = nearestCellWhere((i) => controller[i] === nation, cx, cy, w, h, SPAWN_REACH_CELLS, world.settings.loopingMap);
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
  if (front < 0) return home;
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

/** Where a new fleet of `nation` is delivered: the water of its `shipyard`; null with none. */
export function dockPoint(world: World, nation: number): [number, number] | null {
  const port = shipyard(world, nation);
  if (port < 0) return null;
  const lanes = laneOf(world);
  return waterOf(world, lanes.cell[lanes.portNode[port]!]!);
}

export function productionSystem(world: World): void {
  if (!isDayStart(world.tick) || world.production.count === 0) return;
  const p = world.production;
  const nc = world.nations.cols;
  const rules = world.rules;
  if (!rules) return;
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
    const at = rules.templates[t]!.domain === Domain.sea ? dockPoint(world, nation) : musterPoint(world, nation);
    if (!at) continue; // no land to raise it on, or no port: the order waits
    const f = world.formations;
    const fid = f.create();
    f.cols.nation[fid] = nation;
    f.cols.x[fid] = at[0];
    f.cols.y[fid] = at[1];
    f.cols.template[fid] = t;
    f.cols.supply[fid] = 1;
    f.cols.org[fid] = 1;
    equipFormation(world, fid, t); // elements + strength
    p.remove(id);
    world.out.emit(world.tick, EventKind.FormationSpawned, fid, nation, at[0], at[1]);
  }
}
