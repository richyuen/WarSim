/**
 * Supply over sea (PLAN 4.4c, SPEC §6.2): which of a bloc's lands its cities feed from.
 *
 * A bloc's home is every land component (`NavGrid.component`) that holds the capital of a living
 * member, and the one that holds the most of its cities (a capital's cell can be a patch of
 * land of its own by the coast: Rio de Janeiro's, Tallinn's). Another component is joined to it by sea when a port of the bloc there (one whose land
 * cell a member owns and controls, with water a ship reaches: `portSeaOf`, its zone not closed
 * by ice) is reached from a port of the bloc at home by a way from zone to zone (the zones that
 * touch, `SeaZones.adj`, and the map's passages) that enters no zone held by a nation at war
 * with the bloc (`seaHolder`, PLAN 4.4a) and starts from no such zone. A component where the
 * bloc has no port is not cut by sea: its trade is not followed. A city is a source of its
 * bloc's network only on a component that is home, joined or not cut (`seaLinked`).
 *
 * The supply's refresh reads it; whether it changed for a bloc is asked at each refresh hour
 * (`markSeaLinks`): a bloc whose joined components changed is refreshed whole, so a partial
 * refresh gives what a full one gives.
 */
import { cellOf } from '../data/terrain';
import { nearestCellWhere } from '../data/ownership';
import { PASSAGE_SNAP } from '../nav/lanes';
import type { SeaZones } from '../nav/seaZones';
import { navOf, portSeaOf, seaOf, type World } from '../world';
import { blocOf } from './supply';

/** The zones each zone leads to: those it touches and the other ends of its passages (cached by the zones). */
const linksCache = new WeakMap<SeaZones, number[][]>();
export function zoneLinks(world: World): number[][] {
  const z = seaOf(world);
  let links = linksCache.get(z);
  if (links) return links;
  links = z.adj.map((a) => a.slice());
  const { w, h } = world.cells;
  for (const p of world.seaPassages) {
    const end = (lonLat: readonly [number, number]): number => {
      const [x, y] = cellOf(lonLat[0], lonLat[1], w, h);
      const c = nearestCellWhere((k) => z.zoneOf[k] !== 0, x, y, w, h, PASSAGE_SNAP, world.settings.loopingMap);
      return c < 0 ? 0 : z.zoneOf[c]!;
    };
    const a = end(p.a);
    const b = end(p.b);
    if (a === 0 || b === 0 || a === b) continue;
    if (!links[a]!.includes(b)) links[a]!.push(b);
    if (!links[b]!.includes(a)) links[b]!.push(a);
  }
  for (const l of links) l.sort((p, q) => p - q);
  linksCache.set(z, links);
  return links;
}

/** The land components whose cities feed bloc `bloc`'s network (see the head of the file), sorted. */
export function seaLinked(world: World, bloc: number): number[] {
  return seaLinkedAll(world).get(bloc) ?? [];
}

/** `seaLinked` of every bloc with a city, in one pass over the nations, the ports and the cities. */
export function seaLinkedAll(world: World): Map<number, number[]> {
  return seaReach(world).linked;
}

/**
 * The ways of every bloc's convoys (PLAN 4.4d): per bloc, per land joined to home by sea that is
 * not home, the zones of the shortest way (in zones) from a home port's zone to a port of that
 * land, the home end first.
 */
export function convoyWays(world: World): Map<number, Map<number, number[]>> {
  return seaReach(world).ways;
}

function seaReach(world: World): { linked: Map<number, number[]>; ways: Map<number, Map<number, number[]>> } {
  const comp = navOf(world).grid.component;
  const { w, owner, controller } = world.cells;
  const nc = world.nations.cols;
  const blocOfNation = new Uint16Array(world.nations.highWater + 1);
  world.nations.forEach((n) => (blocOfNation[n] = blocOf(world, n)));
  const home = new Map<number, Set<number>>();
  world.nations.forEach((n) => {
    if (nc.living[n] !== 1) return;
    const c = comp[Math.floor(nc.capitalY[n]!) * w + Math.floor(nc.capitalX[n]!)]!;
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
  // The cities' components by bloc, with their counts.
  const cities = new Map<number, Map<number, number>>();
  const cc = world.cities.cols;
  world.cities.forEach((id) => {
    const cell = cc.cell[id]!;
    const ctl = controller[cell]!;
    const c = comp[cell]!;
    if (ctl === 0 || owner[cell] !== ctl || c === 0) return;
    const b = blocOfNation[ctl]!;
    let m = cities.get(b);
    if (!m) cities.set(b, (m = new Map()));
    m.set(c, (m.get(c) ?? 0) + 1);
  });
  const holder = world.seaControl?.holder;
  const links = zoneLinks(world);
  const seen = new Uint8Array(z.count + 1);
  const from = new Int32Array(z.count + 1);
  const order = new Int32Array(z.count + 1);
  const queue: number[] = [];
  const out = new Map<number, number[]>();
  const ways = new Map<number, Map<number, number[]>>();
  for (const b of [...cities.keys()].sort((p, q) => p - q)) {
    const m = cities.get(b)!;
    const own = new Set(home.get(b));
    let most = 0;
    for (const [c, n] of m) if (most === 0 || n > m.get(most)! || (n === m.get(most)! && c < most)) most = c;
    own.add(most);
    const byComp = ports.get(b);
    const list: number[] = [];
    const away = [...m.keys()].filter((c) => !own.has(c) && byComp?.has(c));
    if (away.length > 0) {
      // From the home ports' zones over zones no enemy of the bloc holds.
      const shut = (zone: number): boolean => {
        const h = holder?.[zone] ?? 0;
        return h !== 0 && world.wars.atWar(h, b);
      };
      seen.fill(0);
      queue.length = 0;
      for (const c of own) {
        for (const zone of byComp!.get(c) ?? []) {
          if (seen[zone] || shut(zone)) continue;
          seen[zone] = 1;
          from[zone] = 0;
          order[zone] = queue.length;
          queue.push(zone);
        }
      }
      for (let head = 0; head < queue.length; head++) {
        for (const n of links[queue[head]!]!) {
          if (seen[n] || z.closed[n] === 1 || shut(n)) continue;
          seen[n] = 1;
          from[n] = queue[head]!;
          order[n] = queue.length;
          queue.push(n);
        }
      }
      const byLand = new Map<number, number[]>();
      for (const c of away) {
        // The port's zone reached first: its way back to home.
        let end = 0;
        for (const zone of byComp!.get(c)!) if (seen[zone] === 1 && (end === 0 || order[zone]! < order[end]!)) end = zone;
        if (end === 0) continue;
        list.push(c);
        const way: number[] = [];
        for (let k = end; k !== 0; k = from[k]!) way.push(k);
        byLand.set(c, way.reverse());
      }
      ways.set(b, byLand);
    }
    for (const c of m.keys()) if (own.has(c) || !byComp?.has(c)) list.push(c);
    out.set(b, list.sort((p, q) => p - q));
  }
  return { linked: out, ways };
}

/**
 * At a refresh hour: each bloc whose joined components (`seaLinked`) are not those it had at the
 * last ask is marked to be refreshed whole (`supplyDirtyBlocs`). What it had is kept in
 * `World.seaLinks` (derived: a loaded world refreshes in full). Returns what it asked, for the
 * refresh of the same hour.
 */
export function markSeaLinks(world: World): Map<number, number[]> {
  const was = world.seaLinks;
  const now = new Map<number, string>();
  const all = seaLinkedAll(world);
  for (const [b, list] of all) {
    const key = list.join(',');
    now.set(b, key);
    if (was.get(b) !== key) world.supplyDirtyBlocs.add(b);
  }
  // A bloc that had cities and has none: its network goes with its sources.
  for (const b of was.keys()) if (!now.has(b)) world.supplyDirtyBlocs.add(b);
  world.seaLinks = now;
  return all;
}
