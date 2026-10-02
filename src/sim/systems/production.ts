/**
 * Production and recruitment (PLAN 1.10, SPEC §3.7).
 *
 * `queueFormation` (the command): a formation of a scenario template costs its elements' gold
 * and manpower (scenario rules), paid at once. The nation must have both (gold may not go below
 * zero for new orders); otherwise the order is rejected with an event. Accepted orders become
 * rows of `world.production`.
 *
 * Rows store the day they are ready (queue day + training days), so a formation queued on day
 * d appears at 00:00 of day d + N. All orders train in parallel. Daily at 00:00, a bankrupt
 * nation's orders slip by a day (training stalls); ready ones appear at full strength at the
 * capital. If the capital is not under the nation's control, it appears at the nearest
 * cell the nation controls (within SPAWN_REACH_CELLS); with none, the order waits.
 */
import { isDayStart } from '../../shared/calendar';
import { EventKind } from '../../shared/events';
import { nearestCellWhere } from '../data/ownership';
import type { World } from '../world';

export const SPAWN_REACH_CELLS = 40;
/** Gold cost = PRODUCTION_COST_SCALE × Σ element unit gold cost (ADR-23). */
export const PRODUCTION_COST_SCALE = 3.5;
/** Training days = TRAIN_TIME_SCALE × the slowest element's days (ADR-23). */
export const TRAIN_TIME_SCALE = 3;

/** Applies a queue order; returns the production row id, or 0 when rejected. */
export function queueFormation(world: World, nation: number, template: number): number {
  const rule = world.rules?.templates[template];
  const nc = world.nations.cols;
  if (!rule || !world.nations.has(nation) || nc.living[nation] !== 1 || nc.gold[nation]! < rule.gold || nc.manpower[nation]! < rule.manpower) {
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
  const x = c % w;
  // The capital's own cell keeps the exact capital position; elsewhere use the cell centre.
  if (c === Math.floor(cy) * w + Math.floor(cx)) return [cx, cy];
  return [x + 0.5, (c - x) / w + 0.5];
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
    const at = spawnPoint(world, nation);
    if (!at) continue; // no land to raise it on: the order waits
    const t = p.cols.template[id]!;
    const f = world.formations;
    const fid = f.create();
    f.cols.nation[fid] = nation;
    f.cols.x[fid] = at[0];
    f.cols.y[fid] = at[1];
    f.cols.template[fid] = t;
    f.cols.strength[fid] = rules.templates[t]!.strength;
    f.cols.supply[fid] = 1;
    p.remove(id);
    world.out.emit(world.tick, EventKind.FormationSpawned, fid, nation, at[0], at[1]);
  }
}
