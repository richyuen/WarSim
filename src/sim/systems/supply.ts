/**
 * Supply v1 (PLAN 1.12, SPEC §2.5 step 4).
 *
 * Network (every SUPPLY_REFRESH_HOURS): a supply bloc is a nation plus its puppets (an overlord's
 * bloc id is its own id; a puppet uses its overlord's). Sources are cities the bloc both owns and
 * controls. A multi-source flood (4-connected; over the east and west edges only on a map that
 * loops, `settings.loopingMap`, PLAN 3.12Rp) spreads over cells the bloc controls and over
 * unclaimed crossing lanes; `cells.supply` stores the bloc id that reached each cell (blocs in
 * ascending id order; a lane reached first by one bloc is not shared in v1). The layer is state,
 * so a load between refreshes behaves exactly like the original run. A refresh is skipped when
 * nothing it reads has changed (`World.supplyDirty`), which writes the same layer for free.
 * The network is a function of the cities, the control of the cells and the blocs, and of
 * nothing else: a refresh of some blocs gives what a refresh of all gives (PLAN 2.11j).
 * The flood fills row spans (a scanline fill: the network is a connected region, so the order
 * it is filled in cannot change it), and each bloc's spans are remembered
 * (`World.supplySpans`, derived), so a partial refresh clears a bloc's network without scanning
 * the grid (PLAN 1.42a). A partial refresh mends the network at the cells that changed hands and
 * floods a bloc whole only where that is not sure (PLAN 3.10d1b, ADR-196).
 *
 * Formations (hourly): a formation on a cell of its own bloc's network, or of the network of a
 * bloc fighting on its side of a war (PLAN 1.42b: allies feed each other's armies while they
 * fight together), or on a cell that is not its side's with such a network within SUPPLY_REACH
 * cells (PLAN 3.4Rf; over the east and west edges only on a map that loops, PLAN 3.12Rsb),
 * gains SUPPLY_RATE per hour towards 1 (× 1 + AIR_SUPPLY × (2s − 1), s its side's air superiority
 * there, PLAN 5.8t1); otherwise it loses SUPPLY_RATE towards 0, and on the march MARCH_BURN × its
 * template's fuel besides (PLAN 3.2b). At 0 it attrits: (BASE_ATTRITION_PER_DAY +
 * terrain supplyAttrition) of its strength per day, applied hourly; and one that moves on
 * engines loses ORG_RATE of its org per hour there (PLAN 3.2c). Every formation that is fed and
 * not in contact gets ORG_RATE of org back per hour (PLAN 3.5a: none in contact).
 * With no org left there its vehicles and towed guns break down: BREAKDOWN_PER_DAY of them a
 * day besides (PLAN 3.2d).
 */
import terrainJson from '../../../data/terrain.json' with { type: 'json' };
import { Terrain } from '../../shared/terrain';
import { Mobility } from '../nav/grid';
import { airOf, Domain, navOf, type World } from '../world';
import { AIR_SUPPLY, airSuperiority } from './airSuperiority';
import { bleedFormation, breakDown } from './elements';
import { markSeaLinks, seaLinkedAll } from './seaSupply';

/** Network refresh period (12 h since PLAN 1.25: armies in motion keep it dirty; dry within 12 + 8 h). */
export const SUPPLY_REFRESH_HOURS = 12;
/** Per hour; a power of two so the level steps exactly between 0 and 1 (8 h to drain or refill). */
export const SUPPLY_RATE = 1 / 8;
export const BASE_ATTRITION_PER_DAY = 0.02;
/**
 * What an hour on the march off the network takes more of the supply level, per unit of the
 * template's fuel (PLAN 3.2b): the panzer division of 1938 (38 an hour) is dry in 4.1 h on the
 * march and in 8 standing. On its network a formation is refilled faster than it burns.
 */
export const MARCH_BURN = SUPPLY_RATE / 40;
/**
 * Org per hour (PLAN 3.2c), a power of two as SUPPLY_RATE is: lost by a formation that moves on
 * engines while its supply is 0 (none left after 32 h), and got back by every formation on a
 * network that feeds it while it is not in contact. Off the network with supply left it stands.
 */
export const ORG_RATE = 1 / 32;
/**
 * Breakdowns (PLAN 3.2d): the share of its vehicles and towed guns that a formation on engines
 * loses in a day with no supply and no org, besides the attrition of every formation without
 * supply. Its men go at that attrition alone.
 */
export const BREAKDOWN_PER_DAY = 0.1;
/**
 * How far from its network a formation is still fed, in cells (Chebyshev, as the pressure of
 * `territory.ts` reaches: PRESSURE_RADIUS), when the cell it stands on is not its side's (PLAN
 * 3.4Rf, ADR-143). The cell under an attacker is the enemy's until the territory rule turns it.
 * On ground of its own side with no network, a pocket, nothing reaches it.
 */
export const SUPPLY_REACH = 2;
const TERRAIN_ATTRITION = terrainJson.terrain.map((t) => t.supplyAttrition);

/** Supply bloc of a nation: its overlord's id, or its own when it has none. */
export function blocOf(world: World, nation: number): number {
  const o = world.nations.cols.overlord[nation] ?? 0;
  return o !== 0 ? o : nation;
}

const seeds: number[] = [];
let spanScratch = new Int32Array(1 << 16);
const ring = new Int32Array(8);

/**
 * Derived, for the tests and the measurements: what the last call of `refreshSupplyNetwork` did.
 * `written` counts the cells it filled, the cells of the spans it cleared and the marks the
 * mending took away; `flooded` the blocs flooded from their sources, `mended` the ones flooded
 * from changed cells alone; `dried` the marks of parts cut off from every source that it cleared
 * alone (PLAN 7.1h, also in `written`); `full` is 1 when every bloc was refreshed (the call's own
 * doing, or what a partial refresh ended in).
 */
export const refreshStats = { written: 0, flooded: 0, mended: 0, dried: 0, full: 0 };

/** What the ring about a cell says (`ringOf`). */
const RING_JOINED = 1;
const RING_OPEN = 0;
const RING_LANE = -1;

/**
 * Whether the network of bloc `m` hangs together as before without cell `c`, whose mark has
 * just been cleared (PLAN 3.10d1b). It does when the network cells among the four neighbours of
 * `c` are joined by way of the network cells of the eight about it: two of the eight that follow
 * one another are 4-neighbours, so what is joined in the ring is joined in the network
 * (RING_JOINED). Not joined in the ring may still be joined a longer way round (RING_OPEN: the
 * search of `holds` asks). A crossing lane in the cell or the eight (the lanes are where the
 * blocs meet) is RING_LANE, and the bloc is flooded whole.
 */
function ringOf(supply: Uint16Array, terrain: Uint8Array, w: number, h: number, wrap: boolean, c: number, m: number): number {
  if (terrain[c] === Terrain.Crossing) return RING_LANE;
  const x = c % w;
  const row = c - x;
  // Beyond an edge of a map that does not loop there is no cell, as above the first row.
  const xl = x > 0 ? x - 1 : wrap ? w - 1 : -1;
  const xr = x < w - 1 ? x + 1 : wrap ? 0 : -1;
  const up = row > 0 ? row - w : -1;
  const dn = row < w * (h - 1) ? row + w : -1;
  ring[0] = up < 0 ? -1 : up + x;
  ring[1] = up < 0 || xr < 0 ? -1 : up + xr;
  ring[2] = xr < 0 ? -1 : row + xr;
  ring[3] = dn < 0 || xr < 0 ? -1 : dn + xr;
  ring[4] = dn < 0 ? -1 : dn + x;
  ring[5] = dn < 0 || xl < 0 ? -1 : dn + xl;
  ring[6] = xl < 0 ? -1 : row + xl;
  ring[7] = up < 0 || xl < 0 ? -1 : up + xl;
  // A place in the ring that is not the network's, to count the runs from.
  let gap = -1;
  for (let i = 0; i < 8; i++) {
    const n = ring[i]!;
    if (n < 0) gap = i;
    else if (terrain[n] === Terrain.Crossing) return RING_LANE;
    else if (supply[n] !== m) gap = i;
  }
  if (gap < 0) return RING_JOINED;
  // The runs of network cells that hold a 4-neighbour (an even place): more than one is a cut.
  let runs = 0;
  let inRun = false;
  let counted = false;
  for (let i = 1; i <= 8; i++) {
    const k = (gap + i) & 7;
    const n = ring[k]!;
    if (n >= 0 && supply[n] === m) {
      if (!inRun) {
        inRun = true;
        counted = false;
      }
      if ((k & 1) === 0 && !counted) {
        counted = true;
        if (++runs > 1) return RING_OPEN;
      }
    } else inRun = false;
  }
  return RING_JOINED;
}

/** How many cells a search of `part` looks at before it gives up (PLAN 7.1h). */
const SEARCH_CELLS = 4096;
/** The searches' marks (1 seen, 2 a start not met yet), 0 between searches, and their queue. */
let seen = new Uint8Array(0);
const searchQueue = new Int32Array(SEARCH_CELLS);
/** The cells of the network a search starts from: the first, then those it has not met. */
const starts: number[] = [];

/** What a search of `part` found. */
const PART_JOINED = 0;
const PART_FED = 1;
const PART_DRY = 2;
const PART_LARGE = 3;
const PART_LANE = 4;

/**
 * The part of bloc `m`'s network that holds `starts[0]`, searched by way of its network cells,
 * lanes aside (PLAN 7.1h). The starts it meets are taken out of `starts`.
 * - PART_JOINED: `join` and it met every start, and a source (`source`) as well when `join` is 2.
 * - PART_LARGE: it has more than SEARCH_CELLS cells; PART_LANE: it touches a lane (where the blocs
 *   meet, and a part joined over a lane is joined).
 * - PART_FED: it holds a source of the bloc; PART_DRY: it holds none, so the rule's flood reaches
 *   none of its cells, and their marks are cleared here.
 */
function part(supply: Uint16Array, terrain: Uint8Array, w: number, h: number, wrap: boolean, m: number, source: (cell: number) => boolean, join: number): number {
  if (seen.length !== supply.length) seen = new Uint8Array(supply.length);
  let left = 0;
  for (const s of starts) {
    if (seen[s] === 2) continue;
    seen[s] = 2;
    left++;
  }
  const first = starts[0]!;
  seen[first] = 1;
  left--;
  searchQueue[0] = first;
  let n = 1;
  let fed = false;
  let lane = false;
  let large = false;
  let joinedAll = false;
  search: for (let head = 0; head < n; head++) {
    const at = searchQueue[head]!;
    if (!fed && source(at)) fed = true;
    if (join > 0 && left === 0 && (fed || join === 1)) {
      joinedAll = true;
      break;
    }
    const x = at % w;
    const row = at - x;
    for (let k = 0; k < 4; k++) {
      // Beyond an edge of a map that does not loop there is no cell, as above the first row.
      let nb: number;
      if (k === 0) nb = row > 0 ? at - w : -1;
      else if (k === 1) nb = row < w * (h - 1) ? at + w : -1;
      else if (k === 2) nb = x > 0 ? at - 1 : wrap ? at + w - 1 : -1;
      else nb = x < w - 1 ? at + 1 : wrap ? row : -1;
      if (nb < 0 || seen[nb] === 1) continue;
      if (terrain[nb] === Terrain.Crossing) {
        lane = true;
        continue;
      }
      if (supply[nb] !== m) continue;
      if (n === SEARCH_CELLS) {
        large = true;
        break search;
      }
      if (seen[nb] === 2) left--;
      seen[nb] = 1;
      searchQueue[n++] = nb;
    }
  }
  for (let i = starts.length - 1; i >= 0; i--) {
    if (seen[starts[i]!] === 1) starts.splice(i, 1);
    else seen[starts[i]!] = 0;
  }
  const out = joinedAll ? PART_JOINED : large ? PART_LARGE : lane ? PART_LANE : fed ? PART_FED : PART_DRY;
  for (let i = 0; i < n; i++) {
    const c = searchQueue[i]!;
    seen[c] = 0;
    if (out === PART_DRY) supply[c] = 0;
  }
  if (out === PART_DRY) {
    refreshStats.written += n;
    refreshStats.dried += n;
  }
  return out;
}

/**
 * Whether the network of bloc `m` is the rule's without cell `c`, whose mark has just been
 * cleared, when no more than its own parts change (PLAN 7.1h). It is when the ring about `c`
 * says its network neighbours are joined (RING_JOINED), or a search (`part`) finds them joined
 * another way; when `c` was a source of the bloc (`lostSource`), they must also reach another
 * of its sources (`source`). When they are not, each part is searched alone: a part with no
 * source is dry and cleared, one with a source stays, and one too large to search stays too when
 * no other part is fed (they all hung together through `c`, so the sources they reached are in
 * it). A lane in a part or about `c`, two large parts, a large one beside one that is fed, or a
 * large one after a source is lost: no, and the bloc is flooded whole. Until 7.1h a ring that did
 * not hold and a city that changed hands flooded their blocs whole.
 */
function holds(supply: Uint16Array, terrain: Uint8Array, w: number, h: number, wrap: boolean, c: number, m: number, lostSource: boolean, source: (cell: number) => boolean): boolean {
  const ring = ringOf(supply, terrain, w, h, wrap, c, m);
  if (ring === RING_LANE) return false;
  if (ring === RING_JOINED && !lostSource) return true;
  const x = c % w;
  const row = c - x;
  starts.length = 0;
  if (row > 0 && supply[c - w] === m) starts.push(c - w);
  if (row < w * (h - 1) && supply[c + w] === m) starts.push(c + w);
  const l = x > 0 ? c - 1 : wrap ? c + w - 1 : -1;
  if (l >= 0 && supply[l] === m) starts.push(l);
  const r = x < w - 1 ? c + 1 : wrap ? row : -1;
  if (r >= 0 && supply[r] === m) starts.push(r);
  let large = 0;
  let fed = false;
  for (let join = lostSource ? 2 : 1; starts.length > 0; join = 0) {
    const found = part(supply, terrain, w, h, wrap, m, source, join);
    if (found === PART_JOINED) return true;
    if (found === PART_LANE) return false;
    if (found === PART_LARGE && (lostSource || ++large > 1)) return false;
    if (found === PART_FED) fed = true;
  }
  return large === 0 || !fed;
}

/** The cells with a city, kept while the cities are the same (PLAN 7.1h). */
const cityCells = new WeakMap<World, { version: number; count: number; high: number; mask: Uint8Array }>();
function cityMask(world: World): Uint8Array {
  const t = world.cities;
  const kept = cityCells.get(world);
  const n = world.cells.w * world.cells.h;
  if (kept && kept.version === world.citiesVersion && kept.count === t.count && kept.high === t.highWater && kept.mask.length === n) return kept.mask;
  const mask = new Uint8Array(n);
  t.forEach((id) => (mask[t.cols.cell[id]!] = 1));
  cityCells.set(world, { version: world.citiesVersion, count: t.count, high: t.highWater, mask });
  return mask;
}

/**
 * Recomputes `cells.supply` from the current cities and control: everything after a full-dirty
 * change, else only at the blocs whose cells changed (other blocs keep their networks).
 *
 * A partial refresh mends (PLAN 3.10d1b, ADR-196): it takes the cells that changed hands since
 * the last refresh (`World.supplyChanged`), all the losses first and then the gains.
 * - A loss is a changed cell that bears the mark of a bloc that no longer holds it. The mark is
 *   cleared, and nothing else changes when the ring about the cell holds (`ringHolds`).
 * - A gain is a changed cell with no mark beside its bloc's network: the bloc's flood goes on
 *   from it, into its dry cells beyond as well (a pocket relieved).
 * - A bloc is cleared and flooded whole from its sources, as every refreshed bloc was until
 *   then, when a ring does not hold or has a lane in it, when a changed cell is a city that is
 *   no longer a source of the bloc it was one of (the bloc it was a source of, the bloc it is
 *   one of, and the bloc of its mark), when its spans have grown to twice those of its last
 *   whole flood, and when it is marked (`supplyDirtyNations`, `supplyDirtyBlocs`) and no
 *   changed cell is its own.
 *
 * A refresh of some blocs gives the network a full one gives (PLAN 2.11j). The blocs meet only
 * at the crossing lanes, which go to the lowest bloc that reaches them, and at cells that have
 * changed hands. So a partial refresh is done again in full when
 * - a lane that a bloc flooded whole held is not its own afterwards (another bloc, not
 *   refreshed, may reach it now), or
 * - a refreshed bloc's flood comes to a cell that is its own to take and lies in another
 *   network: a lane held by a higher bloc, or a cell it controls.
 * Until then a released lane stayed unclaimed and a lower bloc did not take a lane from a
 * higher one, and a loaded world, which refreshes in full, went on otherwise than the world
 * that was saved.
 */
export function refreshSupplyNetwork(world: World, linkedAll?: Map<number, number[]>): void {
  refreshStats.written = refreshStats.flooded = refreshStats.mended = refreshStats.dried = refreshStats.full = 0;
  refresh(world, linkedAll ?? seaLinkedAll(world));
}

/** `linkedAll`: `seaLinkedAll` of the world as it is (the supply system's, asked in the same hour). */
function refresh(world: World, linkedAll: Map<number, number[]>): void {
  const { w, h, controller, owner, terrain, supply } = world.cells;
  const wrap = world.settings.loopingMap;
  const blocOfNation = new Uint16Array(world.nations.highWater + 1);
  world.nations.forEach((n) => (blocOfNation[n] = blocOf(world, n)));
  const full = world.supplyDirty;
  /** Partial: the blocs that are cleared and flooded whole. */
  const only = new Uint8Array(world.nations.highWater + 1);
  const reached = world.supplySpans;
  const changed = world.supplyChanged;
  const cc = world.cities.cols;
  /** Partial: the lanes each bloc flooded whole held before. */
  const held: [number, number[]][] = [];
  /** Partial: per mended bloc, its changed cells with no mark. */
  const gains = new Map<number, number[]>();
  /** Partial: cities made sources, which a mend floods from wherever they lie. */
  const madeSources = new Set<number>();
  const comp = navOf(world).grid.component;
  /** The components a bloc's sources may lie in (`seaLinked`), besides those of no sea's ('0'). */
  const linked = new Map<number, Set<number>>();
  const linkedOf = (b: number): Set<number> => {
    let ok = linked.get(b);
    if (!ok) linked.set(b, (ok = new Set(linkedAll.get(b))));
    return ok;
  };
  if (full) {
    supply.fill(0);
    reached.clear();
    refreshStats.written += supply.length;
    refreshStats.full = 1;
  } else {
    const whole = (b: number): void => {
      if (b !== 0 && b < only.length) only[b] = 1;
    };
    const blocNow = (n: number): number => (n === 0 ? 0 : blocOfNation[n] || n);
    // The blocs with a changed cell of their own: what held or owned it, what does, its mark.
    const own = new Uint8Array(only.length);
    for (const [c, was] of changed) {
      own[blocNow(was >>> 16)] = 1;
      own[blocNow(was & 0xffff)] = 1;
      own[blocNow(controller[c]!)] = 1;
      own[blocNow(owner[c]!)] = 1;
      own[supply[c]!] = 1;
    }
    // Marked with no changed cell (a test, the user; a cell that changed twice names the nation
    // between), and the blocs in whose networks the changed cells lay: a nation's bloc today is
    // not always the one that flooded its cells (a puppet since annexed).
    for (const n of world.supplyDirtyNations) if (own[blocNow(n)] !== 1) whole(blocNow(n));
    for (const b of world.supplyDirtyBlocs) if (own[b] !== 1) whole(b);
    // Lands joined by sea or cut (PLAN 4.4c): whole, cells of its own changed or not (ADR-272: the
    // mends at its changed cells left a land newly joined unflooded).
    for (const b of world.supplySeaBlocs) whole(b);
    for (const [b, kept] of reached) if (own[b] === 1 && kept.n > 2 * kept.base) whole(b);
    // A city that changed hands: a source made or lost (PLAN 7.1h: until then its blocs were
    // flooded whole). A source made is flooded from (below); the land that hung on a source lost
    // must reach another of its bloc's, or the bloc is flooded whole.
    const cities = cityMask(world);
    const sourceOf = (m: number) => (cell: number): boolean => {
      if (cities[cell] !== 1) return false;
      const ctl = controller[cell]!;
      return ctl !== 0 && owner[cell] === ctl && blocOfNation[ctl] === m && (comp[cell] === 0 || linkedOf(m).has(comp[cell]!));
    };
    const lost = new Map<number, number>();
    world.cities.forEach((id) => {
      const cell = cc.cell[id]!;
      const was = changed.get(cell);
      if (was === undefined) return;
      const mark = supply[cell]!;
      const holder = was >>> 16;
      const wasOf = holder !== 0 && (was & 0xffff) === holder ? mark || blocNow(holder) : 0;
      const ctl = controller[cell]!;
      const isOf = ctl !== 0 && owner[cell] === ctl ? blocOfNation[ctl]! : 0;
      if (wasOf === isOf) return;
      // Out of every network, it fed none (a source's cell is its bloc's to flood first).
      if (wasOf !== 0 && mark === wasOf) lost.set(cell, wasOf);
      else if (mark !== 0 && mark !== isOf) whole(mark);
      if (isOf !== 0) madeSources.add(cell);
    });
    // The losses, each against the layer as the ones before it left it.
    let cleared = 0;
    for (const c of changed.keys()) {
      const m = supply[c]!;
      if (m === 0) continue;
      const ctl = controller[c]!;
      if (ctl !== 0 && blocOfNation[ctl] === m) continue;
      supply[c] = 0;
      cleared++;
      if (m < only.length && only[m] !== 1 && !holds(supply, terrain, w, h, wrap, c, m, lost.get(c) === m, sourceOf(m))) only[m] = 1;
    }
    // A source lost on a cell its bloc still holds (another owns it now): its part of the network
    // reaches another source, or is dry.
    for (const [c, m] of lost) {
      if (supply[c] !== m || m >= only.length || only[m] === 1) continue;
      starts.length = 0;
      starts.push(c);
      const found = part(supply, terrain, w, h, wrap, m, sourceOf(m), 2);
      if (found === PART_LARGE || found === PART_LANE) only[m] = 1;
    }
    // The blocs flooded whole are cleared, all of them before any flood. A span may hold cells
    // that have left the network since it was filled, and some of them bear another mark by now.
    for (let b = 1; b < only.length; b++) {
      if (only[b] !== 1) continue;
      const old = reached.get(b);
      if (!old) continue;
      const spans = old.spans;
      for (let i = 0; i < old.n; i += 2) {
        const end = spans[i + 1]!;
        for (let k = spans[i]!; k < end; k++) if (supply[k] === b) supply[k] = 0;
        cleared += end - spans[i]!;
      }
      if (old.lanes.length > 0) held.push([b, old.lanes]);
      reached.delete(b);
    }
    refreshStats.written += cleared;
    // The gains: after the losses a changed cell bears no mark or its own bloc's.
    for (const c of changed.keys()) {
      const ctl = controller[c]!;
      if (ctl === 0 || supply[c] !== 0) continue;
      const b = blocOfNation[ctl]!;
      if (b === 0 || only[b] === 1) continue;
      const list = gains.get(b);
      if (list) list.push(c);
      else gains.set(b, [c]);
    }
  }
  world.supplyDirty = false;
  world.supplyDirtyNations.clear();
  world.supplyDirtyBlocs.clear();
  world.supplySeaBlocs.clear();
  changed.clear();
  /** Partial: this refresh met what only a full one settles. */
  let again = false;
  // Sources per bloc: cities owned and controlled by a member, on a land its supply reaches by
  // sea (PLAN 4.4c, `seaLinked`: home, joined by a way no enemy holds, or with no port of it).
  const sources = new Map<number, number[]>();
  world.cities.forEach((id) => {
    const cell = cc.cell[id]!;
    const ctl = controller[cell]!;
    if (ctl === 0 || owner[cell] !== ctl) return;
    const b = blocOfNation[ctl]!;
    if (!full && only[b] !== 1) return;
    if (comp[cell] !== 0 && !linkedOf(b).has(comp[cell]!)) return;
    let list = sources.get(b);
    if (!list) sources.set(b, (list = []));
    list.push(cell);
  });
  // The blocs with work, in ascending order: flooded whole (they have sources) or mended.
  const blocs = [...sources.keys(), ...gains.keys()].sort((a, b) => a - b);
  for (const b of blocs) {
    // Whether the flood of bloc b may enter cell n: not yet in a network, and held by the bloc or
    // an unclaimed crossing lane.
    const lanes: number[] = [];
    const open = (n: number): boolean => {
      const ctl = controller[n]!;
      const mark = supply[n]!;
      if (mark !== 0) {
        // In a network already. In another's, though a full refresh would give it to this bloc
        // (its own cell; a lane that a higher bloc holds): this refresh cannot stand.
        if (!full && mark !== b && (ctl !== 0 ? blocOfNation[ctl] === b : terrain[n] === Terrain.Crossing && mark > b)) again = true;
        return false;
      }
      if (ctl !== 0) return blocOfNation[ctl] === b;
      if (terrain[n] !== Terrain.Crossing) return false;
      // A lane of this bloc's from here on: every open cell is filled before the flood ends.
      lanes.push(n);
      return true;
    };
    let spans = spanScratch;
    let n = 0;
    seeds.length = 0;
    const mend = gains.get(b);
    if (mend) {
      // From the changed cells beside the network: the others are reached from these, or not at
      // all; and from a source made there, which the bloc's sea reaches (PLAN 7.1h).
      for (const c of mend) {
        if (madeSources.has(c) && (comp[c] === 0 || linkedOf(b).has(comp[c]!))) {
          seeds.push(c);
          continue;
        }
        const x = c % w;
        const beside =
          (x > 0 ? supply[c - 1] === b : wrap && supply[c + w - 1] === b) ||
          (x < w - 1 ? supply[c + 1] === b : wrap && supply[c - w + 1] === b) ||
          (c >= w && supply[c - w] === b) ||
          (c < w * (h - 1) && supply[c + w] === b);
        if (beside) seeds.push(c);
      }
      if (seeds.length === 0) continue;
      refreshStats.mended++;
    } else {
      for (const s of sources.get(b)!) seeds.push(s);
      refreshStats.flooded++;
    }
    while (seeds.length > 0) {
      const s = seeds.pop()!;
      if (supply[s] !== 0) continue; // filled since it was pushed
      const row = s - (s % w);
      const rowEnd = row + w;
      let l = s;
      while (l > row && open(l - 1)) l--;
      let r = s + 1;
      while (r < rowEnd && open(r)) r++;
      supply.fill(b, l, r);
      refreshStats.written += r - l;
      if (n === spans.length) {
        spans = new Int32Array(n * 2);
        spans.set(spanScratch);
        spanScratch = spans;
      }
      spans[n++] = l;
      spans[n++] = r;
      // East–west wrap, then one seed per run of open cells in the rows above and below.
      if (wrap && l === row && open(rowEnd - 1)) seeds.push(rowEnd - 1);
      if (wrap && r === rowEnd && open(row)) seeds.push(row);
      for (let d = -w; d <= w; d += 2 * w) {
        if (d < 0 ? row === 0 : rowEnd === w * h) continue;
        let inRun = false;
        for (let c = l + d; c < r + d; c++) {
          if (!open(c)) inRun = false;
          else if (!inRun) {
            inRun = true;
            seeds.push(c);
          }
        }
      }
    }
    let kept = reached.get(b);
    if (mend && kept) {
      // The mending adds its spans and its lanes to the bloc's.
      if (kept.spans.length < kept.n + n) {
        const grown = new Int32Array(kept.n + n + ((kept.n + n) >> 2));
        grown.set(kept.spans.subarray(0, kept.n));
        kept.spans = grown;
      }
      kept.spans.set(spans.subarray(0, n), kept.n);
      kept.n += n;
      if (lanes.length > 0) kept.lanes = [...new Set([...kept.lanes, ...lanes])];
      continue;
    }
    // Remember the network for the next partial refresh (the buffer is reused when it fits).
    if (!kept || kept.spans.length < n) reached.set(b, (kept = { spans: new Int32Array(n + (n >> 2)), n: 0, base: 0, lanes }));
    kept.spans.set(spans.subarray(0, n));
    kept.n = kept.base = n;
    // (A lane is asked about from each side it is reached from: once in the list is enough.)
    kept.lanes = lanes.length > 1 ? [...new Set(lanes)] : lanes;
  }
  if (full) return;
  for (const [b, old] of held) {
    for (const c of old) if (supply[c] !== b) again = true;
  }
  if (again) {
    world.supplyDirty = true;
    refresh(world, linkedAll);
  }
}

/**
 * A nation's air superiority by air zone this hour, at `nation × (zones + 1) + zone` (PLAN 7.1h:
 * until then a `Map`): asked once a call, which `superiorityCall` names in `superiorityAt`.
 */
let superiorityOf = new Float64Array(0);
let superiorityAt = new Uint32Array(0);
let superiorityCall = 0;
/** Per template, 1 when its formations are not fed over land: a fleet's, an air wing's (`World.offLand`). */
let offLandTemplate = new Uint8Array(0);

export function supplySystem(world: World): void {
  // Supply over sea (PLAN 4.4c): a bloc whose lands joined by sea changed is refreshed whole.
  if (world.tick % SUPPLY_REFRESH_HOURS === 0) {
    const linked = world.rules ? markSeaLinks(world) : undefined;
    if (world.supplyDirty || world.supplyDirtyNations.size > 0 || world.supplyDirtyBlocs.size > 0 || world.supplySeaBlocs.size > 0) refreshSupplyNetwork(world, linked);
  }
  const f = world.formations;
  const c = f.cols;
  const { w, h, supply, terrain, controller } = world.cells;
  const wrap = world.settings.loopingMap;
  let nation = 0;
  let bloc = 0;
  /** Whether the network `net` feeds the formation at hand. */
  const feeds = (net: number): boolean => net !== 0 && (net === bloc || world.wars.sameSide(net, bloc) || world.wars.sameSide(net, nation));
  // A nation's air superiority by air zone, this hour (PLAN 5.8t1): the same for each of its formations there.
  const air = world.airPower.size > 0 ? airOf(world) : null;
  const zones = air ? air.zoneOf : null;
  const stride = air ? air.count + 1 : 0;
  if (air) {
    const need = (world.nations.highWater + 1) * stride;
    if (superiorityOf.length < need) {
      superiorityOf = new Float64Array(need);
      superiorityAt = new Uint32Array(need);
      superiorityCall = 0;
    }
    superiorityCall = (superiorityCall + 1) >>> 0;
    if (superiorityCall === 0) {
      superiorityAt.fill(0);
      superiorityCall = 1;
    }
  }
  const airOver = (n: number, cell: number): number => {
    const zone = zones![cell]!;
    const key = n * stride + zone;
    if (superiorityAt[key] !== superiorityCall) {
      superiorityAt[key] = superiorityCall;
      superiorityOf[key] = airSuperiority(world, n, zone);
    }
    return superiorityOf[key]!;
  };
  const templates = world.rules?.templates;
  if (templates) {
    if (offLandTemplate.length < templates.length) offLandTemplate = new Uint8Array(templates.length);
    for (let t = 0; t < templates.length; t++) offLandTemplate[t] = templates[t]?.domain === Domain.sea || templates[t]?.domain === Domain.air ? 1 : 0;
  }
  const embarked = world.embarked;
  f.forEach((id) => {
    // A fleet is not fed over land: it keeps what it has (PLAN 4.2b; the sea's supply is PLAN 4.4).
    // Nor is an air wing, nor an army aboard (`World.offLand`).
    if ((templates !== undefined && c.template[id]! < templates.length && offLandTemplate[c.template[id]!] === 1) || embarked.has(id)) return;
    const cell = Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!);
    nation = c.nation[id]!;
    bloc = blocOf(world, nation);
    let inSupply = feeds(supply[cell]!);
    if (!inSupply) {
      const ctl = controller[cell]!;
      const ctlBloc = ctl === 0 ? 0 : blocOf(world, ctl);
      const own = ctl !== 0 && (ctlBloc === bloc || world.wars.sameSide(ctl, nation) || world.wars.sameSide(ctlBloc, bloc));
      if (!own) {
        const cx = cell % w;
        const cy = (cell - cx) / w;
        // The networks about a formation are few: the last one asked about answers for most cells.
        let last = 0;
        for (let dy = -SUPPLY_REACH; dy <= SUPPLY_REACH && !inSupply; dy++) {
          const y = cy + dy;
          if (y < 0 || y >= h) continue;
          for (let dx = -SUPPLY_REACH; dx <= SUPPLY_REACH; dx++) {
            // Beyond an edge of a map that does not loop there is no cell (PLAN 3.12Rsb).
            const x = cx + dx;
            const xw = x < 0 ? (wrap ? x + w : -1) : x >= w ? (wrap ? x - w : -1) : x;
            if (xw < 0) continue;
            const net = supply[y * w + xw]!;
            if (net === last) continue;
            last = net;
            if (feeds(net)) {
              inSupply = true;
              break;
            }
          }
        }
      }
    }
    const s = c.supply[id]!;
    const rule = world.rules?.templates[c.template[id]!];
    const burn = c.moving[id] === 1 && c.engaged[id] !== 1 ? MARCH_BURN * (rule?.fuel ?? 0) : 0;
    // Under the enemy's air it is fed slower, under its own faster (PLAN 5.8t1). Full, it stays
    // full whatever the air: the gain is never below nothing while AIR_SUPPLY is at most 1, so
    // the air is not asked (PLAN 7.1h).
    const gain = inSupply && s < 1 && world.airPower.size > 0 ? SUPPLY_RATE * (1 + AIR_SUPPLY * (2 * airOver(nation, cell) - 1)) : SUPPLY_RATE;
    c.supply[id] = inSupply ? Math.min(1, s + gain) : Math.max(0, s - SUPPLY_RATE - burn);
    // Not in contact (PLAN 3.5a): a formation gets its order back out of the fight.
    if (inSupply && c.engaged[id] !== 1) c.org[id] = Math.min(1, c.org[id]! + ORG_RATE);
    if (c.supply[id] === 0) {
      // As the speed rule has it (movement.ts): a formation with a manoeuvre element on foot is not one on engines.
      if (rule && rule.mobility !== Mobility.foot) {
        c.org[id] = Math.max(0, c.org[id]! - ORG_RATE);
        if (c.org[id] === 0) breakDown(world, id, BREAKDOWN_PER_DAY / 24);
      }
      const perHour = (BASE_ATTRITION_PER_DAY + (TERRAIN_ATTRITION[terrain[cell]!] ?? 0)) / 24;
      bleedFormation(world, id, perHour);
    }
  });
}
