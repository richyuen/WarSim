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
 * Free formations (not engaged, not on the retreat: PLAN 3.5a; not on a march home: PLAN 3.7h, ADR-169) within DEPLOY_RANGE_CELLS of a sector are ranked by distance to
 * the nearest one they reach; the farthest RESERVE share stays put as the reserve (farther ones garrison).
 * Reach (PLAN 3.5b, ADR-152): they are classes by where they stand (landmass, and group of
 * provinces with ground open to the nation), and a class reaches a sector when an order to its
 * front cell would not be refused before the search. Those that stand in a pocket of open ground
 * (PLAN 3.10c2b, ADR-192: no more than `POCKET_CELLS` cells that a route comes to, with closed
 * ground or water around them) are a class of their own, and it reaches the sectors whose front
 * cell is in the pocket: the provinces of a pocket are joined to others that the cells are not.
 * Each class is allotted by itself, to the
 * sectors it reaches: in what follows "they" is one class and "sectors" those.
 * They are allotted to sectors in proportion to 1 + threat/THREAT_UNIT (largest remainders; every
 * sector gets one while formations last). The range is to each sector (PLAN 3.10c1, ADR-187): a
 * sector is allotted no more than the formations of the class within DEPLOY_RANGE_CELLS of it, and
 * takes only those, so a nation with two fronts far apart mans each from the formations near it. A formation already marching into a sector keeps it,
 * whatever the sector's allotment is today (ADR-53: the allotment moves every day with the threat,
 * and a march of weeks that is re-planned daily never arrives); the others fill what is left of
 * the allotments nearest-first, and what is then left joins its nearest sector. A sector whose allotted strength ≥ OFFENSIVE_RATIO × its threat attacks:
 * its formations march on the enemy cell next to the sector's front nearest its centre;
 * otherwise they hold the own front cell nearest the centre. Orders already being followed
 * (target within one sector) or already reached are not re-issued.
 * Spearheads (PLAN 3.5c, ADR-153): where a sector that attacks has armour (`SPEARHEAD_ARMOUR`,
 * by the template: no element is looked at), the armour marches on the enemy cell and the rest
 * hold the front cell; with no armour all of them attack, as above. The rest follow by the
 * plans of the days after: the front cell is where the armour has taken ground.
 * Marches from afar (PLAN 3.10c1a, ADR-190): a sector of the planner's own front that has nobody
 * (no formation of it stands in the sector or next to it, the allotment gave it none, none is on
 * the march into it) takes the nearest formation on its landmass that is far from every sector it
 * reaches and stands still: one a sector, to the sector's front cell, on the formation's day in
 * MARCH_DAYS. The march is not planned again before it ends or comes within the range.
 * To spare (PLAN 3.10c1d, ADR-191): such a sector that no formation of the planner is within the
 * range of also takes one of the formations near the front that are not on an errand (PLAN
 * 3.10c1d2: on the march to a cell beyond the range, or into a sector that would have nobody
 * without them): the farthest from it, as many as the reserve's share, on the nation's day in
 * MARCH_DAYS, from within SPARE_RANGES
 * times the range, while the formations near the front are more than the share of them that the
 * other sectors weigh among all (the weights of the allotment).
 */
import { orderMove, passageOf, snapTarget } from '../systems/movement';
import { frontierOf } from '../systems/territory';
import { inPocket, neighbours4, pocketOf, type Passage } from '../nav/grid';
import { wideNode } from '../nav/provinceGraph';
import { navOf, type World } from '../world';

export const STAGGER = 4;
export const SECTOR_CELLS = 4;
export const RESERVE = 0.15;
export const OFFENSIVE_RATIO = 1.5;
/** Threat (men) worth one extra formation's share in a sector. */
export const THREAT_UNIT = 10_000;
/**
 * Formations farther than this from every front sector stay where they are (garrisons) unless a
 * sector that has nobody takes one (PLAN 3.10c1a, ADR-190), and a sector's allotment takes none
 * from farther than this (PLAN 3.10c1, ADR-187).
 */
export const DEPLOY_RANGE_CELLS = 60;
const RANGE2 = DEPLOY_RANGE_CELLS * DEPLOY_RANGE_CELLS;
/**
 * A formation that is far from every front sector it reaches is looked at on one day in this
 * many (PLAN 3.10c1a, ADR-190): a nation's far army sets out over these days and not in one
 * tick, and a formation whose order was refused is asked again after them, not the day after.
 */
export const MARCH_DAYS = 8;
/**
 * A formation to spare goes to a sector that has nobody up to this many times
 * DEPLOY_RANGE_CELLS away (PLAN 3.10c1d, ADR-191): the far end of its front, not another theatre.
 */
export const SPARE_RANGES = 3;
const SPARE2 = SPARE_RANGES * SPARE_RANGES * RANGE2;
/**
 * A formation with this share of its upkeep in tanks is armour (`EconomyTables.templateArmour`:
 * the armour formations of 1938 have 0.66 to 0.93, the others 0.20 at most).
 */
export const SPEARHEAD_ARMOUR = 0.5;

interface Sector {
  key: number;
  cells: number[];
  cx: number;
  cy: number;
  threat: number;
  formations: number[];
  strength: number;
  /** The own front cell nearest the centre. */
  hold: number;
  /** One of its front cells is the planner's own (the others are its partners'). */
  own: boolean;
}

/** The operational AI with the tanks' share of each template's upkeep (`EconomyTables.templateArmour`). */
export function operationalAiOf(tables: { templateArmour: readonly number[] }) {
  return (world: World): void => operationalAi(world, tables.templateArmour);
}

/** `armour`: the tanks' share of the upkeep by template; none given, no formation is armour. */
export function operationalAi(world: World, armour: readonly number[] = []): void {
  if (!world.settings.aiEnabled || world.tick % 6 !== 0 || world.wars.list.length === 0) return;
  const step = world.tick / 6;
  const nc = world.nations.cols;
  const fighting = world.wars.nations();
  const f = world.formations.cols;
  // A nation with no free formation has nothing to plan (most members of a large coalition, most
  // days): it is skipped before any front is looked at.
  const free = new Uint32Array(world.nations.highWater);
  world.formations.forEach((id) => {
    if (f.engaged[id] !== 1 && f.retreat[id] === 0 && f.home[id] === 0) free[f.nation[id]!]!++;
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
  // Planners with the same ground open to them (the members of a coalition) share one `Passage`.
  const passages = new Map<string, Passage>();
  for (const n of actors) planNation(world, n, fighting, frontier, w, nb, f, passages, armour);
}

/** A holder's frontier cells and, four per cell, the holders of the neighbouring cells (0 = none). */
interface Front {
  cells: number[];
  near: number[];
}

function planNation(world: World, n: number, fighting: Set<number>, frontier: Map<number, Front>, w: number, nb: number[], f: World['formations']['cols'], passages: Map<string, Passage>, armour: readonly number[]): void {
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
      if (!s) sectors.set(key, (s = { key, cells: [], cx: 0, cy: 0, threat: 0, formations: [], strength: 0, hold: -1, own: false }));
      s.cells.push(c);
      if (holder === n) s.own = true;
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
  /** By sector bucket, how many formations of n stand in it, free or not. */
  const stands = new Map<number, number>();
  const mine: number[] = [];
  /** n's formations, free or not. */
  const all: number[] = [];
  world.formations.forEach((id) => {
    const m = f.nation[id]!;
    if (m === n) {
      all.push(id);
      const k = Math.floor(f.y[id]! / SECTOR_CELLS) * bw + Math.floor(f.x[id]! / SECTOR_CELLS);
      stands.set(k, (stands.get(k) ?? 0) + 1);
      if (f.engaged[id] !== 1 && f.retreat[id] === 0 && f.home[id] === 0) mine.push(id);
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
  // Within range of a sector: the others are garrisons, and those of them that stand still may,
  // on their day in `MARCH_DAYS`, be sent to a front of n's own that has nobody (`out`; PLAN 3.10c1a, ADR-190). Neither the
  // one nor the other (45 % of the plans in two years of seed 99 had no formation in range,
  // PLAN 3.4Rm): nothing below would give an order, and the ground is not asked for.
  const ownFront = list.some((s) => s.own);
  const day = Math.floor(world.tick / 24);
  const idle = (id: number): boolean => f.moving[id] !== 1 && (day + id) % MARCH_DAYS === 0;
  const near: number[] = [];
  const nearD: number[] = [];
  const out: number[] = [];
  for (const id of mine) {
    let d = Infinity;
    for (const s of list) d = Math.min(d, dist2(id, s));
    if (d > RANGE2) {
      if (ownFront && idle(id)) out.push(id);
      continue;
    }
    near.push(id);
    nearD.push(d);
  }
  if (near.length === 0 && out.length === 0) return;
  // Reach (PLAN 3.5b): formations that stand on one landmass and in one group of provinces
  // with open ground (or on closed ground, which they walk out of) reach the same places.
  // Each such class is asked once per sector, for the sector's own front cell, what
  // `orderMove` asks before it searches: the cell the order would go to from that landmass
  // (`snapTarget`), then `mayReach`, read here from the two groups: the same test written a
  // second time (the landmass is asked once per class and sector), so a change of `mayReach`
  // is a change of the line that fills `reached` below. Then the cells, where they are few
  // (PLAN 3.10c2b, ADR-192): a class in a pocket of open ground reaches the cells of the pocket
  // and no other, which `mayReach` does not ask and the order's search would find.
  const pass = passageOf(world, n, passages);
  const nav = navOf(world);
  const land = nav.grid.component;
  const nodeOf = nav.graph.nodeOf;
  const group = pass.group!;
  const wideCell = (c: number): boolean => wideNode(nav.graph, pass, nodeOf[c]!);
  const classIndex = new Map<number, number>();
  const classCell: number[] = [];
  const classGroup: number[] = [];
  /** The pocket of open ground the class stands in (0: none). */
  const classPocket: number[] = [];
  const classOf = new Int32Array(world.formations.highWater);
  for (const ids of [near, out]) {
    for (const id of ids) {
      const here = Math.floor(f.y[id]!) * w + Math.floor(f.x[id]!);
      const node = nodeOf[here]!;
      const g = node !== 0 && pass.ok[pass.holder[here]!] === 1 ? group[node]! : -1;
      const pocket = g < 0 || wideNode(nav.graph, pass, node) ? 0 : pocketOf(nav.grid, pass, here, wideCell);
      // A pocket is of one landmass and one group.
      const key = pocket > 0 ? -pocket : land[here]! * (nav.graph.nodeCount + 1) + g + 1;
      let ci = classIndex.get(key);
      if (ci === undefined) {
        classIndex.set(key, (ci = classCell.length));
        classCell.push(here);
        classGroup.push(g);
        classPocket.push(pocket);
      }
      classOf[id] = ci;
    }
  }
  const sn = list.length;
  // reached[ci]: the sectors class ci reaches, ascending.
  const reached: number[][] = classCell.map(() => []);
  for (let i = 0; i < sn; i++) {
    const s = list[i]!;
    s.cells.sort((a, b) => a - b); // `holdCell` takes the first of equals
    const hold = (s.hold = holdCell(s, w));
    // From another landmass: the cell of it within the snap of an order, once per landmass.
    let other: Map<number, number> | undefined;
    for (let ci = 0; ci < classCell.length; ci++) {
      const from = classCell[ci]!;
      const g = classGroup[ci]!;
      let to = hold;
      if (land[from] !== land[hold] || land[hold] === 0) {
        const known = (other ??= new Map()).get(land[from]!);
        to = known ?? snapTarget(world, from, hold % w, Math.floor(hold / w));
        if (known === undefined) other.set(land[from]!, to);
      }
      if (to < 0 || (g >= 0 && nodeOf[to] !== 0 && group[nodeOf[to]!] !== g)) continue;
      if (classPocket[ci]! > 0 && !inPocket(nav.grid, pass, to, classPocket[ci]!)) continue;
      reached[ci]!.push(i);
    }
  }
  // Reserve: the farthest RESERVE share of free formations within range of a sector they reach
  // stays put.
  const nearest = new Map<number, number>();
  for (let k = 0; k < near.length; k++) {
    const id = near[k]!;
    const ci = classOf[id]!;
    let d = nearD[k]!;
    if (reached[ci]!.length < sn) {
      d = Infinity;
      for (const i of reached[ci]!) d = Math.min(d, dist2(id, list[i]!));
    }
    if (d <= RANGE2) nearest.set(id, d);
  }
  const ranked = [...nearest.keys()].sort((a, b) => nearest.get(a)! - nearest.get(b)! || a - b);
  const active = ranked.slice(0, ranked.length - Math.floor(ranked.length * RESERVE));
  // Far from every sector they reach, standing still, and theirs the day (ascending).
  const far = ownFront ? [...near.filter((id) => !nearest.has(id) && idle(id)), ...out].sort((a, b) => a - b) : [];
  if (active.length === 0 && far.length === 0) return;
  // Threat: enemy formations by sector bucket, summed over each sector's 3 × 3 neighbourhood.
  for (const s of list) {
    const sy = Math.floor(s.key / bw);
    const sx = s.key - sy * bw;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s.threat += enemyByBucket.get((sy + dy) * bw + ((sx + dx + bw) % bw)) ?? 0;
  }
  const sectorOfCell = (c: number): number => Math.floor(Math.floor(c / w) / SECTOR_CELLS) * bw + Math.floor((c % w) / SECTOR_CELLS);
  const index = new Map(list.map((s, i) => [s.key, i] as const));
  /** By sector, how many free formations of n march into it. */
  const marchers = new Int32Array(sn);
  for (const id of mine) {
    if (f.moving[id] !== 1) continue;
    const i = index.get(sectorOfCell(f.targetCell[id]!));
    if (i !== undefined) marchers[i]!++;
  }
  /** How many formations of n stand in the sector or next to it. */
  const stoodAt = (s: Sector): number => {
    const sy = Math.floor(s.key / bw);
    const sx = s.key - sy * bw;
    let c = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) c += stands.get((sy + dy) * bw + ((sx + dx + bw) % bw)) ?? 0;
    return c;
  };
  // On an errand (PLAN 3.10c1d2, ADR-191's amendment): on the march to a cell beyond the range
  // (no allotment orders that far: it was sent to a sector that had nobody), or into a sector
  // that would have nobody without it (no other formation of n stands in it or next to it, none
  // other marches into it). A formation that this rule sent is on one until it is there, or
  // until another has come to its sector.
  const onErrand = (id: number): boolean => {
    if (f.moving[id] !== 1) return false;
    const to = f.targetCell[id]!;
    let tx = Math.abs(f.x[id]! - ((to % w) + 0.5));
    if (tx > w / 2) tx = w - tx;
    const ty = f.y[id]! - (Math.floor(to / w) + 0.5);
    if (tx * tx + ty * ty > RANGE2) return true;
    const i = index.get(sectorOfCell(to));
    if (i === undefined || marchers[i]! > 1) return false;
    const s = list[i]!;
    const by = Math.floor(f.y[id]! / SECTOR_CELLS);
    const bx = Math.floor(f.x[id]! / SECTOR_CELLS);
    const sy = Math.floor(s.key / bw);
    let dx = Math.abs(bx - (s.key - sy * bw));
    if (dx > bw / 2) dx = bw - dx;
    return stoodAt(s) - (dx <= 1 && Math.abs(by - sy) <= 1 ? 1 : 0) === 0;
  };
  // To spare (PLAN 3.10c1d, ADR-191): on the nation's day in `MARCH_DAYS`, of the formations
  // near the front that are not on an errand, on the march or not (PLAN 3.10c1d2: on a front that
  // fights nearly all of them march, every day, to their sector's cell), the farthest from it, as
  // many as the reserve's share.
  const spare: number[] = [];
  if (ownFront && (day + n) % MARCH_DAYS === 0) {
    const most = Math.max(1, ranked.length - active.length);
    for (let k = ranked.length - 1; k >= 0 && spare.length < most; k--) if (!onErrand(ranked[k]!)) spare.push(ranked[k]!);
  }
  const byThreat = list.map((_, i) => i).sort((a, b) => list[b]!.threat - list[a]!.threat || list[a]!.key - list[b]!.key);
  const byClass: number[][] = classCell.map(() => []);
  for (const id of active) byClass[classOf[id]!]!.push(id);
  /** Of the class in hand: a sector's place among those it reaches, and how many of the class march into it. */
  const place = new Int32Array(sn);
  const has = new Int32Array(sn);
  // Each class is allotted to the sectors it reaches, and to no other.
  for (let ci = 0; ci < byClass.length; ci++) {
    const ids = byClass[ci]!;
    if (ids.length === 0) continue;
    // The sectors of the class: those it reaches that have one of its formations within the
    // range (PLAN 3.10c1, ADR-187), with how many (`pool`).
    const front: number[] = [];
    const pool: number[] = [];
    for (const i of reached[ci]!) {
      let p = 0;
      for (const id of ids) if (dist2(id, list[i]!) <= RANGE2) p++;
      if (p === 0) continue;
      front.push(i);
      pool.push(p);
    }
    has.fill(0);
    place.fill(-1);
    for (let k = 0; k < front.length; k++) place[front[k]!] = k;
    // Allotment by largest remainders over weights 1 + threat/THREAT_UNIT. A sector is allotted
    // no more than its pool: one whose share is more takes its pool, and the others share the
    // rest by their weights.
    const weights = front.map((i) => 1 + list[i]!.threat / THREAT_UNIT);
    const counts = front.map(() => 0);
    const open = new Set(front.map((_, k) => k));
    let left = ids.length;
    for (let capped = true; capped && open.size > 0; ) {
      capped = false;
      let total = 0;
      for (const k of open) total += weights[k]!;
      const share = left / total;
      for (const k of open) {
        if (share * weights[k]! <= pool[k]!) continue;
        counts[k] = pool[k]!;
        left -= pool[k]!;
        open.delete(k);
        capped = true;
      }
    }
    if (open.size > 0) {
      let total = 0;
      for (const k of open) total += weights[k]!;
      const quota = [...open].map((k) => [k, (left * weights[k]!) / total] as const);
      for (const [k, q] of quota) {
        counts[k] = Math.floor(q);
        left -= counts[k]!;
      }
      quota.sort((a, b) => b[1] - Math.floor(b[1]) - (a[1] - Math.floor(a[1])) || a[0] - b[0]);
      for (const [k] of quota) {
        if (left <= 0) break;
        if (counts[k]! >= pool[k]!) continue;
        counts[k]!++;
        left--;
      }
    }
    // Every sector gets one while formations last: take from the largest allotments.
    for (let k = 0; k < counts.length; k++) {
      if (counts[k]! > 0) continue;
      let j = -1;
      for (let m = 0; m < counts.length; m++) if (counts[m]! > 1 && (j < 0 || counts[m]! > counts[j]!)) j = m;
      if (j < 0) break;
      counts[j]!--;
      counts[k] = 1;
    }
    // Sticky first: a formation already marching into a sector keeps it, also beyond the sector's
    // allotment of today (ADR-53). It counts towards the allotment, so fewer others are sent.
    const free = new Set(ids);
    for (const id of ids) {
      if (f.moving[id] !== 1) continue;
      const i = index.get(sectorOfCell(f.targetCell[id]!));
      if (i === undefined) continue;
      free.delete(id);
      list[i]!.formations.push(id);
      list[i]!.strength += f.strength[id]!;
      has[i]!++;
    }
    // Then nearest-first, most threatened sectors first, each sector from the formations
    // within the range of it.
    for (const i of byThreat) {
      if (place[i]! < 0) continue;
      const s = list[i]!;
      for (let m = has[i]!; m < counts[place[i]!]!; m++) {
        let best = -1;
        let bd = Infinity;
        for (const id of free) {
          const d = dist2(id, s);
          if (d > RANGE2) continue;
          if (d < bd || (d === bd && id < best)) {
            bd = d;
            best = id;
          }
        }
        if (best < 0) break;
        free.delete(best);
        s.formations.push(best);
        s.strength += f.strength[best]!;
      }
    }
    // Those left over (the allotments near them were taken by others, or by marches kept above)
    // join the nearest sector of the class: it is within the range, or they would not be here.
    for (const id of free) {
      let best = -1;
      let bd = Infinity;
      for (const i of front) {
        const d = dist2(id, list[i]!);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      if (best < 0) continue;
      list[best]!.formations.push(id);
      list[best]!.strength += f.strength[id]!;
    }
  }
  // Marches from afar (PLAN 3.10c1a, ADR-190): a front sector of n's own that has nobody takes
  // the nearest formation on its landmass that is far from every sector it reaches and stands still. Nobody: no
  // formation of n stands in the sector or next to it, the allotment above gave it none, and
  // none is on the march into it. One formation a sector and one order a sector and plan, also
  // when the order is refused. The march is not planned again while it lasts: a formation on
  // the march is not in `far`, and within the range of the sector it is kept as any march is.
  if (far.length > 0 || spare.length > 0) {
    const empty = new Uint8Array(sn);
    let empties = 0;
    for (let i = 0; i < sn; i++) {
      const s = list[i]!;
      if (!s.own || s.formations.length > 0) continue;
      if (marchers[i]! > 0 || stoodAt(s) > 0) continue;
      empty[i] = 1;
      empties++;
    }
    /** Of a sector: 1 = no formation of n is within the range of it, 2 = one is (0: not asked yet). */
    const alone = new Uint8Array(sn);
    const isAlone = (i: number): boolean => {
      if (alone[i] === 0) alone[i] = all.some((id) => dist2(id, list[i]!) <= RANGE2) ? 2 : 1;
      return alone[i] === 1;
    };
    /**
     * The nearest empty sector the formation's class reaches, and its distance (squared). For one
     * to spare (`lone`): of those that nobody is within the range of, within the spare's range.
     */
    const emptyFor = (id: number, lone: boolean): [number, number] => {
      let best = -1;
      let bd = lone ? SPARE2 : Infinity;
      const ci = classOf[id]!;
      for (const i of reached[ci]!) {
        // Not to the shore across the water from it (where an order to another landmass ends).
        if (empty[i] === 0 || land[list[i]!.hold] !== land[classCell[ci]!]) continue;
        const d = dist2(id, list[i]!);
        if (d < bd && (!lone || isAlone(i))) {
          bd = d;
          best = i;
        }
      }
      return [best, bd];
    };
    if (empties > 0) {
      const wants = far.map((id) => [id, ...emptyFor(id, false), 0] as [number, number, number, number]).filter((q) => q[1] >= 0);
      if (spare.length > 0) {
        // What the front can spare: the formations near it less the share of them that the
        // sectors within the range of somebody weigh among all its sectors.
        let manned = 0;
        let open = 0;
        for (let i = 0; i < sn; i++) {
          const weight = 1 + list[i]!.threat / THREAT_UNIT;
          if (empty[i] === 1 && isAlone(i)) open += weight;
          else manned += weight;
        }
        let give = ranked.length - Math.ceil((ranked.length * manned) / (manned + open));
        for (const id of spare) {
          if (give <= 0) break;
          const [i, d] = emptyFor(id, true);
          if (i < 0) continue;
          wants.push([id, i, d, 1]);
          give--;
        }
      }
      wants.sort((a, b) => a[2] - b[2] || a[0] - b[0]);
      for (const [id, first, , lone] of wants) {
        if (empties === 0) break;
        // Its sector was taken by a nearer formation: the nearest that is still empty.
        const i = empty[first] === 1 ? first : emptyFor(id, lone === 1)[0];
        if (i < 0) continue;
        empty[i] = 0;
        empties--;
        const to = list[i]!.hold;
        orderMove(world, id, (to % w) + 0.5, Math.floor(to / w) + 0.5, pass);
        // One to spare leaves the sector the allotment gave it: no order of that sector below.
        if (lone === 1) {
          for (const s of list) {
            const at = s.formations.indexOf(id);
            if (at < 0) continue;
            s.formations.splice(at, 1);
            s.strength -= f.strength[id]!;
            break;
          }
        }
      }
    }
  }
  // Orders.
  const isArmour = (id: number): boolean => (armour[f.template[id]!] ?? 0) >= SPEARHEAD_ARMOUR;
  for (const s of list) {
    if (s.formations.length === 0) continue;
    const attack = s.strength >= OFFENSIVE_RATIO * s.threat;
    const target = attack ? attackCell(world, s, enemy, nb) : s.hold;
    if (target < 0) continue;
    // Spearheads: armour leads the attack, and where it does the rest hold the front.
    const lead = attack && s.formations.some(isArmour);
    for (const id of s.formations) {
      const to = lead && !isArmour(id) ? s.hold : target;
      // Already heading there, or to a cell within one sector of it: no new route.
      if (f.moving[id] === 1 && cellDist(f.targetCell[id]!, to, w) <= SECTOR_CELLS) continue;
      const here = Math.floor(f.y[id]!) * w + Math.floor(f.x[id]!);
      if (here === to) continue;
      orderMove(world, id, (to % w) + 0.5, Math.floor(to / w) + 0.5, pass);
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
