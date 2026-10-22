/**
 * Supply over sea (PLAN 4.4c, SPEC §6.2): which of a bloc's lands its cities feed from.
 *
 * A bloc's home is every land component (`NavGrid.component`) that holds the capital of a living
 * member, and the one that holds the most of its cities (a capital's cell can be a patch of
 * land of its own by the coast: Rio de Janeiro's, Tallinn's). Another component is joined to it by sea when a port of the bloc there (one whose land
 * cell a member owns and controls, with water a ship reaches: `portSeaOf`, its zone not closed
 * by ice) is reached from a port of the bloc at home by a way from zone to zone (the zones that
 * touch, `SeaZones.adj`, and the map's passages) that enters no zone held by a nation at war
 * with the bloc (`seaHolder`, PLAN 4.4a) and starts from no such zone, and takes no passage
 * whose bank such a nation holds (`passageShut`, PLAN 4.4e). A component where the
 * bloc has no port is not cut by sea: its trade is not followed. A city is a source of its
 * bloc's network only on a component that is home, joined or not cut (`seaLinked`).
 *
 * Supply over the beach (PLAN 7.70a, ADR-622): on a land where the bloc owns and controls no
 * city, a coast cell it controls is a source of its network (`seaBeaches`) when a zone of the
 * water beside it is not closed by ice and is reached from a home port's zone by a way as above
 * (one that enters no zone an enemy of the bloc holds). A formation fed on such a land is fed at
 * a beach's rate (supply.ts).
 *
 * The supply's refresh reads it; whether it changed for a bloc is asked at each refresh hour
 * (`markSeaLinks`): a bloc whose joined components or beach sources changed is refreshed whole,
 * so a partial refresh gives what a full one gives.
 */
import { isLand } from '../../shared/terrain';
import { cellOf } from '../data/terrain';
import { nearestCellWhere } from '../data/ownership';
import { PASSAGE_SNAP } from '../nav/lanes';
import type { SeaZones } from '../nav/seaZones';
import { navOf, portSeaOf, seaOf, type World } from '../world';
import { blocOf } from './supply';

/** The zones each zone leads to: those it touches and the other ends of its passages; and which pairs only a passage joins, by its index (cached by the zones). */
const linksCache = new WeakMap<SeaZones, { links: number[][]; through: Map<number, number> }>();
function zoneGraph(world: World): { links: number[][]; through: Map<number, number> } {
  const z = seaOf(world);
  const hit = linksCache.get(z);
  if (hit) return hit;
  const links = z.adj.map((a) => a.slice());
  const through = new Map<number, number>();
  const { w, h } = world.cells;
  world.seaPassages.forEach((p, i) => {
    const end = (lonLat: readonly [number, number]): number => {
      const [x, y] = cellOf(lonLat[0], lonLat[1], w, h);
      const c = nearestCellWhere((k) => z.zoneOf[k] !== 0, x, y, w, h, PASSAGE_SNAP, world.settings.loopingMap);
      return c < 0 ? 0 : z.zoneOf[c]!;
    };
    const a = end(p.a);
    const b = end(p.b);
    if (a === 0 || b === 0 || a === b) return;
    if (!links[a]!.includes(b)) {
      links[a]!.push(b);
      links[b]!.push(a);
      through.set(a * 0x10000 + b, i);
      through.set(b * 0x10000 + a, i);
    }
  });
  for (const l of links) l.sort((p, q) => p - q);
  const out = { links, through };
  linksCache.set(z, out);
  return out;
}

/** The zones each zone leads to: those it touches and the other ends of its passages. */
export function zoneLinks(world: World): number[][] {
  return zoneGraph(world).links;
}

/** How far, in cells, a passage's bank is looked for from the middle of its ends. */
const BANK_REACH = 4;

/** The land cell that is the bank of passage `i` of `world.seaPassages` (the land nearest the middle of its ends), or -1. */
export function passageBank(world: World, i: number): number {
  // Kept by the passages and the terrain (PLAN 7.70a: asked for each bloc's way at each refresh).
  const { w, h, terrain } = world.cells;
  let kept = bankCache.get(world.seaPassages);
  if (!kept || kept.terrain !== terrain || kept.version !== world.terrainVersion || kept.wrap !== world.settings.loopingMap) {
    bankCache.set(world.seaPassages, (kept = { terrain, version: world.terrainVersion, wrap: world.settings.loopingMap, banks: new Map() }));
  }
  const hit = kept.banks.get(i);
  if (hit !== undefined) return hit;
  const p = world.seaPassages[i]!;
  const [x, y] = cellOf((p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2, w, h);
  const bank = nearestCellWhere((k) => isLand(terrain[k]!), x, y, w, h, world.atSize(BANK_REACH), world.settings.loopingMap);
  kept.banks.set(i, bank);
  return bank;
}
const bankCache = new WeakMap<object, { terrain: Uint8Array; version: number; wrap: boolean; banks: Map<number, number> }>();

/** Whether passage `i` is shut to a ship of `nation` (PLAN 4.4e): its bank is held by a nation at war with it. */
export function passageShut(world: World, i: number, nation: number): boolean {
  const bank = passageBank(world, i);
  const holder = bank < 0 ? 0 : world.cells.controller[bank]!;
  return holder !== 0 && world.wars.atWar(holder, nation);
}

/** The land components whose cities feed bloc `bloc`'s network (see the head of the file), sorted. */
export function seaLinked(world: World, bloc: number): number[] {
  return seaLinkedAll(world).get(bloc) ?? [];
}

/** `seaLinked` of every bloc with a city, in one pass over the nations, the ports and the cities. */
export function seaLinkedAll(world: World): Map<number, number[]> {
  return seaReach(world).linked;
}

/** Per bloc with any, its beach sources (PLAN 7.70a, the head of the file): coast cells, ascending. */
export function seaBeaches(world: World): Map<number, number[]> {
  return seaReach(world, true).beaches!;
}

/**
 * Where a beachhead of nation `n`'s would be fed from the sea (PLAN 7.70b, ADR-623): the lands on
 * which its bloc owns and controls a city (`cityLands`: a beach there is no source, 7.70a's rule),
 * and the zones its bloc's way from home reaches (`seen[zone]` 1; `seaWay`, no zone an enemy of
 * the bloc holds). A coast cell on a land not in `cityLands`, beside a zone `seen` and not iced, is
 * a beach source once the bloc controls it. Null for a bloc with no city or no port (no beach of
 * its is fed). For the world as it is when called; the caller keeps nothing of it.
 */
export function beachReach(world: World, n: number): { cityLands: ReadonlySet<number>; seen: Uint8Array } | null {
  const { parts } = seaReach(world);
  const b = parts.blocOfNation[n] ?? 0;
  const cities = parts.cities.get(b);
  const byComp = parts.ports.get(b);
  if (!cities || !byComp) return null;
  let seen = parts.seen.get(b);
  if (!seen) {
    seaWay(world, b, parts.own.get(b)!, byComp, world.wars.nations());
    seen = seaSeen.slice(0, seaOf(world).count + 1);
    parts.seen.set(b, seen);
  }
  return { cityLands: new Set(cities.keys()), seen };
}

/**
 * The land cells by the sea (PLAN 7.70a): those with a 4-neighbour in a sea zone, ascending, and
 * the zones beside each (`zones[at[i]]` to `zones[at[i + 1]]`, distinct). Kept by the grid's
 * components and the zones, which are the map's own.
 */
interface Coast {
  cells: Int32Array;
  at: Int32Array;
  zones: Int32Array;
}
const coastCache = new WeakMap<Uint32Array, { z: SeaZones; coast: Coast }>();
function coastOf(world: World): Coast {
  const comp = navOf(world).grid.component;
  const z = seaOf(world);
  const hit = coastCache.get(comp);
  if (hit && hit.z === z) return hit.coast;
  const { w, h } = world.cells;
  const wrap = world.settings.loopingMap;
  const cells: number[] = [];
  const at: number[] = [0];
  const zones: number[] = [];
  const zoneOf = z.zoneOf;
  const four = [0, 0, 0, 0];
  for (let k = 0; k < w * h; k++) {
    if (comp[k] === 0) continue;
    const x = k % w;
    const row = k - x;
    four[0] = row > 0 ? zoneOf[k - w]! : 0;
    four[1] = row < w * (h - 1) ? zoneOf[k + w]! : 0;
    four[2] = x > 0 ? zoneOf[k - 1]! : wrap ? zoneOf[k + w - 1]! : 0;
    four[3] = x < w - 1 ? zoneOf[k + 1]! : wrap ? zoneOf[row]! : 0;
    if (four[0] === 0 && four[1] === 0 && four[2] === 0 && four[3] === 0) continue;
    const start = zones.length;
    for (const zone of four) if (zone !== 0 && !zones.includes(zone, start)) zones.push(zone);
    cells.push(k);
    at.push(zones.length);
  }
  const coast = { cells: Int32Array.from(cells), at: Int32Array.from(at), zones: Int32Array.from(zones) };
  coastCache.set(comp, { z, coast });
  return coast;
}

/**
 * The ways of every bloc's convoys (PLAN 4.4d): per bloc, per land joined to home by sea that is
 * not home, the zones of the shortest way (in zones) from a home port's zone to a port of that
 * land, the home end first.
 */
export function convoyWays(world: World): Map<number, Map<number, number[]>> {
  return seaReach(world).ways;
}

/**
 * The cities on a land of the nav grid (component not 0), in ascending id: their cells, and the
 * slot of their component among the cities' components (`lands`), kept while the cities and the
 * grid are the same (PLAN 7.1h).
 */
interface LandCities {
  version: number;
  count: number;
  high: number;
  comp: Uint32Array;
  cells: Int32Array;
  slots: Int32Array;
  lands: Uint32Array;
  /** Per component, its slot in `lands`, or -1. */
  slotOf: Int32Array;
}
const cityLands = new WeakMap<World, LandCities>();
function landCities(world: World, comp: Uint32Array): LandCities {
  const t = world.cities;
  const kept = cityLands.get(world);
  if (kept && kept.version === world.citiesVersion && kept.count === t.count && kept.high === t.highWater && kept.comp === comp) return kept;
  const cells: number[] = [];
  const slots: number[] = [];
  const slotOf = new Map<number, number>();
  t.forEach((id) => {
    const cell = t.cols.cell[id]!;
    const c = comp[cell]!;
    if (c === 0) return;
    let slot = slotOf.get(c);
    if (slot === undefined) slotOf.set(c, (slot = slotOf.size));
    cells.push(cell);
    slots.push(slot);
  });
  let top = 0;
  for (const c of slotOf.keys()) top = Math.max(top, c);
  const slotOfComp = new Int32Array(top + 1).fill(-1);
  for (const [c, slot] of slotOf) slotOfComp[c] = slot;
  const out = { version: world.citiesVersion, count: t.count, high: t.highWater, comp, cells: Int32Array.from(cells), slots: Int32Array.from(slots), lands: Uint32Array.from(slotOf.keys()), slotOf: slotOfComp };
  cityLands.set(world, out);
  return out;
}

/** `blocCityLands`' table, reused from call to call. */
let blocLandTable = new Uint8Array(0);

/**
 * Whether bloc `b` owns and controls a city on land `land` (PLAN 7.70a: a network on a land where
 * its bloc has none is fed from its beach), for the world as it is when called: one pass over the
 * cities. `blocOfNation`: each nation's supply bloc. Valid until the next call.
 */
export function blocCityLands(world: World, blocOfNation: ArrayLike<number>): (b: number, land: number) => boolean {
  const { table, n, slotOf } = cityLandTable(world, blocOfNation);
  return (b, land) => {
    const slot = land < slotOf.length ? slotOf[land]! : -1;
    return slot >= 0 && b < blocOfNation.length && table[b * n + slot] === 1;
  };
}

/** `blocCityLands`' table: 1 at `b * n + slotOf[land]` where bloc b owns and controls a city on the land. */
function cityLandTable(world: World, blocOfNation: ArrayLike<number>): { table: Uint8Array; n: number; slotOf: Int32Array } {
  const comp = navOf(world).grid.component;
  const { cells, slots, lands, slotOf } = landCities(world, comp);
  const { owner, controller } = world.cells;
  const n = lands.length;
  const size = blocOfNation.length * n;
  if (blocLandTable.length < size) blocLandTable = new Uint8Array(size);
  else blocLandTable.fill(0, 0, size);
  const table = blocLandTable;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    const ctl = controller[cell]!;
    if (ctl === 0 || owner[cell] !== ctl) continue;
    table[blocOfNation[ctl]! * n + slots[i]!] = 1;
  }
  return { table, n, slotOf };
}
/** The count of each (land slot, bloc) pair of a call, 0 between calls, and the pairs in the order met. */
let pairCount = new Uint32Array(0);
let pairOrder = new Int32Array(0);

interface Reach {
  linked: Map<number, number[]>;
  ways: Map<number, Map<number, number[]>>;
  /** Computed when first asked for (`seaReach`'s `withBeaches`), from `parts`; null until then. */
  beaches: Map<number, number[]> | null;
  parts: ReachParts;
}

/** What `reach` made the ways from, for the beaches asked later in the same state. */
interface ReachParts {
  blocOfNation: Uint16Array;
  /** Per bloc with a city: its cities' lands with their counts. */
  cities: Map<number, Map<number, number>>;
  /** Per bloc: its ports' zones by land. */
  ports: Map<number, Map<number, number[]>>;
  /** Per bloc with a city: its home lands (the head of the file). */
  own: Map<number, Set<number>>;
  /** Per bloc whose way `reach` searched: the zones it reached (`seaSeen`). */
  seen: Map<number, Uint8Array>;
}

/**
 * What `seaReach` answered last in an hour, and what it read that can change within one (PLAN
 * 7.1l2): the hour; the counters of the cells' holders, the wars and the cities (with the
 * cities' count and high water, as `landCities`); each nation's bloc and its capital's land (0
 * when it is dead); the zones' holders. The grid, the zones, the ports and the passages are the
 * map's own. Callers only read what it returns.
 */
interface ReachKept {
  tick: number;
  control: number;
  owner: number;
  wars: number;
  cities: number;
  cityCount: number;
  cityHigh: number;
  comp: Uint32Array;
  nations: Int32Array;
  holder: Uint16Array | null;
  out: Reach;
}
const reachKept = new WeakMap<World, ReachKept>();

/** Derived, for the tests and the measurements: the calls of `seaReach`, and those that computed. */
export const reachStats = { calls: 0, computed: 0 };

function sameArray(a: ArrayLike<number> | null, b: ArrayLike<number> | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** The ways and the joined lands of every bloc, kept within the hour while nothing they are made from changes (`ReachKept`). */
function seaReach(world: World, withBeaches = false): Reach {
  reachStats.calls++;
  const comp = navOf(world).grid.component;
  const w = world.cells.w;
  const nc = world.nations.cols;
  const blocOfNation = new Uint16Array(world.nations.highWater + 1);
  world.nations.forEach((n) => (blocOfNation[n] = blocOf(world, n)));
  /** Per nation: its bloc, and its capital's land if it lives. */
  const nations = new Int32Array(2 * blocOfNation.length);
  world.nations.forEach((n) => {
    nations[2 * n] = blocOfNation[n]!;
    if (nc.living[n] === 1) nations[2 * n + 1] = comp[Math.floor(nc.capitalY[n]!) * w + Math.floor(nc.capitalX[n]!)]!;
  });
  const holder = world.seaControl?.holder ?? null;
  const kept = reachKept.get(world);
  if (
    kept &&
    kept.tick === world.tick &&
    kept.control === world.controlChanges &&
    kept.owner === world.ownerChanges &&
    kept.wars === world.wars.version &&
    kept.cities === world.citiesVersion &&
    kept.cityCount === world.cities.count &&
    kept.cityHigh === world.cities.highWater &&
    kept.comp === comp &&
    sameArray(kept.nations, nations) &&
    sameArray(kept.holder, holder)
  ) {
    if (withBeaches && kept.out.beaches === null) kept.out.beaches = beachesOf(world, kept.out.parts);
    return kept.out;
  }
  reachStats.computed++;
  const out = reach(world, blocOfNation, nations);
  if (withBeaches) out.beaches = beachesOf(world, out.parts);
  reachKept.set(world, { tick: world.tick, control: world.controlChanges, owner: world.ownerChanges, wars: world.wars.version, cities: world.citiesVersion, cityCount: world.cities.count, cityHigh: world.cities.highWater, comp, nations, holder: holder && holder.slice(), out });
  return out;
}

function reach(world: World, blocOfNation: Uint16Array, nations: Int32Array): Reach {
  const comp = navOf(world).grid.component;
  const { owner, controller } = world.cells;
  const home = new Map<number, Set<number>>();
  world.nations.forEach((n) => {
    const c = nations[2 * n + 1]!;
    if (c === 0) return;
    const b = blocOfNation[n]!;
    let set = home.get(b);
    if (!set) home.set(b, (set = new Set()));
    set.add(c);
  });
  // The blocs' ports, by bloc and component, with the zone of their water.
  const water = portSeaOf(world);
  const z = seaOf(world);
  const ports = new Map<number, Map<number, number[]>>();
  world.ports.forEach((p, i) => {
    const ctl = controller[p.cell]!;
    if (ctl === 0 || owner[p.cell] !== ctl || water[i]! < 0) return;
    const zone = z.zoneOf[water[i]!]!;
    const c = comp[p.cell]!;
    if (zone === 0 || z.closed[zone] === 1 || c === 0) return;
    const b = blocOfNation[ctl]!;
    let byComp = ports.get(b);
    if (!byComp) ports.set(b, (byComp = new Map()));
    let list = byComp.get(c);
    if (!list) byComp.set(c, (list = []));
    list.push(zone);
  });
  // The cities' components by bloc, with their counts: counted by pair first (PLAN 4.8i3: one
  // look-up a city, not two; PLAN 7.1h: in kept typed arrays), then by bloc in the order the
  // pairs were met, which is the order a bloc's components were met in.
  const { cells: cityCells, slots, lands } = landCities(world, comp);
  const stride = blocOfNation.length;
  if (pairCount.length < lands.length * stride) pairCount = new Uint32Array(lands.length * stride);
  if (pairOrder.length < cityCells.length) pairOrder = new Int32Array(cityCells.length);
  let met = 0;
  for (let i = 0; i < cityCells.length; i++) {
    const cell = cityCells[i]!;
    const ctl = controller[cell]!;
    if (ctl === 0 || owner[cell] !== ctl) continue;
    const key = slots[i]! * stride + blocOfNation[ctl]!;
    if (pairCount[key] === 0) pairOrder[met++] = key;
    pairCount[key] = pairCount[key]! + 1;
  }
  const cities = new Map<number, Map<number, number>>();
  for (let i = 0; i < met; i++) {
    const key = pairOrder[i]!;
    const b = key % stride;
    let m = cities.get(b);
    if (!m) cities.set(b, (m = new Map()));
    m.set(lands[(key - b) / stride]!, pairCount[key]!);
    pairCount[key] = 0;
  }
  const out = new Map<number, number[]>();
  const ways = new Map<number, Map<number, number[]>>();
  const ownOf = new Map<number, Set<number>>();
  const seenOf = new Map<number, Uint8Array>();
  const fighting = world.wars.nations();
  for (const b of [...cities.keys()].sort((p, q) => p - q)) {
    const m = cities.get(b)!;
    const own = new Set(home.get(b));
    let most = 0;
    for (const [c, n] of m) if (most === 0 || n > m.get(most)! || (n === m.get(most)! && c < most)) most = c;
    own.add(most);
    ownOf.set(b, own);
    const byComp = ports.get(b);
    const list: number[] = [];
    const away = [...m.keys()].filter((c) => !own.has(c) && byComp?.has(c));
    if (away.length > 0) {
      seaWay(world, b, own, byComp!, fighting);
      seenOf.set(b, seaSeen.slice(0, seaOf(world).count + 1));
      const byLand = new Map<number, number[]>();
      for (const c of away) {
        // The port's zone reached first: its way back to home.
        let end = 0;
        for (const zone of byComp!.get(c)!) if (seaSeen[zone] === 1 && (end === 0 || seaOrder[zone]! < seaOrder[end]!)) end = zone;
        if (end === 0) continue;
        list.push(c);
        const way: number[] = [];
        for (let k = end; k !== 0; k = seaFrom[k]!) way.push(k);
        byLand.set(c, way.reverse());
      }
      ways.set(b, byLand);
    }
    for (const c of m.keys()) if (own.has(c) || !byComp?.has(c)) list.push(c);
    out.set(b, list.sort((p, q) => p - q));
  }
  return { linked: out, ways, beaches: null, parts: { blocOfNation, cities, ports, own: ownOf, seen: seenOf } };
}

/** The search's marks of `seaWay`: per zone, reached (`seaSeen`), from which zone, in what order. */
let seaSeen = new Uint8Array(0);
let seaFrom = new Int32Array(0);
let seaOrder = new Int32Array(0);
const seaQueue: number[] = [];

/**
 * The zones bloc `b` reaches from its home ports' zones (`own`'s lands, `byComp` its ports) by a
 * way that enters no zone an enemy of the bloc holds, no iced zone, and no passage shut to it:
 * `seaSeen` 1 for each, `seaFrom` the zone it was reached from (0 for a start), `seaOrder` when.
 */
function seaWay(world: World, b: number, own: Set<number>, byComp: Map<number, number[]>, fighting: Set<number>): void {
  const z = seaOf(world);
  const holder = world.seaControl?.holder;
  const { links, through } = zoneGraph(world);
  const shut = (zone: number): boolean => {
    const h = holder?.[zone] ?? 0;
    return h !== 0 && world.wars.atWar(h, b);
  };
  const z1 = z.count + 1;
  if (seaSeen.length < z1) [seaSeen, seaFrom, seaOrder] = [new Uint8Array(z1), new Int32Array(z1), new Int32Array(z1)];
  // At war with nobody, nothing is shut to it: the search is the map's, kept by where it starts.
  let key = '';
  let peace: Map<string, PeaceWay> | undefined;
  if (!fighting.has(b)) {
    for (const c of own) for (const zone of byComp.get(c) ?? []) key += `${zone},`;
    peace = peaceWays.get(z);
    if (!peace) peaceWays.set(z, (peace = new Map()));
    const hit = peace.get(key);
    if (hit) {
      seaSeen.set(hit.seen);
      seaFrom.set(hit.from);
      seaOrder.set(hit.order);
      return;
    }
  }
  seaSeen.fill(0, 0, z1);
  seaQueue.length = 0;
  for (const c of own) {
    for (const zone of byComp.get(c) ?? []) {
      if (seaSeen[zone] || shut(zone)) continue;
      seaSeen[zone] = 1;
      seaFrom[zone] = 0;
      seaOrder[zone] = seaQueue.length;
      seaQueue.push(zone);
    }
  }
  for (let head = 0; head < seaQueue.length; head++) {
    const at = seaQueue[head]!;
    for (const n of links[at]!) {
      if (seaSeen[n] || z.closed[n] === 1 || shut(n)) continue;
      const by = through.get(at * 0x10000 + n);
      if (by !== undefined && passageShut(world, by, b)) continue;
      seaSeen[n] = 1;
      seaFrom[n] = at;
      seaOrder[n] = seaQueue.length;
      seaQueue.push(n);
    }
  }
  peace?.set(key, { seen: seaSeen.slice(0, z1), from: seaFrom.slice(0, z1), order: seaOrder.slice(0, z1) });
}

/** A search of `seaWay` for a bloc at peace, by its zones (map-made: kept by the zones). */
interface PeaceWay {
  seen: Uint8Array;
  from: Int32Array;
  order: Int32Array;
}
const peaceWays = new WeakMap<SeaZones, Map<string, PeaceWay>>();

/**
 * The beach sources of every bloc (PLAN 7.70a, the head of the file), from what `reach` made the
 * ways from: the coast cells each bloc controls on a land where it owns and controls no city,
 * beside a zone its way from home reaches.
 */
const coastSlots = new WeakMap<Coast, { slotOf: Int32Array; at: Int32Array }>();
function beachesOf(world: World, parts: ReachParts): Map<number, number[]> {
  const { blocOfNation, cities, ports, own } = parts;
  const comp = navOf(world).grid.component;
  const controller = world.cells.controller;
  const z = seaOf(world);
  const coast = coastOf(world);
  const { table, n, slotOf } = cityLandTable(world, blocOfNation);
  // Each coast cell's land's slot among the cities' lands (-1: no city there), kept by the slots.
  let slots = coastSlots.get(coast);
  if (!slots || slots.slotOf !== slotOf) {
    const at = new Int32Array(coast.cells.length);
    for (let i = 0; i < at.length; i++) {
      const land = comp[coast.cells[i]!]!;
      at[i] = land < slotOf.length ? slotOf[land]! : -1;
    }
    coastSlots.set(coast, (slots = { slotOf, at }));
  }
  const slotAt = slots.at;
  // The blocs that can have a beach: with a city (a home) and a port.
  const can = new Uint8Array(blocOfNation.length);
  for (const b of cities.keys()) if (ports.has(b)) can[b] = 1;
  // The coast cells by bloc, by their index in the coast.
  const shore = new Map<number, number[]>();
  const cells = coast.cells;
  for (let i = 0; i < cells.length; i++) {
    const ctl = controller[cells[i]!]!;
    if (ctl === 0) continue;
    const b = blocOfNation[ctl]!;
    if (can[b] !== 1) continue;
    const slot = slotAt[i]!;
    if (slot >= 0 && table[b * n + slot] === 1) continue;
    let list = shore.get(b);
    if (!list) shore.set(b, (list = []));
    list.push(i);
  }
  const out = new Map<number, number[]>();
  const fighting = world.wars.nations();
  for (const b of [...shore.keys()].sort((p, q) => p - q)) {
    const byComp = ports.get(b)!;
    let seen = parts.seen.get(b);
    if (!seen) {
      seaWay(world, b, own.get(b)!, byComp, fighting);
      seen = seaSeen;
    }
    const fed: number[] = [];
    for (const i of shore.get(b)!) {
      for (let k = coast.at[i]!; k < coast.at[i + 1]!; k++) {
        const zone = coast.zones[k]!;
        if (seen[zone] === 1 && z.closed[zone] !== 1) {
          fed.push(coast.cells[i]!);
          break;
        }
      }
    }
    if (fed.length > 0) out.set(b, fed);
  }
  return out;
}

/** What the supply's refresh reads of the sea: `seaLinkedAll` and `seaBeaches`. */
export interface SeaFeeds {
  linked: Map<number, number[]>;
  beaches: Map<number, number[]>;
}

/** `SeaFeeds` of the world as it is. */
export function seaFeeds(world: World): SeaFeeds {
  const r = seaReach(world, true);
  return { linked: r.linked, beaches: r.beaches! };
}

/**
 * At a refresh hour: each bloc whose joined components (`seaLinked`) or beach sources
 * (`seaBeaches`, PLAN 7.70a) are not those it had at the last ask is marked to be refreshed whole
 * (`supplySeaBlocs`, ADR-272). What it had is kept in `World.seaLinks` (derived: a loaded world
 * refreshes in full). Returns what it asked, for the refresh of the same hour.
 */
export function markSeaLinks(world: World): SeaFeeds {
  const was = world.seaLinks;
  const now = new Map<number, string>();
  const all = seaFeeds(world);
  for (const [b, list] of all.linked) {
    const beach = all.beaches.get(b);
    const key = beach ? `${list.join(',')}|${beach.join(',')}` : list.join(',');
    now.set(b, key);
    if (was.get(b) !== key) world.supplySeaBlocs.add(b);
  }
  // A bloc that had cities and has none: its network goes with its sources.
  for (const b of was.keys()) if (!now.has(b)) world.supplySeaBlocs.add(b);
  world.seaLinks = now;
  return all;
}
