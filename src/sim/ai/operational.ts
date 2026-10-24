/**
 * Operational AI v1 (SPEC §7, PLAN 1.25): front allocation, offensives, reserves.
 *
 * Every 6 hours, nation n (AI on, at war) plans when (tick/6 + n) mod STAGGER = 0, i.e. once a
 * day. Its front cells are the frontier cells that it, or a nation fighting that enemy on its
 * side, controls and that touch an enemy's cell (PLAN 1.42b: an ally's front is its front too,
 * within DEPLOY_RANGE_CELLS of its formations); they are
 * grouped into sectors of SECTOR_CELLS × SECTOR_CELLS cells (ascending key). A sector's threat is
 * the enemy strength in its 3 × 3 sector neighbourhood. On a map that does not loop no distance
 * and no neighbourhood of what follows goes over the seam (PLAN 3.12Rsd, ADR-237).
 *
 * Free formations (not engaged, not on the retreat: PLAN 3.5a; not on a march home: PLAN 3.7h, ADR-169) within DEPLOY_RANGE_CELLS of a sector are ranked by distance to
 * the nearest one they reach; the farthest RESERVE share stays put as the reserve (farther ones garrison).
 * Reach (PLAN 3.5b, ADR-152): they are classes by where they stand (landmass, and group of
 * provinces with ground open to the nation), and a class reaches a sector when an order to its
 * front cell would not be refused before the search. Those that stand in a pocket of open ground
 * (PLAN 3.10c2b, ADR-192: no more than `POCKET_CELLS` cells that a route comes to, with closed
 * ground or water around them) are a class of their own, and it reaches the sectors whose front
 * cell is in the pocket: the provinces of a pocket are joined to others that the cells are not.
 * And a sector whose front cell is in a pocket is reached by the class of that pocket alone (PLAN
 * 3.10c2b2). Wide ground is not one either (PLAN 3.10c2b3a, ADR-193): those that stand in a wide
 * ground, or on open ground whose cells come to one, are a class by that ground, and it reaches
 * a sector whose front cell is in another wide ground, or comes to another, only when the cells
 * join the two (`wideJoined`).
 * Each class is allotted by itself, to the
 * sectors it reaches: in what follows "they" is one class and "sectors" those.
 * They are allotted to the threatened sectors first (PLAN 7.79b, ADR-634): those with a threat
 * share, in proportion to it, as many as there are of them within the range of one, and the other
 * sectors share what is left in proportion to 1 + threat/THREAT_UNIT (largest remainders; every
 * sector gets one while formations last, taken from the largest allotments of those with no
 * threat). The range is to each sector (PLAN 3.10c1, ADR-187): a
 * sector is allotted no more than the formations of the class within DEPLOY_RANGE_CELLS of it, and
 * takes only those, so a nation with two fronts far apart mans each from the formations near it. A formation already marching into a sector keeps it,
 * whatever the sector's allotment is today (ADR-53: the allotment moves every day with the threat,
 * and a march of weeks that is re-planned daily never arrives), but for one marching into a
 * sector with no threat that is within the range of a threatened sector, its march begun within
 * the range of its sector: it yields to the threatened sectors' allotments and keeps its march
 * when none takes it (ADR-634); the others fill what is left of
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
 * A partner's front (PLAN 7.26c1a, ADR-509): a planner with no front cell of its own in its wars
 * sends its far formations so to the sectors of its partners' front that have nobody of the side
 * (no formation of the planner or of a nation on its side stands in the sector or next to it).
 * A planner with a front of its own sends a far formation so too where the formation reaches no
 * sector of its own front that has nobody (PLAN 7.26c1b, ADR-513): its own sectors first.
 * To spare (PLAN 3.10c1d, ADR-191): such a sector that no formation of the planner is within the
 * range of also takes one of the formations near the front that are not on an errand (PLAN
 * 3.10c1d2: on the march to a cell beyond the range, or into a sector that would have nobody
 * without them): the farthest from it, as many as the reserve's share, on the nation's day in
 * MARCH_DAYS, from within SPARE_RANGES
 * times the range, while the formations near the front are more than the share of them that the
 * other sectors weigh among all (the weights of the allotment).
 * Refused orders (PLAN 1.42g): an order refused for want of a way is not given again while nothing
 * the refused search read has changed (`askMove`).
 * Long ways (PLAN 1.42h, ADR-422): an order is refused where its way is longer than LONG_WAY times
 * the straight line (`orderMove`'s `direct`); the formation then takes the nearest other sector of
 * its class within the range, by its own front cell, up to DIVERTS of them, and else holds.
 */
import { atAnyPort, marchingToPort, transportPorts } from '../systems/amphibious';
import { orderMove, passageOf, snapTarget, wasLong } from '../systems/movement';
import { frontierOf, frontNeighbours, GARRISON, PRESSURE_RADIUS } from '../systems/territory';
import { pocketOf, type Passage } from '../nav/grid';
import { CORRIDOR_REFUSAL, wideJoined, wideNode, type CorridorRefusal } from '../nav/provinceGraph';
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
/**
 * This world's sector and deploy range, cells (ADR-416: `SECTOR_CELLS` and `DEPLOY_RANGE_CELLS`
 * are of the map's default size, `World.atSize` here), and the squares of the range and of the
 * spare range; set by `operationalAi` for the world it plans.
 */
let sector = SECTOR_CELLS;
let range = DEPLOY_RANGE_CELLS;
let range2 = range * range;
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
let spare2 = SPARE_RANGES * SPARE_RANGES * range2;
/** This world's `takeMen`: set by `operationalAi` for the world it plans. */
let take = 1500;

/**
 * The men a formation needs to take a cell (PLAN 7.26c2, ADR-510): from the cell beside it, at
 * full supply, its pressure (`territory.ts`: men / 1000 × (1 − 1 / (R + 1))) beats GARRISON on
 * plains. A formation of no more does not man a sector for the marches from afar: it stands at
 * the enemy's cell, and the cell never flips (seed 7919's Brazil: four of 130 to 707 men held
 * Paraguay's front for 600 days while a division of 12,460 stood 70 cells away).
 */
export function takeMen(world: World): number {
  const r = world.atSizeWhole(PRESSURE_RADIUS);
  return (1000 * GARRISON * (r + 1)) / r;
}
/**
 * A formation with this share of its upkeep in tanks is armour (`EconomyTables.templateArmour`:
 * the armour formations of 1938 have 0.66 to 0.93, the others 0.20 at most).
 */
export const SPEARHEAD_ARMOUR = 0.5;
/** How many other sectors a formation refused a long way is asked for (PLAN 1.42h), nearest first. */
export const DIVERTS = 2;

/**
 * A measure of the plans (PLAN 7.30, `tools/diag/opCalls.ts`): with a clock set, each plan is
 * timed by its parts and handed to `plan`. None set (the game, the tests), nothing is timed. Not
 * state: in no save and no hash, and a timed plan gives the orders an untimed one gives.
 */
export const OP_PROBE: { now?: () => number; plan?: (p: PlanTimes) => void; ask?: (a: AskTimes) => void; sectors?: (s: SectorsSeen) => void } = {};

/**
 * One plan's sectors at its orders (`OP_PROBE.sectors`, PLAN 7.79a, `tools/diag/frontSpread.ts`):
 * each sector's threat, formations, strength and whether it attacks; and per class allotted, its
 * formations, its sectors, and the formations allotted to sectors with a threat before and after
 * "every sector gets one"; those placed in a threatened sector (`filled`, PLAN 7.79b), and those
 * the threatened sectors could take (`canTake`: of its formations, those within the range of a
 * threatened sector it is allotted to), and of those the ones kept on a march into a sector with no
 * threat (`keptCold`).
 */
export interface SectorsSeen {
  nation: number;
  tick: number;
  sectors: { threat: number; n: number; strength: number; attack: boolean; cx: number; cy: number; inRange?: boolean }[];
  classes: { ids: number; front: number; threatened: number; before: number; after: number; filled: number; canTake: number; keptCold: number }[];
  /** Of the marches from afar: sectors with no taker allotted passed over for a taker marching in, for one of the planner's standing in or next to it, for one of its side's (a partner's sector); the empty sectors (-1: not looked for: no far formation and none to spare); the far formations; summed over the far formations' searches, the empty sectors their class reaches (`reached`), those on another landmass, and those `reaches` refused; per class with far formations, its cell, ground and province group, the empty sectors it reaches, and the sectors it does not reach for want of a snapped cell, for another province group, for another pocket. */
  empty?: { takers: number; stood: number; sideStood: number; empties: number; far: number; reachedEmpty: number; otherLand: number; unreached: number; farHot?: number; farHotCells?: number; farHotNear?: number; classes?: { cell: number; ground: number; provinceGroup: number; far: number; reached: number; snap: number; group: number; pocket: number }[] } | undefined;
}

/** One `askMove` of a timed plan (`OP_PROBE`): the formation, the cell it stood on, the cell asked, the answer, ms, and the refusal kept for it before the call. */
export interface AskTimes {
  id: number;
  from: number;
  to: number;
  answer: 'ok' | 'refused' | 'long';
  ms: number;
  was: World['refusedOrders'] extends Map<number, infer V> ? V | undefined : never;
  /** Whether the ask came from the marches from afar (else from the orders). */
  afar: boolean;
  /** The ground it was asked on. */
  pass: Passage;
  /** Whether a route was searched for it (`CORRIDOR_REFUSAL.searches`; not: a kept refusal answered). */
  searched: boolean;
}

/** One plan's parts, ms, and its sizes (`OP_PROBE`). */
export interface PlanTimes {
  nation: number;
  tick: number;
  /** ms: the sectors (`sectorShape`, the planner's copy); the formations near and far; `passageOf`; the classes and `reached`; the reserve and threat; the allotment; the marches from afar; the orders. */
  parts: number[];
  sectors: number;
  mine: number;
  near: number;
  far: number;
  classes: number;
  /** `askMove` calls and their ms (in the marches from afar and the orders). */
  asks: number;
  askMs: number;
  /** `reaches` calls that asked `wideJoined`, and their ms. */
  joins: number;
  joinMs: number;
  /** `groundOf` calls and their ms. */
  grounds: number;
  groundMs: number;
}
/**
 * Allots up to `left` formations to the sectors `keys` (indices into `pool` and `counts`) by
 * largest remainders over `weight`, each no more than its pool: one whose share is more takes its
 * pool, and the others share the rest by their weights. Returns how many it allotted.
 */
function allot(keys: readonly number[], weight: (k: number) => number, pool: readonly number[], left: number, counts: number[]): number {
  const start = left;
  const open = new Set(keys);
  for (let capped = true; capped && open.size > 0; ) {
    capped = false;
    let total = 0;
    for (const k of open) total += weight(k);
    const share = left / total;
    for (const k of open) {
      if (share * weight(k) <= pool[k]!) continue;
      counts[k] = pool[k]!;
      left -= pool[k]!;
      open.delete(k);
      capped = true;
    }
  }
  if (open.size > 0) {
    let total = 0;
    for (const k of open) total += weight(k);
    const quota = [...open].map((k) => [k, (left * weight(k)) / total] as const);
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
  return start - left;
}

/** The plan being timed, and the clock's reading at its last mark (`OP_PROBE`). */
let timing: PlanTimes | undefined;
let lastMark = 0;
/** Ends a part of the plan being timed. */
function mark(): void {
  if (!timing) return;
  const t = OP_PROBE.now!();
  timing.parts.push(t - lastMark);
  lastMark = t;
}

interface Sector {
  key: number;
  /** Its front cells, by the parts they came from (`FrontPart.cells`, shared: never written). */
  cells: number[][];
  /** How many. */
  count: number;
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
  sector = world.atSize(SECTOR_CELLS);
  range = world.atSize(DEPLOY_RANGE_CELLS);
  range2 = range * range;
  spare2 = SPARE_RANGES * SPARE_RANGES * range2;
  take = takeMen(world);
  if (!world.settings.aiEnabled || world.tick % 6 !== 0 || world.wars.list.length === 0) return;
  const step = world.tick / 6;
  const nc = world.nations.cols;
  const fighting = world.wars.nations();
  const f = world.formations.cols;
  // A nation with no free formation has nothing to plan (most members of a large coalition, most
  // days): it is skipped before any front is looked at.
  const free = new Uint32Array(world.nations.highWater);
  world.formations.forEach((id) => {
    // A fleet is sent to no front (PLAN 4.2b): the naval AI is PLAN 4.6.
    if (f.engaged[id] !== 1 && f.retreat[id] === 0 && f.home[id] === 0 && !world.offLand(id)) free[f.nation[id]!]!++;
  });
  const actors = [...fighting].filter((n) => nc.living[n] === 1 && nc.aiOff[n] !== 1 && (step + n) % STAGGER === 0 && free[n]! > 0).sort((a, b) => a - b);
  if (actors.length === 0) return;
  const { w, controller } = world.cells;
  // The frontier by holder, once for all of this tick's planners. Each planner reads only its own
  // cells and its partners' (PLAN 1.42f: scanning the whole frontier per planner was a quarter of
  // the tick in a world of many wars).
  const frontier = new Map<number, Front>();
  const nb: number[] = [];
  let last: Front | undefined;
  let lastHolder = -1;
  for (const c of frontierOf(world)) {
    const holder = controller[c]!;
    let fr = holder === lastHolder ? last! : frontier.get(holder);
    if (!fr) frontier.set(holder, (fr = { cells: [] }));
    last = fr;
    lastHolder = holder;
    fr.cells.push(c);
  }
  // Planners with the same ground open to them (the members of a coalition) share one `Passage`.
  const passages = new Map<string, Passage>();
  const stand = standings(world, w);
  for (const n of actors) {
    const clock = OP_PROBE.now;
    if (clock) {
      timing = { nation: n, tick: world.tick, parts: [], sectors: 0, mine: 0, near: 0, far: 0, classes: 0, asks: 0, askMs: 0, joins: 0, joinMs: 0, grounds: 0, groundMs: 0 };
      lastMark = clock();
    }
    planNation(world, n, fighting, frontier, w, nb, f, passages, armour, stand);
    if (timing) {
      mark();
      OP_PROBE.plan?.(timing);
      timing = undefined;
    }
  }
}

/**
 * The formations once for all of a tick's planners (PLAN 7.1g: each planner walked them all), in
 * the order of `formations.forEach`: by nation, and those on land by sector bucket. An order of a
 * plan moves a formation within its cell (`orderMove` sets it on the cell's point), so not out of
 * its bucket, or puts it aboard (`tryLanding`), and none comes ashore (the amphibious system
 * lands them): those of a bucket are asked whether they are off land once `world.embarked` has
 * grown from `embarked`.
 */
interface Standings {
  byNation: Map<number, number[]>;
  byBucket: Map<number, number[]>;
  embarked: number;
  /** By nation, its enemies among those at war as a mask by nation, once asked (`foesOf`). */
  foes: Map<number, Uint8Array>;
  /** A holder's front for a set of enemies, by the holder and the set (`frontPart`). */
  fronts: Map<string, FrontPart>;
  /** The sectors of a side for a set of enemies, by the set and the side (`sectorShape`). */
  sectors: Map<string, SectorShape>;
}

/** A sector as the planners of a side with the same enemies all have it (`sectorShape`). */
interface SectorShape {
  /** By ascending key, with the holders of the side that have front cells in it. */
  list: (Pick<Sector, 'key' | 'cells' | 'count' | 'cx' | 'cy' | 'hold'> & { holders: number[] })[];
  /** The sectors' threats, once a plan has summed them, and `world.embarked.size` then (-1: none yet). */
  threat: number[];
  threatAt: number;
}

/**
 * The sectors of the front cells of the side's holders (n and those on its side, in the
 * frontier's order) that touch an enemy of n whom the holder fights too: by ascending key, each
 * with its centre and the own front cell nearest it (`holdCell`).
 */
function sectorShape(world: World, side: number[], frontier: Map<number, Front>, enemyKey: string, enemyOf: Uint8Array, enemies: number[], n: number, fighting: Set<number>, stand: Standings, w: number, bw: number): SectorShape {
  /** The sectors in the order they were met. */
  const made: SectorShape['list'] = [];
  // By sector bucket, the sector's number in `made` while `stamp` is this call's (PLAN 7.111: in place
  // of a `Map` by key, as `SLOTS`).
  const buckets = bw * Math.ceil(world.cells.h / sector);
  if (SHAPE.stamp.length !== buckets) {
    SHAPE.stamp = new Uint32Array(buckets);
    SHAPE.at = new Int32Array(buckets);
    SHAPE.gen = 0;
  }
  if (++SHAPE.gen === 0xffffffff) {
    SHAPE.stamp.fill(0);
    SHAPE.gen = 1;
  }
  const { stamp, at, gen } = SHAPE;
  for (const holder of side) {
    const id = `${holder}:${enemyKey}`;
    let part = stand.fronts.get(id);
    if (!part) {
      const theirs = holder === n ? enemyOf : foesOf(world, holder, fighting, stand);
      const foe = new Uint8Array(world.nations.highWater);
      for (const m of enemies) if (theirs[m] === 1) foe[m] = 1;
      stand.fronts.set(id, (part = frontPart(world, frontier.get(holder)!, foe, bw)));
    }
    for (let j = 0; j < part.keys.length; j++) {
      const key = part.keys[j]!;
      let i: number;
      if (stamp[key] === gen) i = at[key]!;
      else {
        stamp[key] = gen;
        at[key] = i = made.length;
        made.push({ key, cells: [], count: 0, cx: 0, cy: 0, hold: -1, holders: [] });
      }
      const s = made[i]!;
      s.cells.push(part.cells[j]!);
      s.count += part.cells[j]!.length;
      // The centre's sums, of half-integers: the same in any order of the cells (and no other
      // reading of them takes their order: `holdCell` and `attackCell` take the lowest of equals).
      s.cx += part.sx[j]!;
      s.cy += part.sy[j]!;
      if (s.holders[s.holders.length - 1] !== holder) s.holders.push(holder);
    }
  }
  // By ascending key (the keys are distinct): sorted as numbers in a typed array, not as objects.
  const keys = new Float64Array(made.length);
  for (let i = 0; i < made.length; i++) keys[i] = made[i]!.key;
  keys.sort();
  const list = new Array<SectorShape['list'][number]>(made.length);
  for (let i = 0; i < keys.length; i++) list[i] = made[at[keys[i]!]!]!;
  for (const s of list) {
    s.cx /= s.count;
    s.cy /= s.count;
    s.hold = holdCell(s, w);
  }
  return { list, threat: [], threatAt: -1 };
}

/**
 * A holder's front cells for one set of enemies (those that touch one of them), by sector bucket
 * in the order met: the cells of `keys[j]` are `cells[j]`, in the frontier's order, and the sums
 * of their centres' x and y `sx[j]` and `sy[j]`. The planners of a tick that share a partner and
 * the enemies it fights beside them share it (PLAN 7.1i: four in five of the frontier cells a
 * tick's planners walked were walked by another of them before).
 */
interface FrontPart {
  keys: number[];
  cells: number[][];
  sx: number[];
  sy: number[];
}

function frontPart(world: World, fr: Front, foe: Uint8Array, bw: number): FrontPart {
  const part: FrontPart = { keys: [], cells: [], sx: [], sy: [] };
  const at = new Map<number, number>();
  const { cells } = fr;
  const { w, h, controller } = world.cells;
  const loop = world.settings.loopingMap;
  let lastKey = -1;
  let j = -1;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]!;
    const x = c % w;
    // The holders of the four neighbours (north, south, west, east; none where the map ends), as
    // they were when the frontier was taken: no plan of the tick moves a cell's controller.
    if (
      foe[c >= w ? controller[c - w]! : 0] !== 1 &&
      foe[c < (h - 1) * w ? controller[c + w]! : 0] !== 1 &&
      foe[x > 0 ? controller[c - 1]! : loop ? controller[c + w - 1]! : 0] !== 1 &&
      foe[x < w - 1 ? controller[c + 1]! : loop ? controller[c - w + 1]! : 0] !== 1
    )
      continue;
    const y = (c - x) / w;
    const key = Math.floor(y / sector) * bw + Math.floor(x / sector);
    if (key !== lastKey) {
      lastKey = key;
      const known = at.get(key);
      if (known === undefined) {
        at.set(key, (j = part.keys.length));
        part.keys.push(key);
        part.cells.push([]);
        part.sx.push(0);
        part.sy.push(0);
      } else j = known;
    }
    part.cells[j]!.push(c);
    part.sx[j]! += x + 0.5;
    part.sy[j]! += y + 0.5;
  }
  return part;
}

function standings(world: World, w: number): Standings {
  const f = world.formations.cols;
  const bw = Math.ceil(w / sector);
  const byNation = new Map<number, number[]>();
  const byBucket = new Map<number, number[]>();
  world.formations.forEach((id) => {
    const n = f.nation[id]!;
    let ids = byNation.get(n);
    if (!ids) byNation.set(n, (ids = []));
    ids.push(id);
    if (world.offLand(id)) return;
    const k = Math.floor(f.y[id]! / sector) * bw + Math.floor(f.x[id]! / sector);
    let at = byBucket.get(k);
    if (!at) byBucket.set(k, (at = []));
    at.push(id);
  });
  return { byNation, byBucket, embarked: world.embarked.size, foes: new Map(), fronts: new Map(), sectors: new Map() };
}

/**
 * By sector bucket, the sector of the plan in hand there (PLAN 7.1g: in place of a `Map` by key):
 * `at[k]` while `stamp[k]` is the plan's `gen`; its number in the plan's list once that is sorted.
 * And the strength of the planner's enemies in it, `enemy[k]` while `summed[k]` is `gen`: the
 * nine buckets about a sector are mostly those of its neighbours too. The plans of a tick come
 * one after another.
 */
const SLOTS = { stamp: new Uint32Array(0), at: new Int32Array(0), summed: new Uint32Array(0), enemy: new Float64Array(0), gen: 0 };
/** By sector bucket, a sector of the `sectorShape` call in hand: `at[k]` while `stamp[k]` is its `gen`. */
const SHAPE = { stamp: new Uint32Array(0), at: new Int32Array(0), gen: 0 };

/** Nation m's enemies among `fighting`, as a mask by nation: once a tick (PLAN 7.1g). */
function foesOf(world: World, m: number, fighting: Set<number>, stand: Standings): Uint8Array {
  let mask = stand.foes.get(m);
  if (!mask) {
    mask = new Uint8Array(world.nations.highWater);
    for (const e of fighting) if (world.wars.atWar(m, e)) mask[e] = 1;
    stand.foes.set(m, mask);
  }
  return mask;
}

/**
 * The ground a cell of open ground lies in on passage `pass`: a pocket (its number), a wide ground
 * or ground whose cells come to one (minus the wide ground's number), or 0 for ground too wide to
 * walk that came to none (PLAN 3.10c2b, 3.10c2b3a). What `wideNode` has answered is read first
 * (PLAN 7.1i: `pocketOf` asks it of each cell). The reach of a class (`planNation`) and the ferry's
 * (`reachesOnLand`) read it.
 */
export function groundReader(world: World, pass: Passage): (c: number) => number {
  const nav = navOf(world);
  const nodeOf = nav.graph.nodeOf;
  const wideCell = (c: number): number => {
    const node = nodeOf[c]!;
    const m = pass.wide?.[node] ?? 0;
    return m > 0 ? m : m < 0 ? 0 : wideNode(nav.graph, pass, node);
  };
  return (c: number): number => {
    const wide = wideCell(c);
    return wide !== 0 ? -wide : pocketOf(nav.grid, pass, c, wideCell);
  };
}

/**
 * Whether a formation of the nation of passage `pass` standing at cell `from` reaches cell `to`
 * (PLAN 7.79c): `planNation`'s reach of a class to a sector's cell (PLAN 3.5b, 3.10c2b2,
 * 3.10c2b3a) for two cells of one landmass, asked per pair: one group of provinces with open
 * ground (none asked from closed ground, which it walks out of), then one pocket or none, and two
 * wide grounds joined by the cells. `groundAt`: `groundReader` of `pass`, kept across the calls.
 */
export function reachesOnLand(world: World, pass: Passage, groundAt: (c: number) => number, from: number, to: number): boolean {
  return reachOnLand(world, pass, groundAt, from, to, true) === 1;
}

/**
 * `reachesOnLand` as 1 (reaches) or 0 (does not); with `walk` false, -1 where only `wideJoined`
 * would tell, which may walk the cells of the passage (PLAN 7.83b: a caller with several cells to
 * reach asks them all without it first, and walks only when none answers).
 */
export function reachOnLand(world: World, pass: Passage, groundAt: (c: number) => number, from: number, to: number, walk: boolean): 1 | 0 | -1 {
  const nav = navOf(world);
  const land = nav.grid.component;
  if (land[from] === 0 || land[from] !== land[to]) return 0;
  const nodeOf = nav.graph.nodeOf;
  const node = nodeOf[from]!;
  const g = node !== 0 && pass.ok[pass.holder[from]!] === 1 ? pass.group![node]! : -1;
  if (g < 0) return 1;
  if (nodeOf[to] !== 0 && pass.group![nodeOf[to]!] !== g) return 0;
  const ground = nodeOf[to] === 0 ? 0 : groundAt(to);
  const mine = groundAt(from);
  if (ground === mine) return 1;
  if (ground > 0 || mine > 0) return 0;
  if (ground === 0 || mine === 0) return 1;
  if (!walk) return -1;
  return wideJoined(nav.grid, nav.graph, pass, -mine, -ground) ? 1 : 0;
}

/** A holder's frontier cells, in the frontier's order. */
interface Front {
  cells: number[];
}

function planNation(world: World, n: number, fighting: Set<number>, frontier: Map<number, Front>, w: number, nb: number[], f: World['formations']['cols'], passages: Map<string, Passage>, armour: readonly number[], stand: Standings): void {
  const wars = world.wars;
  // n's enemies as a mask: the tests below run per frontier cell and per formation.
  const enemyOf = new Uint8Array(world.nations.highWater);
  const enemies: number[] = [];
  for (const m of fighting) {
    if (!wars.atWar(n, m)) continue;
    enemyOf[m] = 1;
    enemies.push(m);
  }
  // The planners of a tick with these enemies share a partner's front (`frontPart`).
  const enemyKey = enemies.sort((a, b) => a - b).join(',');
  const enemy = (m: number): boolean => enemyOf[m] === 1;
  const bw = Math.ceil(w / sector);
  // The two edges of a map that does not loop are a map apart (PLAN 3.12Rsd, ADR-237): no
  // distance below is the short way over the seam, and no sector bucket has one beyond an edge.
  const loop = world.settings.loopingMap;
  /** The column of sector buckets `dx` from column `sx`, or -1 where the map ends before it. */
  const bucketX = (sx: number, dx: number): number => (loop ? (sx + dx + bw) % bw : sx + dx < 0 || sx + dx >= bw ? -1 : sx + dx);
  const buckets = bw * Math.ceil(world.cells.h / sector);
  if (SLOTS.stamp.length !== buckets) {
    SLOTS.stamp = new Uint32Array(buckets);
    SLOTS.at = new Int32Array(buckets);
    SLOTS.summed = new Uint32Array(buckets);
    SLOTS.enemy = new Float64Array(buckets);
    SLOTS.gen = 0;
  }
  if (++SLOTS.gen === 0xffffffff) {
    SLOTS.stamp.fill(0);
    SLOTS.summed.fill(0);
    SLOTS.gen = 1;
  }
  const { stamp: slotStamp, at: slotAt, gen } = SLOTS;
  // The planners of a tick on one side with the same enemies have the same sectors (PLAN 7.1i):
  // they are made once, and each plan has its own copy of what it writes in them.
  const side: number[] = [];
  for (const holder of frontier.keys()) if (holder === n || wars.sameSide(holder, n)) side.push(holder);
  const sideKey = `${enemyKey}|${side.join(',')}`;
  let shape = stand.sectors.get(sideKey);
  if (!shape) stand.sectors.set(sideKey, (shape = sectorShape(world, side, frontier, enemyKey, enemyOf, enemies, n, fighting, stand, w, bw)));
  if (shape.list.length === 0) return;
  const list: Sector[] = shape.list.map((k) => ({ key: k.key, cells: k.cells, count: k.count, cx: k.cx, cy: k.cy, threat: 0, formations: [], strength: 0, hold: k.hold, own: k.holders.includes(n) }));
  for (let i = 0; i < list.length; i++) {
    slotStamp[list[i]!.key] = gen;
    slotAt[list[i]!.key] = i;
  }
  if (timing) timing.sectors = list.length;
  mark();

  /** The strength of n's enemies in a sector bucket (read where no order is given in between). */
  const enemyAt = (k: number): number => {
    if (k < 0 || k >= buckets) return 0;
    if (SLOTS.summed[k] === gen) return SLOTS.enemy[k]!;
    let sum = 0;
    const ids = stand.byBucket.get(k);
    const aboard = world.embarked.size !== stand.embarked;
    for (const id of ids ?? []) if (enemyOf[f.nation[id]!] === 1 && (!aboard || !world.offLand(id))) sum += f.strength[id]!;
    SLOTS.summed[k] = gen;
    SLOTS.enemy[k] = sum;
    return sum;
  };
  /** By sector bucket, how many formations of n stand in it, free or not. */
  const stands = new Map<number, number>();
  /** The same, of those that can take a cell (`takeMen`). */
  const holds = new Map<number, number>();
  const mine: number[] = [];
  /** n's formations, free or not. */
  const all: number[] = [];
  // A formation on the march to a port where n's transports stand is the invasion AI's (PLAN 7.56a,
  // ADR-596): sent to go aboard (`sendToPort`), it is no free formation of the fronts.
  const ownIds = stand.byNation.get(n) ?? [];
  const ports = transportPorts(world, ownIds);
  for (const id of ownIds) {
    if (world.offLand(id)) continue; // neither one of its own to send nor an enemy's strength in a sector (PLAN 4.2b)
    all.push(id);
    const k = Math.floor(f.y[id]! / sector) * bw + Math.floor(f.x[id]! / sector);
    stands.set(k, (stands.get(k) ?? 0) + 1);
    if (f.strength[id]! > take) holds.set(k, (holds.get(k) ?? 0) + 1);
    if (f.engaged[id] !== 1 && f.retreat[id] === 0 && f.home[id] === 0 && (ports.length === 0 || !marchingToPort(world, id, ports))) mine.push(id);
  }
  if (mine.length === 0) return;
  const dist2 = (id: number, s: Sector): number => {
    let dx = Math.abs(f.x[id]! - s.cx);
    if (loop && dx > w / 2) dx = w - dx;
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
  // The first sector of a row of buckets or after it (`list` is by key, so by row).
  const rowStart = (row: number): number => {
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid]!.key < row * bw) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  for (const id of mine) {
    // Only a sector of the rows within the range can be within it (PLAN 7.1g): one beyond is
    // farther in y alone, so the nearest is the same where it is within the range, and beyond
    // it where it is not.
    const y = f.y[id]!;
    const last = rowStart(Math.floor((y + range) / sector) + 1);
    let d = Infinity;
    for (let i = rowStart(Math.floor((y - range) / sector)); i < last; i++) d = Math.min(d, dist2(id, list[i]!));
    if (d > range2) {
      if (idle(id)) out.push(id);
      continue;
    }
    near.push(id);
    nearD.push(d);
  }
  if (timing) {
    timing.mine = mine.length;
    timing.near = near.length;
    timing.far = out.length;
  }
  mark();
  if (near.length === 0 && out.length === 0) return;
  // Reach (PLAN 3.5b): formations that stand on one landmass and in one group of provinces
  // with open ground (or on closed ground, which they walk out of) reach the same places.
  // Each such class is asked once per sector, for the sector's own front cell, what
  // `orderMove` asks before it searches: the cell the order would go to from that landmass
  // (`snapTarget`), then `mayReach`, read here from the two groups: the same test written a
  // second time (the landmass is asked once per class and sector), so a change of `mayReach`
  // is a change of the line that fills `reached` below. Then the cells, where they are few
  // (PLAN 3.10c2b, ADR-192): a class in a pocket of open ground reaches the cells of the pocket
  // and no other, and a class that is not in it does not reach them (PLAN 3.10c2b2); and a class
  // in one wide ground does not reach the cells of another that no open cells join it to (PLAN
  // 3.10c2b3a, ADR-193). `mayReach` asks neither, and the order's search would find both.
  const pass = passageOf(world, n, passages);
  mark();
  const nav = navOf(world);
  const land = nav.grid.component;
  const nodeOf = nav.graph.nodeOf;
  const group = pass.group!;
  const groundAt = groundReader(world, pass);
  /** `groundAt`, timed when a plan is (`OP_PROBE`). */
  const groundOf = (c: number): number => {
    if (!timing) return groundAt(c);
    const t = OP_PROBE.now!();
    const r = groundAt(c);
    timing.grounds++;
    timing.groundMs += OP_PROBE.now!() - t;
    return r;
  };
  const classIndex = new Map<number, number>();
  const classCell: number[] = [];
  const classGroup: number[] = [];
  /** The ground the class stands in (`groundOf`; 0 on closed ground too). */
  const classGround: number[] = [];
  const classOf = new Int32Array(world.formations.highWater);
  for (const ids of [near, out]) {
    for (const id of ids) {
      const here = Math.floor(f.y[id]!) * w + Math.floor(f.x[id]!);
      const node = nodeOf[here]!;
      const g = node !== 0 && pass.ok[pass.holder[here]!] === 1 ? group[node]! : -1;
      const ground = g < 0 ? 0 : groundOf(here);
      // A pocket is of one landmass and one group, and so is a wide ground (its number is a node's).
      const key = ground > 0 ? -ground : (land[here]! * (nav.graph.nodeCount + 1) + g + 1) * (nav.graph.nodeCount + 1) - ground;
      let ci = classIndex.get(key);
      if (ci === undefined) {
        classIndex.set(key, (ci = classCell.length));
        classCell.push(here);
        classGroup.push(g);
        classGround.push(ground);
      }
      classOf[id] = ci;
    }
  }
  const sn = list.length;
  // reached[ci]: the sectors class ci reaches, ascending.
  const reached: number[][] = classCell.map(() => []);
  // unasked[ci]: of those, the sectors in another wide ground than the class's, with that ground:
  // whether the cells join the two is asked where it is read (`reaches`; PLAN 3.10c2c1: the
  // first to ask has the cells walked, and three plans in four read none of them).
  const unasked: (Map<number, number> | undefined)[] = classCell.map(() => undefined);
  const reaches = (ci: number, i: number): boolean => {
    const ground = unasked[ci]?.get(i);
    if (ground === undefined) return true;
    if (!timing) return wideJoined(nav.grid, nav.graph, pass, -classGround[ci]!, -ground);
    const t = OP_PROBE.now!();
    const r = wideJoined(nav.grid, nav.graph, pass, -classGround[ci]!, -ground);
    timing.joins++;
    timing.joinMs += OP_PROBE.now!() - t;
    return r;
  };
  const probeReach = OP_PROBE.sectors ? classCell.map((c, ci) => ({ cell: c, ground: classGround[ci]!, provinceGroup: classGroup[ci]!, far: 0, reached: 0, snap: 0, group: 0, pocket: 0 })) : undefined;
  for (let i = 0; i < sn; i++) {
    const s = list[i]!;
    const hold = s.hold;
    // From another landmass: the cell of it within the snap of an order, once per landmass.
    let other: Map<number, number> | undefined;
    // The cell last asked for its ground, and the answer.
    let asked = -1;
    let ground = 0;
    for (let ci = 0; ci < classCell.length; ci++) {
      const from = classCell[ci]!;
      const g = classGroup[ci]!;
      let to = hold;
      if (land[from] !== land[hold] || land[hold] === 0) {
        const known = (other ??= new Map()).get(land[from]!);
        to = known ?? snapTarget(world, from, hold % w, Math.floor(hold / w));
        if (known === undefined) other.set(land[from]!, to);
      }
      if (to < 0 || (g >= 0 && nodeOf[to] !== 0 && group[nodeOf[to]!] !== g)) {
        if (probeReach) probeReach[ci]![to < 0 ? 'snap' : 'group']++;
        continue;
      }
      // The pocket of the order's cell is the class's, or neither is in one (PLAN 3.10c2b2:
      // the cells are walked from the sector's cell too, once a cell). A class on closed ground
      // walks out of it, into a pocket too: it is not asked.
      if (g < 0) {
        reached[ci]!.push(i);
        continue;
      }
      if (to !== asked) {
        asked = to;
        ground = nodeOf[to] === 0 ? 0 : groundOf(to);
      }
      const mine = classGround[ci]!;
      if (ground !== mine) {
        if (ground > 0 || mine > 0) {
          if (probeReach) probeReach[ci]!.pocket++;
          continue;
        }
        // Two wide grounds: the cells join them or the class does not reach the sector (PLAN
        // 3.10c2b3a, ADR-193). Ground that came to no wide ground may be joined to any.
        if (ground < 0 && mine < 0) (unasked[ci] ??= new Map()).set(i, ground);
      }
      reached[ci]!.push(i);
    }
  }
  if (timing) timing.classes = classCell.length;
  mark();
  // Reserve: the farthest RESERVE share of free formations within range of a sector they reach
  // stays put.
  const nearest = new Map<number, number>();
  for (let k = 0; k < near.length; k++) {
    const id = near[k]!;
    const ci = classOf[id]!;
    let d = nearD[k]!;
    if (reached[ci]!.length < sn || unasked[ci]) {
      // A sector beyond the range is not asked for: it does not put the formation within it.
      d = Infinity;
      for (const i of reached[ci]!) {
        const di = dist2(id, list[i]!);
        if (di < d && (di > range2 || reaches(ci, i))) d = di;
      }
    }
    if (d <= range2) nearest.set(id, d);
  }
  const ranked = [...nearest.keys()].sort((a, b) => nearest.get(a)! - nearest.get(b)! || a - b);
  const active = ranked.slice(0, ranked.length - Math.floor(ranked.length * RESERVE));
  // Far from every sector they reach, standing still, and theirs the day (ascending).
  // A planner with no front of its own sends them to its partners' (PLAN 7.26c1a, ADR-509).
  const far = [...near.filter((id) => !nearest.has(id) && idle(id)), ...out].sort((a, b) => a - b);
  if (active.length === 0 && far.length === 0) return;
  // Threat: enemy formations by sector bucket, summed over each sector's 3 × 3 neighbourhood. The
  // same for the plans that share the sectors (the enemies are the same) while nobody embarked
  // between (an order puts a formation aboard; none comes ashore in a tick's plans).
  if (shape.threatAt !== world.embarked.size) {
    for (const s of list) {
      const sy = Math.floor(s.key / bw);
      const sx = s.key - sy * bw;
      for (let dx = -1; dx <= 1; dx++) {
        const x = bucketX(sx, dx);
        if (x < 0) continue;
        for (let dy = -1; dy <= 1; dy++) s.threat += enemyAt((sy + dy) * bw + x);
      }
    }
    shape.threat = list.map((s) => s.threat);
    shape.threatAt = world.embarked.size;
  } else for (let i = 0; i < list.length; i++) list[i]!.threat = shape.threat[i]!;
  mark();
  const sectorOfCell = (c: number): number => Math.floor(Math.floor(c / w) / sector) * bw + Math.floor((c % w) / sector);
  /** The number in `list` of the sector of a bucket, if it has one. */
  const indexOf = (key: number): number | undefined => (slotStamp[key] === gen ? slotAt[key] : undefined);
  /** By sector, how many free formations of n march into it. */
  const marchers = new Int32Array(sn);
  /** The same, of those that can take a cell (`takeMen`). */
  const takers = new Int32Array(sn);
  for (const id of mine) {
    if (f.moving[id] !== 1) continue;
    const i = indexOf(sectorOfCell(f.targetCell[id]!));
    if (i === undefined) continue;
    marchers[i]!++;
    if (f.strength[id]! > take) takers[i]!++;
  }
  /** How many formations of n stand in the sector or next to it (of `by`: all, or those that can take a cell). */
  const stoodAt = (s: Sector, by = stands): number => {
    const sy = Math.floor(s.key / bw);
    const sx = s.key - sy * bw;
    let c = 0;
    for (let dx = -1; dx <= 1; dx++) {
      const x = bucketX(sx, dx);
      if (x < 0) continue;
      for (let dy = -1; dy <= 1; dy++) c += by.get((sy + dy) * bw + x) ?? 0;
    }
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
    if (loop && tx > w / 2) tx = w - tx;
    const ty = f.y[id]! - (Math.floor(to / w) + 0.5);
    if (tx * tx + ty * ty > range2) return true;
    const i = indexOf(sectorOfCell(to));
    if (i === undefined || marchers[i]! > 1) return false;
    const s = list[i]!;
    const by = Math.floor(f.y[id]! / sector);
    const bx = Math.floor(f.x[id]! / sector);
    const sy = Math.floor(s.key / bw);
    let dx = Math.abs(bx - (s.key - sy * bw));
    if (loop && dx > bw / 2) dx = bw - dx;
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
  const probeClasses: SectorsSeen['classes'] = [];
  const probeEmpty: SectorsSeen['empty'] = OP_PROBE.sectors ? { takers: 0, stood: 0, sideStood: 0, empties: -1, far: far.length, reachedEmpty: 0, otherLand: 0, unreached: 0 } : undefined;
  // Each class is allotted to the sectors it reaches, and to no other.
  for (let ci = 0; ci < byClass.length; ci++) {
    const ids = byClass[ci]!;
    if (ids.length === 0) continue;
    // The sectors of the class: those it reaches that have one of its formations within the
    // range (PLAN 3.10c1, ADR-187), with how many (`pool`).
    const front: number[] = [];
    const pool: number[] = [];
    // By y (PLAN 7.1g): one that is farther in y alone than the range is beyond it, so a sector's
    // count reads those of the rows within the range of its centre.
    const byY = ids.slice().sort((a, b) => f.y[a]! - f.y[b]!);
    const ys = new Float64Array(byY.length);
    for (let k = 0; k < byY.length; k++) ys[k] = f.y[byY[k]!]!;
    for (const i of reached[ci]!) {
      const s = list[i]!;
      let lo = 0;
      let hi = ys.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (ys[mid]! < s.cy - range) lo = mid + 1;
        else hi = mid;
      }
      let p = 0;
      for (let k = lo; k < ys.length && ys[k]! <= s.cy + range; k++) if (dist2(byY[k]!, s) <= range2) p++;
      if (p === 0 || !reaches(ci, i)) continue;
      front.push(i);
      pool.push(p);
    }
    has.fill(0);
    place.fill(-1);
    for (let k = 0; k < front.length; k++) place[front[k]!] = k;
    // Threatened first (PLAN 7.79b, ADR-634): the threatened sectors share, by their threat, as
    // many as there are of the class within the range of one of them, and the rest of the front
    // shares what is left by 1 + threat/THREAT_UNIT. Each is allotted no more than its pool.
    const counts = front.map(() => 0);
    const hot: number[] = [];
    const cold: number[] = [];
    for (let k = 0; k < front.length; k++) (list[front[k]!]!.threat > 0 ? hot : cold).push(k);
    const nearHot = new Set(hot.length > 0 ? ids.filter((id) => hot.some((k) => dist2(id, list[front[k]!]!) <= range2)) : []);
    const near = nearHot.size;
    const given = allot(hot, (k) => list[front[k]!]!.threat, pool, near, counts);
    allot(cold, (k) => 1 + list[front[k]!]!.threat / THREAT_UNIT, pool, ids.length - given, counts);
    const seen = OP_PROBE.sectors
      ? {
          ids: ids.length,
          front: front.length,
          threatened: front.filter((i) => list[i]!.threat > 0).length,
          before: front.reduce((t, i, k) => t + (list[i]!.threat > 0 ? counts[k]! : 0), 0),
          after: 0,
          filled: 0,
          canTake: near,
          keptCold: 0,
        }
      : undefined;
    // Every sector gets one while formations last: take from the largest allotments of the
    // sectors with no threat (PLAN 7.79b: not from the threatened).
    for (let k = 0; k < counts.length; k++) {
      if (counts[k]! > 0) continue;
      let j = -1;
      for (let m = 0; m < counts.length; m++) if (counts[m]! > 1 && list[front[m]!]!.threat <= 0 && (j < 0 || counts[m]! > counts[j]!)) j = m;
      if (j < 0) break;
      counts[j]!--;
      counts[k] = 1;
    }
    if (seen) {
      seen.after = front.reduce((t, i, k) => t + (list[i]!.threat > 0 ? counts[k]! : 0), 0);
      probeClasses.push(seen);
    }
    // Sticky first: a formation already marching into a sector keeps it, also beyond the sector's
    // allotment of today (ADR-53). It counts towards the allotment, so fewer others are sent.
    // But one marching into a sector of the class's with no threat that is within the range of a
    // threatened sector yields to the threatened sectors' allotments (PLAN 7.79b, ADR-634), and
    // keeps its march only if none of them takes it; not one whose march began beyond the range
    // of the sector (a march from afar or to spare: the allotment sends none from that far).
    const fromAfar = (id: number, s: Sector): boolean => {
      const o = f.originCell[id]!;
      let dx = Math.abs((o % w) + 0.5 - s.cx);
      if (loop && dx > w / 2) dx = w - dx;
      const dy = Math.floor(o / w) + 0.5 - s.cy;
      return dx * dx + dy * dy > (range - 1) * (range - 1);
    };
    const free = new Set(ids);
    const yielding = new Map<number, number>();
    const keep = (id: number, i: number): void => {
      list[i]!.formations.push(id);
      list[i]!.strength += f.strength[id]!;
      has[i]!++;
    };
    for (const id of ids) {
      if (f.moving[id] !== 1) continue;
      const i = indexOf(sectorOfCell(f.targetCell[id]!));
      if (i === undefined) continue;
      free.delete(id);
      if (list[i]!.threat <= 0 && place[i]! >= 0 && nearHot.has(id) && !fromAfar(id, list[i]!)) yielding.set(id, i);
      else keep(id, i);
    }
    // Then nearest-first, most threatened sectors first, each sector from the formations
    // within the range of it; the threatened ones from those that yield too.
    const fill = (i: number, from: Iterable<number>, out: (id: number) => void): void => {
      const s = list[i]!;
      for (let m = has[i]!; m < counts[place[i]!]!; m++) {
        let best = -1;
        let bd = Infinity;
        for (const id of from) {
          const d = dist2(id, s);
          if (d > range2) continue;
          if (d < bd || (d === bd && id < best)) {
            bd = d;
            best = id;
          }
        }
        if (best < 0) break;
        out(best);
        s.formations.push(best);
        s.strength += f.strength[best]!;
      }
    };
    let kept = yielding.size === 0;
    const hotFree = kept ? free : new Set([...free, ...yielding.keys()]);
    for (const i of byThreat) {
      if (place[i]! < 0) continue;
      if (!kept && list[i]!.threat <= 0) {
        // The threatened sectors are filled: those that yielded and were not taken keep their march.
        for (const [id, j] of yielding) keep(id, j);
        kept = true;
      }
      if (kept) fill(i, free, (id) => free.delete(id));
      else
        fill(i, hotFree, (id) => {
          hotFree.delete(id);
          free.delete(id);
          yielding.delete(id);
        });
    }
    if (!kept) for (const [id, j] of yielding) keep(id, j);
    if (seen) for (const [, j] of yielding) if (list[j]!.threat <= 0) seen.keptCold++;
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
    if (seen) {
      const mine = new Set(ids);
      for (const s of list) if (s.threat > 0) for (const id of s.formations) if (mine.has(id)) seen.filled++;
    }
  }
  mark();
  // Marches from afar (PLAN 3.10c1a, ADR-190): a front sector of n's own that has nobody takes
  // the nearest formation on its landmass that is far from every sector it reaches and stands still. Nobody: no
  // formation of n stands in the sector or next to it, the allotment above gave it none, and
  // none is on the march into it. For a planner with no front of its own, its partners' sectors
  // with nobody of the side (PLAN 7.26c1a, ADR-509); for one with a front of its own, those too for
  // a formation that reaches no sector of its own with nobody (PLAN 7.26c1b, ADR-513). One formation a sector and one order a sector and plan, also
  // when the order is refused. The march is not planned again while it lasts: a formation on
  // the march is not in `far`, and within the range of the sector it is kept as any march is.
  if (far.length > 0 || spare.length > 0) {
    const empty = new Uint8Array(sn);
    let empties = 0;
    /** Of a nation: 1 on n's side, 2 not (0: not asked yet). */
    const ofSide = new Uint8Array(world.nations.highWater);
    const onSide = (m: number): boolean => {
      if (ofSide[m] === 0) ofSide[m] = m === n || wars.sameSide(m, n) ? 1 : 2;
      return ofSide[m] === 1;
    };
    /** Whether a formation of n's side that can take a cell (`takeMen`) stands on land in the sector or next to it. */
    const sideStood = (s: Sector): boolean => {
      const sy = Math.floor(s.key / bw);
      const sx = s.key - sy * bw;
      for (let dx = -1; dx <= 1; dx++) {
        const x = bucketX(sx, dx);
        if (x < 0) continue;
        for (let dy = -1; dy <= 1; dy++) for (const id of stand.byBucket.get((sy + dy) * bw + x) ?? []) if (f.strength[id]! > take && onSide(f.nation[id]!) && !world.offLand(id)) return true;
      }
      return false;
    };
    // 1: a sector that has nobody, of n's own front or (for a planner with no front of its own)
    // of its partners'; 2: a partner's sector with nobody of the side, for a planner with a front
    // of its own, taken only by a formation that reaches no sector of the first kind (PLAN 7.26c1b).
    for (let i = 0; i < sn; i++) {
      const s = list[i]!;
      if (s.formations.some((id) => f.strength[id]! > take)) continue;
      if (takers[i]! > 0 || stoodAt(s, holds) > 0) {
        if (probeEmpty) probeEmpty[takers[i]! > 0 ? 'takers' : 'stood']++;
        continue;
      }
      if (!s.own && sideStood(s)) {
        if (probeEmpty) probeEmpty.sideStood++;
        continue;
      }
      empty[i] = !s.own && ownFront ? 2 : 1;
      empties++;
    }
    if (probeEmpty) {
      // PLAN 7.79d, read only: the far formations whose class reaches a threatened sector on its landmass, and the cells to the nearest.
      probeEmpty.farHot = 0;
      probeEmpty.farHotCells = 0;
      for (const id of far) {
        const ci = classOf[id]!;
        let bd = Infinity;
        for (const i of reached[ci]!) if (list[i]!.threat > 0 && land[list[i]!.hold] === land[classCell[ci]!]) bd = Math.min(bd, dist2(id, list[i]!));
        if (bd < Infinity) {
          probeEmpty.farHot++;
          probeEmpty.farHotCells += Math.sqrt(bd);
          if (Math.sqrt(bd) <= range + 50) probeEmpty.farHotNear = (probeEmpty.farHotNear ?? 0) + 1;
        }
      }
      probeEmpty.empties = empties;
      probeEmpty.far = far.length;
      if (probeReach) {
        for (const id of far) probeReach[classOf[id]!]!.far++;
        for (let ci = 0; ci < probeReach.length; ci++) probeReach[ci]!.reached = reached[ci]!.filter((i) => empty[i] !== 0).length;
        probeEmpty.classes = probeReach.filter((r) => r.far > 0);
      }
    }
    /** Of a sector: 1 = no formation of n is within the range of it, 2 = one is (0: not asked yet). */
    const alone = new Uint8Array(sn);
    const isAlone = (i: number): boolean => {
      if (alone[i] === 0) alone[i] = all.some((id) => dist2(id, list[i]!) <= range2) ? 2 : 1;
      return alone[i] === 1;
    };
    /**
     * The nearest empty sector the formation's class reaches, and its distance (squared): of the
     * first kind, else (one from afar) of the second. For one to spare (`lone`): of the first kind
     * that nobody is within the range of, within the spare's range.
     */
    const emptyFor = (id: number, lone: boolean): [number, number] => {
      const ci = classOf[id]!;
      for (let kind = 1; kind <= (lone ? 1 : 2); kind++) {
        let best = -1;
        let bd = lone ? spare2 : Infinity;
        for (const i of reached[ci]!) {
          // Not to the shore across the water from it (where an order to another landmass ends).
          if (empty[i] !== kind) continue;
          if (land[list[i]!.hold] !== land[classCell[ci]!]) {
            if (probeEmpty && !lone) probeEmpty.otherLand++;
            continue;
          }
          const d = dist2(id, list[i]!);
          if (d < bd && (!lone || isAlone(i)) && reaches(ci, i)) {
            bd = d;
            best = i;
          } else if (probeEmpty && !lone && d < bd) probeEmpty.unreached++;
        }
        if (probeEmpty && !lone) probeEmpty.reachedEmpty += reached[ci]!.filter((i) => empty[i] === kind).length;
        if (best >= 0) return [best, bd];
      }
      return [-1, Infinity];
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
        const i = empty[first] !== 0 ? first : emptyFor(id, lone === 1)[0];
        if (i < 0) continue;
        empty[i] = 0;
        empties--;
        const to = list[i]!.hold;
        askMove(world, id, to, pass);
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
  mark();
  if (OP_PROBE.sectors) OP_PROBE.sectors({ nation: n, tick: world.tick, classes: probeClasses, empty: probeEmpty, sectors: list.map((s) => ({ threat: s.threat, n: s.formations.length, strength: s.strength, attack: s.formations.length > 0 && s.strength >= OFFENSIVE_RATIO * s.threat, cx: s.cx, cy: s.cy, inRange: s.threat > 0 && all.some((id) => dist2(id, s) <= range2) })) });
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
      if (f.moving[id] === 1 && cellDist(f.targetCell[id]!, to, w, loop) <= sector) continue;
      const here = Math.floor(f.y[id]!) * w + Math.floor(f.x[id]!);
      if (here === to || askMove(world, id, to, pass) !== 'long') continue;
      // The way is long (PLAN 1.42h): the nearest other sector of its class within the range that
      // it reaches by a way that is not, by the sector's own front cell; else it holds.
      const ci = classOf[id]!;
      const others: number[] = [];
      for (const i of reached[ci]!) if (list[i] !== s && dist2(id, list[i]!) <= range2 && reaches(ci, i)) others.push(i);
      others.sort((a, b) => dist2(id, list[a]!) - dist2(id, list[b]!) || a - b);
      for (let k = 0; k < others.length && k < DIVERTS; k++) {
        const hold = list[others[k]!]!.hold;
        if (hold === here || askMove(world, id, hold, pass) !== 'long') break;
      }
    }
  }
}

/**
 * The plan's order of formation `id` to the cell `to` (PLAN 1.42g, the user's decision of
 * 2026-10-15), held to a way no longer than LONG_WAY times the straight line (`orderMove`'s
 * `direct`, PLAN 1.42h): 'ok', 'refused' for want of a way, or 'long'. One that was refused, either
 * way, is not given again while nothing the refused search read has changed. That is: the
 * formation stands still on the cell it stood on, of the same template, the order is to the same
 * cell, of its landmass or over the sea from where no port is (`atAnyPort`: from a port the sea is asked, whose transports come and go), the holders
 * open to it are the same (`Passage.ok`), and no cell has gone from an open holder to a closed one
 * or back since (`World.flipLog`, as `passageOf` keeps what it knows of the cells). Asked again,
 * such an order is refused again, as it was: the rule changes no state, and the pin did not move.
 * A refusal for want of a way by the cells of a corridor of provinces (PLAN 7.30b) holds longer:
 * while the provinces' `open` and `shut` are the same, the cell stood on is open, and no cell of
 * the corridor's provinces has gone from a closed holder to an open one (`corridorHolds`); a cell
 * lost to a closed holder, or a flip elsewhere on the map, does not undo it.
 */
export function askMove(world: World, id: number, to: number, pass: Passage): 'ok' | 'refused' | 'long' {
  if (!timing) return asked(world, id, to, pass);
  const was = world.refusedOrders.get(id);
  const before = was ? { ...was, long: was.long.slice() } : undefined;
  const f = world.formations.cols;
  const from = Math.floor(f.y[id]!) * world.cells.w + Math.floor(f.x[id]!);
  const searches = CORRIDOR_REFUSAL.searches;
  const t = OP_PROBE.now!();
  const r = asked(world, id, to, pass);
  const ms = OP_PROBE.now!() - t;
  timing.asks++;
  timing.askMs += ms;
  OP_PROBE.ask?.({ id, from, to, answer: r, ms, was: before, afar: timing.parts.length === 6, pass, searched: CORRIDOR_REFUSAL.searches !== searches });
  return r;
}

function asked(world: World, id: number, to: number, pass: Passage): 'ok' | 'refused' | 'long' {
  const f = world.formations.cols;
  const w = world.cells.w;
  const nav = navOf(world);
  const from = Math.floor(f.y[id]!) * w + Math.floor(f.x[id]!);
  const comp = nav.grid.component;
  const kept = f.moving[id] !== 1 && !world.embarked.has(id) && comp[from] !== 0 && (comp[from] === comp[to] || !atAnyPort(world, from));
  const was = world.refusedOrders.get(id);
  const now = world.flipLogBase + world.flipLog.length;
  // The formation and the holders open to it are those the refusals of `was` were read on, and
  // (`same`) no cell has gone from an open holder to a closed one or back since.
  const base = kept && was !== undefined && was.from === from && was.template === f.template[id] && was.grid === nav.grid && was.flips >= world.flipLogBase && sameOk(was.ok, pass.ok);
  const same = base && lastMixed(world, pass) <= was!.flips;
  // A refusal by the cells of a corridor holds while what it read does (PLAN 7.30b).
  if ((same && (was!.to === to || was!.long.includes(to))) || (base && was!.to === to && corridorHolds(world, was!, from, pass))) {
    world.seaBound.delete(id);
    return was!.to === to ? 'refused' : 'long';
  }
  const searches = CORRIDOR_REFUSAL.searches;
  if (orderMove(world, id, (to % w) + 0.5, Math.floor(to / w) + 0.5, pass, false, true)) {
    world.refusedOrders.delete(id);
    return 'ok';
  }
  const long = wasLong();
  // The order's one search, refused by the cells of its corridor: what it read.
  const read = !long && CORRIDOR_REFUSAL.searches === searches + 1 && CORRIDOR_REFUSAL.at === searches + 1 ? CORRIDOR_REFUSAL.read : undefined;
  if (!kept) world.refusedOrders.delete(id);
  else if (!same) world.refusedOrders.set(id, { from, to: long ? -1 : to, template: f.template[id]!, grid: nav.grid, ok: pass.ok.slice(), flips: now, long: long ? [to] : [], corridor: read, since: now });
  else if (long) was!.long.push(to);
  else {
    was!.to = to;
    was!.corridor = read;
    was!.since = now;
  }
  return long ? 'long' : 'refused';
}

/**
 * Whether a refusal by the cells of a corridor (`CorridorRefusal`, PLAN 7.30b) still holds on the
 * passage: the nodes' `open` and `shut` are the same (so are the route and its corridor), the
 * cell stood on is open (a search from closed ground is another search), and no cell of the
 * corridor's nodes has gone from a closed holder to an open one since it (`World.flipCells`;
 * `since`: the flips up to which that is known).
 * The search enters open cells only and is refused when none of the corridor's leads to the goal:
 * a cell that has gone from open to closed takes a way from it and gives none, and a flip outside
 * the corridor is not read by it. Asked again, it would be refused again.
 */
function corridorHolds(world: World, was: { since: number; corridor?: CorridorRefusal | undefined }, from: number, pass: Passage): boolean {
  const read = was.corridor;
  if (!read || !pass.open || !pass.shut || pass.ok[pass.holder[from]!] !== 1) return false;
  if (read.open !== pass.open && !sameOk(read.open, pass.open)) return false;
  if (read.shut !== pass.shut && !sameOk(read.shut, pass.shut)) return false;
  const nodeOf = navOf(world).graph.nodeOf;
  const { flipLog: log, flipCells: cells } = world;
  const { ok } = pass;
  if (was.since < world.flipLogBase) return false;
  for (let k = was.since - world.flipLogBase; k < log.length; k++) {
    const fromHolder = Math.floor(log[k]! / 65536);
    if (ok[fromHolder] !== 1 && ok[log[k]! - fromHolder * 65536] === 1 && read.on[nodeOf[cells[k]!]!] === 1) return false;
  }
  // None up to now: the next ask reads the flips after.
  was.since = world.flipLogBase + log.length;
  return true;
}

function sameOk(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * The count of `World.flipLog`'s changes up to the last that took a cell from a holder open by
 * `pass` to a closed one or back (`flipLogBase` for none in the log). Once a passage: no cell
 * changes hands while a plan's orders are given.
 */
function lastMixed(world: World, pass: Passage): number {
  const now = world.flipLogBase + world.flipLog.length;
  const known = MIXED.get(pass);
  if (known !== undefined && known[0] === now) return known[1];
  const { ok } = pass;
  const log = world.flipLog;
  let k = log.length - 1;
  for (; k >= 0; k--) {
    const fromHolder = Math.floor(log[k]! / 65536);
    if (ok[fromHolder] !== ok[log[k]! - fromHolder * 65536]) break;
  }
  const last = world.flipLogBase + k + 1;
  MIXED.set(pass, [now, last]);
  return last;
}
const MIXED = new WeakMap<Passage, [number, number]>();

/** Cells from one cell to another, a step to any of eight: over the seam where the map loops. */
function cellDist(a: number, b: number, w: number, loop: boolean): number {
  let dx = Math.abs((a % w) - (b % w));
  if (loop && dx > w / 2) dx = w - dx;
  return Math.max(dx, Math.abs(Math.floor(a / w) - Math.floor(b / w)));
}

/** The own front cell nearest the sector centre (lowest id on ties). */
function holdCell(s: Pick<Sector, 'cells' | 'cx' | 'cy'>, w: number): number {
  let best = -1;
  let bd = Infinity;
  for (const cells of s.cells) {
    for (const c of cells) {
      const ex = (c % w) + 0.5 - s.cx;
      const ey = Math.floor(c / w) + 0.5 - s.cy;
      const d = ex * ex + ey * ey;
      if (d < bd || (d === bd && c < best)) {
        bd = d;
        best = c;
      }
    }
  }
  return best;
}

/** The enemy cell touching the sector's front nearest its centre (lowest id on ties); over a crossing too (`frontNeighbours`). */
function attackCell(world: World, s: Sector, enemy: (m: number) => boolean, nb: number[]): number {
  const { w, controller } = world.cells;
  let best = -1;
  let bd = Infinity;
  for (const cells of s.cells) {
    for (const c of cells) {
      for (const k of frontNeighbours(world, c, nb)) {
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
  }
  return best;
}
