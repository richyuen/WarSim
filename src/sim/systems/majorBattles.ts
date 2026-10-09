/**
 * Major Battles + breakthrough corridors (SPEC §5.4, PLAN 1.23).
 *
 * Each tick, combat passes its derived battle groups to `updateMajorBattles`. A group whose
 * committed men reach MAJOR_MEN, or that lies within MATCH_CELLS of an active Major Battle,
 * is (or continues) that Major Battle; its losses are amplified by MAJOR_LOSS_MULT. Camps are
 * the nations allied with the group's lowest-id formation (not at war with it) and the rest.
 * A Major Battle not matched in a tick ends: the camp with more men still within END_CELLS of
 * it wins (the last observation breaks ties), and its strongest nation gets a corridor from the battle toward the loser's centroid,
 * CORRIDOR_DAYS long, CORRIDOR_LEN cells deep and 2 × CORRIDOR_HALF_WIDTH + 1 wide, where the
 * territory system multiplies its pressure by CORRIDOR_PRESSURE and its flip progress by
 * CORRIDOR_RATE. Start and end go to the history log and emit events.
 */
import { EventKind } from '../../shared/events';
import { sqrt } from '../core/dmath';
import type { Corridor, MajorBattle } from '../battles';
import type { World } from '../world';

export const MAJOR_MEN = 120_000;
export const MATCH_CELLS = 3;
/** Radius around an ending battle within which standing armies decide the winner. */
export const END_CELLS = 5;
export const MAJOR_LOSS_MULT = 1.5;
export const CORRIDOR_DAYS = 10;
export const CORRIDOR_LEN = 8;
export const CORRIDOR_HALF_WIDTH = 2;
export const CORRIDOR_PRESSURE = 2;
export const CORRIDOR_RATE = 4;

function log(world: World, kind: EventKind, a: number, b: number, x: number, y: number): void {
  world.battles.history.push({ tick: world.tick, kind, a, b, x, y });
  world.out.emit(world.tick, kind, a, b, x, y);
}

function nearestCity(world: World, x: number, y: number): number {
  let best = 0;
  let bd = Infinity;
  const cc = world.cities.cols;
  world.cities.forEach((id) => {
    const d = (cc.x[id]! - x) * (cc.x[id]! - x) + (cc.y[id]! - y) * (cc.y[id]! - y);
    if (d < bd) {
      bd = d;
      best = id;
    }
  });
  return best;
}

/** Tracks Major Battles for this tick's groups; returns the set of formation ids in one. */
export function updateMajorBattles(world: World, groups: readonly number[][]): Set<number> {
  const f = world.formations.cols;
  const inMajor = new Set<number>();
  const seen = new Set<MajorBattle>();
  for (const g of groups) {
    const lead = f.nation[g[0]!]!;
    const camps: [number[], number[]] = [[], []];
    const men: [number, number] = [0, 0];
    const sx = [0, 0];
    const sy = [0, 0];
    for (const id of g) {
      const n = f.nation[id]!;
      const k = n === lead || !world.wars.atWar(n, lead) ? 0 : 1;
      if (!camps[k].includes(n)) camps[k].push(n);
      men[k] += f.strength[id]!;
      sx[k]! += f.x[id]! * f.strength[id]!;
      sy[k]! += f.y[id]! * f.strength[id]!;
    }
    const total = men[0] + men[1];
    const cx = (sx[0]! + sx[1]!) / Math.max(1, total);
    const cy = (sy[0]! + sy[1]!) / Math.max(1, total);
    let mb = world.battles.majors.find((m) => !seen.has(m) && (m.x - cx) * (m.x - cx) + (m.y - cy) * (m.y - cy) <= MATCH_CELLS * MATCH_CELLS);
    if (!mb && total < MAJOR_MEN) continue;
    if (!mb) {
      mb = { id: world.battles.nextId++, city: nearestCity(world, cx, cy), x: cx, y: cy, startTick: world.tick, lastTick: world.tick, camps, men, centroid: [[cx, cy], [cx, cy]] };
      world.battles.majors.push(mb);
      log(world, EventKind.MajorBattleStarted, mb.id, mb.city, cx, cy);
    }
    seen.add(mb);
    mb.lastTick = world.tick;
    mb.camps = camps;
    mb.men = men;
    mb.centroid = [
      [men[0] > 0 ? sx[0]! / men[0] : cx, men[0] > 0 ? sy[0]! / men[0] : cy],
      [men[1] > 0 ? sx[1]! / men[1] : cx, men[1] > 0 ? sy[1]! / men[1] : cy],
    ];
    for (const id of g) inMajor.add(id);
  }
  // Unmatched Major Battles end.
  for (const mb of [...world.battles.majors]) {
    if (seen.has(mb)) continue;
    world.battles.majors = world.battles.majors.filter((m) => m !== mb);
    // The winner is the camp with more men still standing at the battle (within END_CELLS of it);
    // the last observation breaks a tie (e.g. both withdrew).
    const now = [0, 0];
    world.formations.forEach((id) => {
      const k = mb.camps[0].includes(f.nation[id]!) ? 0 : mb.camps[1].includes(f.nation[id]!) ? 1 : -1;
      if (k < 0 || world.afloat(id) || (f.x[id]! - mb.x) * (f.x[id]! - mb.x) + (f.y[id]! - mb.y) * (f.y[id]! - mb.y) > END_CELLS * END_CELLS) return;
      now[k]! += f.strength[id]!;
    });
    const w = now[0] !== now[1] ? (now[0]! > now[1]! ? 0 : 1) : mb.men[0] >= mb.men[1] ? 0 : 1;
    const winner = strongest(world, mb.camps[w]!);
    const [wx, wy] = mb.centroid[w]!;
    const [lx, ly] = mb.centroid[1 - w]!;
    log(world, EventKind.MajorBattleEnded, mb.id, winner, mb.x, mb.y);
    if (winner !== 0) addCorridor(world, winner, mb.x, mb.y, lx - wx, ly - wy);
  }
  world.battles.corridors = world.battles.corridors.filter((c) => c.untilTick > world.tick);
  return inMajor;
}

/** The living nation of `camp` with the most men in formations (lowest id on ties). */
function strongest(world: World, camp: number[]): number {
  const f = world.formations.cols;
  let best = 0;
  let bestMen = -1;
  for (const n of [...camp].sort((a, b) => a - b)) {
    if (world.nations.cols.living[n] !== 1) continue;
    let m = 0;
    world.formations.forEach((id) => {
      if (f.nation[id] === n && !world.afloat(id)) m += f.strength[id]!; // of its army: a fleet's crews are not counted (PLAN 4.2b)
    });
    if (m > bestMen) {
      bestMen = m;
      best = n;
    }
  }
  return best;
}

/** Adds a breakthrough corridor for `nation` from (x, y) toward (dx, dy) (any length). */
export function addCorridor(world: World, nation: number, x: number, y: number, dx: number, dy: number): Corridor {
  const len = sqrt(dx * dx + dy * dy);
  const c: Corridor = { nation, x, y, dx: len > 0 ? dx / len : 1, dy: len > 0 ? dy / len : 0, untilTick: world.tick + CORRIDOR_DAYS * 24 };
  world.battles.corridors.push(c);
  return c;
}

/** Whether cell `cell` lies in an active corridor of `nation`. */
export function inCorridor(world: World, nation: number, cell: number): boolean {
  const cs = world.battles.corridors;
  if (cs.length === 0) return false;
  const w = world.cells.w;
  const wrap = world.settings.loopingMap;
  const px = (cell % w) + 0.5;
  const py = Math.floor(cell / w) + 0.5;
  for (const c of cs) {
    if (c.nation !== nation || c.untilTick <= world.tick) continue;
    let rx = px - c.x;
    if (wrap && rx > w / 2) rx -= w;
    if (wrap && rx < -w / 2) rx += w;
    const ry = py - c.y;
    const along = rx * c.dx + ry * c.dy;
    const across = Math.abs(-rx * c.dy + ry * c.dx);
    if (along >= -1 && along <= CORRIDOR_LEN && across <= CORRIDOR_HALF_WIDTH + 0.5) return true;
  }
  return false;
}
