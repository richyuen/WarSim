/**
 * Operational AI v1 (SPEC §7, PLAN 1.25): front allocation, offensives, reserves.
 *
 * Every 6 hours, nation n (AI on, at war) plans when (tick/6 + n) mod STAGGER = 0, i.e. once a
 * day. Its front cells are the frontier cells that it, or a nation fighting that enemy on its
 * side, controls and that touch an enemy's cell (PLAN 1.42b: an ally's front is its front too,
 * within DEPLOY_RANGE_CELLS of its formations); they are
 * grouped into sectors of SECTOR_CELLS × SECTOR_CELLS cells (ascending key). A sector's threat is
 * the enemy strength in its 3 × 3 sector neighbourhood.
 *
 * Free formations (not engaged) within DEPLOY_RANGE_CELLS of a sector are ranked by distance to
 * the nearest one; the farthest RESERVE share stays put as the reserve (farther ones garrison).
 * They are allotted to sectors in proportion to 1 + threat/THREAT_UNIT (largest remainders; every
 * sector gets one while formations last). A formation already marching into a sector keeps it,
 * whatever the sector's allotment is today (ADR-53: the allotment moves every day with the threat,
 * and a march of weeks that is re-planned daily never arrives); the others fill what is left of
 * the allotments nearest-first. A sector whose allotted strength ≥ OFFENSIVE_RATIO × its threat attacks:
 * its formations march on the enemy cell next to the sector's front nearest its centre;
 * otherwise they hold the own front cell nearest the centre. Orders already being followed
 * (target within one sector) or already reached are not re-issued.
 */
import { orderMove, passageOf } from '../systems/movement';
import { frontierOf } from '../systems/territory';
import { neighbours4, type Passage } from '../nav/grid';
import type { World } from '../world';

export const STAGGER = 4;
export const SECTOR_CELLS = 4;
export const RESERVE = 0.15;
export const OFFENSIVE_RATIO = 1.5;
/** Threat (men) worth one extra formation's share in a sector. */
export const THREAT_UNIT = 10_000;
/** Formations farther than this from every front sector stay where they are (garrisons). */
export const DEPLOY_RANGE_CELLS = 60;

interface Sector {
  key: number;
  cells: number[];
  cx: number;
  cy: number;
  threat: number;
  formations: number[];
  strength: number;
}

export function operationalAi(world: World): void {
  if (!world.settings.aiEnabled || world.tick % 6 !== 0 || world.wars.list.length === 0) return;
  const step = world.tick / 6;
  const nc = world.nations.cols;
  const fighting = world.wars.nations();
  const f = world.formations.cols;
  // A nation with no free formation has nothing to plan (most members of a large coalition, most
  // days): it is skipped before any front is looked at.
  const free = new Uint32Array(world.nations.highWater);
  world.formations.forEach((id) => {
    if (f.engaged[id] !== 1) free[f.nation[id]!]!++;
  });
  const actors = [...fighting].filter((n) => nc.living[n] === 1 && nc.aiOff[n] !== 1 && (step + n) % STAGGER === 0 && free[n]! > 0).sort((a, b) => a - b);
  if (actors.length === 0) return;
  const { w, h, controller } = world.cells;
  // The frontier by holder, with the holders of each cell's four neighbours, once for all of this
  // tick's planners. Each planner reads only its own cells and its partners' (PLAN 1.42f:
  // scanning the whole frontier per planner was a quarter of the tick in a world of many wars).
  const frontier = new Map<number, Front>();
  const nb: number[] = [];
  for (const c of frontierOf(world)) {
    const holder = controller[c]!;
    let fr = frontier.get(holder);
    if (!fr) frontier.set(holder, (fr = { cells: [], near: [] }));
    fr.cells.push(c);
    const at = fr.near.length;
    fr.near.push(0, 0, 0, 0);
    let k = 0;
    for (const q of neighbours4(c, w, h, world.settings.loopingMap, nb)) fr.near[at + k++] = controller[q]!;
  }
  for (const n of actors) planNation(world, n, fighting, frontier, w, nb, f);
}

/** A holder's frontier cells and, four per cell, the holders of the neighbouring cells (0 = none). */
interface Front {
  cells: number[];
  near: number[];
}

function planNation(world: World, n: number, fighting: Set<number>, frontier: Map<number, Front>, w: number, nb: number[], f: World['formations']['cols']): void {
  const wars = world.wars;
  // n's enemies as a mask: the tests below run per frontier cell and per formation.
  const enemyOf = new Uint8Array(world.nations.highWater);
  for (const m of fighting) if (wars.atWar(n, m)) enemyOf[m] = 1;
  const enemy = (m: number): boolean => enemyOf[m] === 1;
  const bw = Math.ceil(w / SECTOR_CELLS);
  const sectors = new Map<number, Sector>();
  for (const [holder, { cells, near }] of frontier) {
    if (holder !== n && !wars.sameSide(holder, n)) continue;
    for (let i = 0; i < cells.length; i++) {
      // A front cell touches an enemy of n whom its holder fights too.
      let front = false;
      for (let k = 4 * i; k < 4 * i + 4 && !front; k++) front = enemyOf[near[k]!] === 1 && (holder === n || wars.atWar(holder, near[k]!));
      if (!front) continue;
      const c = cells[i]!;
      const x = c % w;
      const y = (c - x) / w;
      const key = Math.floor(y / SECTOR_CELLS) * bw + Math.floor(x / SECTOR_CELLS);
      let s = sectors.get(key);
      if (!s) sectors.set(key, (s = { key, cells: [], cx: 0, cy: 0, threat: 0, formations: [], strength: 0 }));
      s.cells.push(c);
    }
  }
  if (sectors.size === 0) return;
  const list = [...sectors.values()].sort((a, b) => a.key - b.key);
  for (const s of list) {
    // Sums of half-integers: the same in any order of the cells (they are sorted where their
    // order is read, below).
    let sx = 0;
    let sy = 0;
    for (const c of s.cells) {
      sx += (c % w) + 0.5;
      sy += Math.floor(c / w) + 0.5;
    }
    s.cx = sx / s.cells.length;
    s.cy = sy / s.cells.length;
  }
  const enemyByBucket = new Map<number, number>();
  const mine: number[] = [];
  world.formations.forEach((id) => {
    const m = f.nation[id]!;
    if (m === n) {
      if (f.engaged[id] !== 1) mine.push(id);
      return;
    }
    if (!enemy(m)) return;
    const k = Math.floor(f.y[id]! / SECTOR_CELLS) * bw + Math.floor(f.x[id]! / SECTOR_CELLS);
    enemyByBucket.set(k, (enemyByBucket.get(k) ?? 0) + f.strength[id]!);
  });
  if (mine.length === 0) return;
  const dist2 = (id: number, s: Sector): number => {
    let dx = Math.abs(f.x[id]! - s.cx);
    if (dx > w / 2) dx = w - dx;
    const dy = f.y[id]! - s.cy;
    return dx * dx + dy * dy;
  };
  // Reserve: the farthest RESERVE share of free formations within range stays put.
  const nearest = new Map<number, number>();
  for (const id of mine) {
    let d = Infinity;
    for (const s of list) d = Math.min(d, dist2(id, s));
    if (d <= DEPLOY_RANGE_CELLS * DEPLOY_RANGE_CELLS) nearest.set(id, d);
  }
  const ranked = [...nearest.keys()].sort((a, b) => nearest.get(a)! - nearest.get(b)! || a - b);
  const active = ranked.slice(0, ranked.length - Math.floor(ranked.length * RESERVE));
  // No formation to send (45 % of the plans in two years of seed 99, PLAN 3.4Rm): nothing below
  // would give an order, so the threat is not summed and nothing is allotted.
  if (active.length === 0) return;
  // Threat: enemy formations by sector bucket, summed over each sector's 3 × 3 neighbourhood.
  for (const s of list) {
    const sy = Math.floor(s.key / bw);
    const sx = s.key - sy * bw;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s.threat += enemyByBucket.get((sy + dy) * bw + ((sx + dx + bw) % bw)) ?? 0;
  }
  // Allotment by largest remainders over weights 1 + threat/THREAT_UNIT.
  const weights = list.map((s) => 1 + s.threat / THREAT_UNIT);
  const total = weights.reduce((a, b) => a + b, 0);
  const quota = weights.map((wt) => (active.length * wt) / total);
  const counts = quota.map((q) => Math.floor(q));
  let left = active.length - counts.reduce((a, b) => a + b, 0);
  const order = quota.map((q, i) => [q - Math.floor(q), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) {
    if (left <= 0) break;
    counts[i]!++;
    left--;
  }
  // Every sector gets one while formations last: take from the largest allotments.
  for (let i = 0; i < list.length; i++) {
    if (counts[i]! > 0) continue;
    let j = -1;
    for (let k = 0; k < counts.length; k++) if (counts[k]! > 1 && (j < 0 || counts[k]! > counts[j]!)) j = k;
    if (j < 0) break;
    counts[j]!--;
    counts[i] = 1;
  }
  // Sticky first: a formation already marching into a sector keeps it, also beyond the sector's
  // allotment of today (ADR-53). It counts towards the allotment, so fewer others are sent.
  const free = new Set(active);
  const sectorOfCell = (c: number): number => Math.floor(Math.floor(c / w) / SECTOR_CELLS) * bw + Math.floor((c % w) / SECTOR_CELLS);
  const index = new Map(list.map((s, i) => [s.key, i] as const));
  for (const id of active) {
    if (f.moving[id] !== 1) continue;
    const i = index.get(sectorOfCell(f.targetCell[id]!));
    if (i === undefined) continue;
    free.delete(id);
    list[i]!.formations.push(id);
    list[i]!.strength += f.strength[id]!;
  }
  // Then nearest-first, most threatened sectors first.
  const byThreat = list.map((s, i) => [s, i] as const).sort((a, b) => b[0].threat - a[0].threat || a[0].key - b[0].key);
  for (const [s, i] of byThreat) {
    for (let k = s.formations.length; k < counts[i]!; k++) {
      let best = -1;
      for (const id of free) if (best < 0 || dist2(id, s) < dist2(best, s) || (dist2(id, s) === dist2(best, s) && id < best)) best = id;
      if (best < 0) break;
      free.delete(best);
      s.formations.push(best);
      s.strength += f.strength[best]!;
    }
  }
  // Orders.
  let pass: Passage | undefined;
  for (const s of list) {
    if (s.formations.length === 0) continue;
    s.cells.sort((a, b) => a - b); // `holdCell` takes the first of equals
    const attack = s.strength >= OFFENSIVE_RATIO * s.threat;
    const target = attack ? attackCell(world, s, enemy, nb) : holdCell(s, w);
    if (target < 0) continue;
    const tx = (target % w) + 0.5;
    const ty = Math.floor(target / w) + 0.5;
    for (const id of s.formations) {
      // Already heading there, or to a cell within one sector of it: no new route.
      if (f.moving[id] === 1 && cellDist(f.targetCell[id]!, target, w) <= SECTOR_CELLS) continue;
      const here = Math.floor(f.y[id]!) * w + Math.floor(f.x[id]!);
      if (here === target) continue;
      orderMove(world, id, tx, ty, (pass ??= passageOf(world, n)));
    }
  }
}

function cellDist(a: number, b: number, w: number): number {
  let dx = Math.abs((a % w) - (b % w));
  if (dx > w / 2) dx = w - dx;
  return Math.max(dx, Math.abs(Math.floor(a / w) - Math.floor(b / w)));
}

/** The own front cell nearest the sector centre (lowest id on ties). */
function holdCell(s: Sector, w: number): number {
  let best = -1;
  let bd = Infinity;
  for (const c of s.cells) {
    const ex = (c % w) + 0.5 - s.cx;
    const ey = Math.floor(c / w) + 0.5 - s.cy;
    const d = ex * ex + ey * ey;
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

/** The enemy cell touching the sector's front nearest its centre (lowest id on ties). */
function attackCell(world: World, s: Sector, enemy: (m: number) => boolean, nb: number[]): number {
  const { w, h, controller } = world.cells;
  let best = -1;
  let bd = Infinity;
  for (const c of s.cells) {
    for (const k of neighbours4(c, w, h, world.settings.loopingMap, nb)) {
      if (!enemy(controller[k]!)) continue;
      const ex = (k % w) + 0.5 - s.cx;
      const ey = Math.floor(k / w) + 0.5 - s.cy;
      const d = ex * ex + ey * ey;
      if (d < bd || (d === bd && k < best)) {
        bd = d;
        best = k;
      }
    }
  }
  return best;
}
