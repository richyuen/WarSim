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
 * front cell nearest the capital, or at that front cell without such a city. Japan's divisions
 * otherwise piled up on the home islands while its army in China withered.
 */
import { equipFormation } from './elements';
import { isDayStart } from '../../shared/calendar';
import { EventKind } from '../../shared/events';
import { nearestCellWhere } from '../data/ownership';
import { knowsTechs } from '../tech';
import { navOf, type World } from '../world';
import { frontierOf } from './territory';

export const SPAWN_REACH_CELLS = 40;
/** Gold cost = PRODUCTION_COST_SCALE × Σ element unit gold cost (ADR-23). */
export const PRODUCTION_COST_SCALE = 3.5;
/** Training days = TRAIN_TIME_SCALE × the slowest element's days (ADR-23). */
export const TRAIN_TIME_SCALE = 3;

/** Applies a queue order; returns the production row id, or 0 when rejected. */
export function queueFormation(world: World, nation: number, template: number): number {
  const rule = world.rules?.templates[template];
  const nc = world.nations.cols;
  if (!rule || !world.nations.has(nation) || nc.living[nation] !== 1 || nc.gold[nation]! < rule.gold || nc.manpower[nation]! < rule.manpower || !knowsTechs(world, nation, rule.techs)) {
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
  const c = nearestCellWhere((i) => controller[i] === nation, cx, cy, w, h, SPAWN_REACH_CELLS);
  if (c < 0) return null;
  // The capital's own cell keeps the exact capital position; elsewhere the cell's middle. Either
  // way on land by the fine mask (PLAN 2.9a): a capital on the shore, a coastal cell's middle.
  if (c === Math.floor(cy) * w + Math.floor(cx)) return world.standPoint(cx, cy);
  return world.cellPoint(c);
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
  // On sure land by the fine mask, as every place a formation takes (PLAN 2.9a missed this
  // one: a city on the shore, Gibraltar, has its own place in a water pixel: PLAN 2.11k).
  return best !== 0 ? world.standPoint(cc.x[best]!, cc.y[best]!) : world.cellPoint(front);
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
    const at = musterPoint(world, nation);
    if (!at) continue; // no land to raise it on: the order waits
    const t = p.cols.template[id]!;
    const f = world.formations;
    const fid = f.create();
    f.cols.nation[fid] = nation;
    f.cols.x[fid] = at[0];
    f.cols.y[fid] = at[1];
    f.cols.template[fid] = t;
    f.cols.supply[fid] = 1;
    equipFormation(world, fid, t); // elements + strength
    p.remove(id);
    world.out.emit(world.tick, EventKind.FormationSpawned, fid, nation, at[0], at[1]);
  }
}
