/**
 * The AI's invasions (PLAN 4.6b, SPEC §7): a nation at war with no front lands an army on an
 * enemy's coast.
 *
 * Daily at 00:00, each nation in a war (living, its AI on; staggered by `STAGGER` days as the
 * strategic AI) with no formation aboard plans one landing, in its wars in which it has no land
 * front today (no cell it holds beside a cell held by a nation of the war's other side: ADR-267
 * counted the long wars with a rare front, the British bloc against Ireland for 800 days in every
 * seed). The front is judged per war (PLAN 7.26c3a, ADR-511): before, a front in any of its wars
 * barred a landing in all (30–50 % of nation-days). One landing a day, on the enemies of all such
 * wars together; a nation with a front in another war lands only formations beyond
 * `DEPLOY_RANGE_CELLS` of each cell of its own front on their land (from five states, of 30 sent to a port, 24
 * stood within it, and all but one were marched elsewhere before they boarded):
 *
 * - its transports: the transport group of its own that stands (not under way, not in a sea
 *   battle) at a port it holds with the most room (`transportRoom`, the lower id on a tie);
 * - the target: the port held by one of those enemies nearest those transports (`seaKm`)
 *   whose water's zone is not closed by ice nor held by a nation at war with it (a landing there
 *   would be thrown back, PLAN 4.5b), in the waters the transports sail (`waterKeys`: not a lake
 *   across land, not behind a passage shut to n; PLAN 7.56b, ADR-597: seed 1129 year 20, Britain's
 *   at Adana aimed at Baku on the Caspian, `orderSail` refused the way, and the army at the port
 *   never boarded): the landing takes a port, a cell with water by it;
 * - its formations at that port (land formations within `AT_PORT_CELLS` of its land cell or of its
 *   water, as `tryLanding` takes them; not under way, in no fight, not retreating or going home)
 *   are ordered there by `orderLanding`, one by one, until the transports have no room for the
 *   next (PLAN 7.49f, ADR-593: by its water alone, an army sent to a port whose water is 4–11 cells
 *   off its land cell, as Glasgow's or Hamburg's, stood there and was never loaded);
 * - with none there, its free land formations on the port's land, nearest the port first, are
 *   sent to it (`orderMove`) until their men fill the room (`sendToPort`: one refused on the port's
 *   land is passed over, PLAN 7.54; the send ends at one on another land, PLAN 7.7, or at the
 *   SEND_SEARCHES-th refusal that was a search of the map); they go aboard on a later day;
 * - with the nearest of them unable to march there (the transports in an exclave, neutral ground
 *   between), the transports sail instead for a port of the nation that it, or one of the next
 *   nearest, can march to (`sailToArmy`, PLAN 7.54b), and nobody is sent that day.
 *
 * Not here: an escort or a fleet sent to hold the landing's sea (PLAN 4.6c), a landing in a war
 * in which the nation has a front.
 */
import { isDayStart } from '../../shared/calendar';
import { neighbours4, type MobilityId, type Passage } from '../nav/grid';
import { frontierOf } from '../systems/territory';
import { orderLanding, transportRoom } from '../systems/amphibious';
import { findRoute, mayReach } from '../nav/provinceGraph';
import { orderMove, passageOf, snapTarget } from '../systems/movement';
import { AT_PORT_CELLS, keyAt, seaKm, waterKeys } from '../systems/navalCombat';
import { portShut } from '../systems/bombing';
import { orderSail } from '../systems/sail';
import { seaHolder } from '../systems/seaControl';
import { navOf, portSeaOf, seaOf, seaRangeOf, type World } from '../world';
import { DEPLOY_RANGE_CELLS } from './operational';
import { STAGGER } from './strategic';

const near = (world: World, a: number, b: number, r: number): boolean => {
  const w = world.cells.w;
  let dx = Math.abs((a % w) - (b % w));
  if (world.settings.loopingMap && dx > w / 2) dx = w - dx;
  return dx <= r && Math.abs(Math.floor(a / w) - Math.floor(b / w)) <= r;
};

export function invasionAi(world: World): void {
  if (!world.settings.aiEnabled || !isDayStart(world.tick) || world.wars.list.length === 0 || !world.rules) return;
  const nc = world.nations.cols;
  const day = world.tick / 24;
  const actors = [...world.wars.nations()].filter((n) => nc.living[n] === 1 && nc.aiOff[n] !== 1 && (day + n) % STAGGER === 0).sort((a, b) => a - b);
  if (actors.length === 0) return;
  // The enemies each actor has a land front with today, and the nations with a formation aboard.
  const { w, h, controller } = world.cells;
  const acting = new Set(actors);
  const faced = new Map<number, Set<number>>();
  const frontCells = new Map<number, number[]>();
  const nb: number[] = [];
  for (const c of frontierOf(world)) {
    const a = controller[c]!;
    if (!acting.has(a)) continue;
    let onFront = false;
    for (const q of neighbours4(c, w, h, world.settings.loopingMap, nb)) {
      const b = controller[q]!;
      if (b !== 0 && b !== a && world.wars.atWar(a, b)) {
        let s = faced.get(a);
        if (!s) faced.set(a, (s = new Set()));
        s.add(b);
        onFront = true;
      }
    }
    if (onFront) (frontCells.get(a) ?? frontCells.set(a, []).get(a)!).push(c);
  }
  // An actor at war with no front cell of its own: the ferry's front is its allies' cells beside the
  // enemies it fights with them (`wars.together`; PLAN 7.64, ADR-617).
  const allyFront = new Map<number, number[]>();
  const bare = actors.filter((n) => !frontCells.has(n));
  if (bare.length > 0) {
    for (const c of frontierOf(world)) {
      const a = controller[c]!;
      if (a === 0) continue;
      for (const n of bare) {
        if (!world.wars.sameSide(n, a)) continue;
        if (!neighbours4(c, w, h, world.settings.loopingMap, nb).some((q) => controller[q] !== 0 && world.wars.together(n, a, controller[q]!))) continue;
        (allyFront.get(n) ?? allyFront.set(n, []).get(n)!).push(c);
      }
    }
  }
  const aboard = new Set<number>();
  for (const id of world.embarked.keys()) aboard.add(world.formations.cols.nation[id]!);
  for (const n of actors) {
    if (aboard.has(n)) continue;
    // The enemies of its wars in which it has no front (PLAN 7.26c3a).
    const mine = faced.get(n);
    const foes = new Set<number>();
    for (const war of world.wars.list) {
      const i = war.sides[0].includes(n) ? 0 : war.sides[1].includes(n) ? 1 : -1;
      if (i < 0) continue;
      const other = war.sides[1 - i]!;
      if (mine && other.some((e) => mine.has(e))) continue;
      for (const e of other) if (e !== n) foes.add(e);
    }
    const front = frontCells.get(n) ?? [];
    if (foes.size > 0 && planLanding(world, n, foes, front)) continue;
    const ferried = front.length > 0 ? front : (allyFront.get(n) ?? []);
    if (ferried.length > 0) planFerry(world, n, ferried);
  }
}

/** The transport group of nation `n` standing at a port it holds with the most room (the lower id on a tie): fleet, room, port index; null for none. */
function transportsAtPort(world: World, n: number): { fleet: number; room: number; port: number } | null {
  const f = world.formations;
  const c = f.cols;
  const w = world.cells.w;
  const water = portSeaOf(world);
  const ctl = world.cells.controller;
  let fleet = 0;
  let room = 0;
  let port = -1;
  f.forEach((id) => {
    if (!world.isFleet(id) || c.nation[id] !== n || c.moving[id] === 1 || c.engaged[id] === 1 || seaRangeOf(world, id) !== undefined) return;
    const r = transportRoom(world, id);
    if (r <= room) return;
    const at = Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!);
    const i = world.ports.findIndex((p, k) => water[k]! >= 0 && ctl[p.cell] === n && near(world, at, water[k]!, world.atSize(AT_PORT_CELLS)));
    if (i < 0) return;
    [fleet, room, port] = [id, r, i];
  });
  return fleet === 0 ? null : { fleet, room, port };
}

/**
 * Whether `n`'s landing acted: false with no transports at a port of its own, no enemy port to sail
 * for (the ferry may take the turn then, PLAN 7.49d1), or nobody to ship from where they stand
 * (PLAN 7.64, ADR-617: no army at the port nor on its land; before, the turn was taken all the same,
 * on 970 of the 1,521 days of the nations fronted through an ally alone on the critic's 48 saves).
 */
function planLanding(world: World, n: number, foes: ReadonlySet<number>, front: readonly number[]): boolean {
  const c = world.formations.cols;
  const w = world.cells.w;
  const water = portSeaOf(world);
  const ctl = world.cells.controller;
  const cellOf = (id: number): number => Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!);
  // Its transports at a port it holds: the most room.
  const tp = transportsAtPort(world, n);
  if (!tp) return false;
  const { fleet } = tp;
  // The enemy's port nearest them whose sea is open to n, in the waters they sail (PLAN 7.56b).
  const z = seaOf(world);
  const keys = waterKeys(world, n);
  const mine = keyAt(world, keys, c.x[fleet]!, c.y[fleet]!);
  let target = -1;
  let best = Infinity;
  world.ports.forEach((p, i) => {
    const holder = ctl[p.cell]!;
    const at = water[i]!;
    if (holder === 0 || at < 0 || !foes.has(holder)) return;
    const zone = z.zoneOf[at]!;
    if (zone === 0 || z.closed[zone] === 1 || keys[zone] !== mine) return;
    const sea = seaHolder(world, zone);
    if (sea !== 0 && world.wars.atWar(sea, n)) return;
    const d = seaKm(world, c.x[fleet]!, c.y[fleet]!, (at % w) + 0.5, Math.floor(at / w) + 0.5);
    if (d < best) [best, target] = [d, i];
  });
  if (target < 0) return false;
  // A nation with a front in another war lands with its far army only (PLAN 7.26c3a): those within
  // the deploy range of its own front, on that front's land, are the operational AI's, which
  // marched them back.
  const r = world.atSize(DEPLOY_RANGE_CELLS);
  const range2 = r * r;
  const onLand = navOf(world).grid.component;
  const nearFront = (id: number): boolean => {
    const mine = onLand[cellOf(id)];
    for (const k of front) {
      if (onLand[k] !== mine) continue;
      let dx = Math.abs(c.x[id]! - ((k % w) + 0.5));
      if (world.settings.loopingMap && dx > w / 2) dx = w - dx;
      const dy = c.y[id]! - (Math.floor(k / w) + 0.5);
      if (dx * dx + dy * dy <= range2) return true;
    }
    return false;
  };
  const free = (id: number): boolean => standing(world, id, n) && (front.length === 0 || !nearFront(id));
  return board(world, tp.fleet, tp.room, tp.port, world.ports[target]!.cell, free);
}

/** Whether land formation `id` of nation `n` is free to be shipped: on land, standing, in no fight, not retreating or going home. */
function standing(world: World, id: number, n: number): boolean {
  const c = world.formations.cols;
  return !world.offLand(id) && c.nation[id] === n && c.moving[id] !== 1 && c.engaged[id] !== 1 && c.retreat[id] === 0 && c.home[id] === 0;
}

/**
 * The ferry (PLAN 7.49d1, ADR-612): nation `n`, at war with a land front (`front`, its cells on
 * it), ships its army standing on a landmass with none of those cells to its own port on a front's
 * land. Before, no rule did: the invasion AI landed only in a war with no front, and the
 * operational AI orders only the formations within DEPLOY_RANGE_CELLS of a front on its land
 * (critic run 11, seed 7019 year 10: Britain's 117 divisions at home while its war with Japan was
 * fought in Asia; of the land formations at war, 21–30 % stood so on the critic's 48 saves).
 *
 * - its transports: as a landing's (`transportsAtPort`);
 * - standing at a port on a front's land, or on a land with none of its island army, they sail for
 *   a port of its on that army's land (`sailToArmy`, its formations nearest the transports first);
 * - else the target: of its ports on a front's land (its water in a zone open, not shut by bombs,
 *   in the waters the transports sail, not held by a nation at war with it), the nearest a front
 *   cell of its own on that land (straight cells), the nearest the transports by sea (`seaKm`) on
 *   a tie (PLAN 7.63, ADR-616; before, the nearest by sea, which might be far from the front:
 *   critic run 11, seed 7019 year 10, Britain's at Wilhelmshaven and Constanța, 524–626 cells from
 *   its front in Asia; of the 133 formations landed in 60 days of the 48 saves, 50 beyond
 *   DEPLOY_RANGE_CELLS of their front); its island formations at their port go aboard for it, or the
 *   nearest on the port's land are sent there (`board`, as a landing's);
 * - with no such port of its own, an ally's (PLAN 7.49d2, ADR-613): of the ports of nations fighting
 *   beside it (`sameSide`) that pass the same tests, the nearest a front cell of its own on that land
 *   (straight cells), the nearest by sea on a tie. Before, a nation with no port of its own on its
 *   front's land shipped nobody (critic run 11, seed 5309 year 20: the Soviet Union's 158 island
 *   formations; 217 such at year 20 on the critic's saves). It lands there as at its own: `land`
 *   takes a cell from an enemy alone, and a nation fighting beside it is no foreign ground.
 *
 * - a nation with no front cell of its own (its land front its allies' alone) takes as its front
 *   their cells beside the enemies it fights with them (`wars.together`; PLAN 7.64, ADR-617).
 *   Before, it was never ferried (critic run 11: 793 island formations of such nations on day 1 of
 *   the 48 saves, Latvia's 40 on 5309 year 20).
 *
 * In the landing's turn and lock: a nation's actor day, with none of its formations aboard, and a
 * landing in a war with no front planned first (the ferry takes the turn when it gave no order).
 * Whether it acted.
 */
function planFerry(world: World, n: number, front: readonly number[]): boolean {
  const f = world.formations;
  const c = f.cols;
  const w = world.cells.w;
  const water = portSeaOf(world);
  const ctl = world.cells.controller;
  const comp = navOf(world).grid.component;
  const cellOf = (id: number): number => Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!);
  const lands = new Set<number>();
  for (const k of front) lands.add(comp[k]!);
  const free = (id: number): boolean => {
    if (!standing(world, id, n)) return false;
    const l = comp[cellOf(id)]!;
    return l !== 0 && !lands.has(l);
  };
  const island: number[] = [];
  f.forEach((id) => {
    if (!world.isFleet(id) && !world.isWing(id) && free(id)) island.push(id);
  });
  if (island.length === 0) return false;
  const tp = transportsAtPort(world, n);
  if (!tp) return false;
  const { fleet, port } = tp;
  const from = world.ports[port]!.cell;
  // Away from the army (in the theatre, or on another island): they go to it, the nearest first.
  if (!island.some((id) => comp[cellOf(id)] === comp[from])) {
    const by = island.map((id): [number, number] => {
      const k = cellOf(id);
      let dx = Math.abs((k % w) - (from % w));
      if (world.settings.loopingMap && dx > w / 2) dx = w - dx;
      return [dx + Math.abs(Math.floor(k / w) - Math.floor(from / w)), id];
    });
    by.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return sailToArmy(world, fleet, port, by.slice(0, SAIL_TRIES).map(([, id]) => id), passageOf(world, n));
  }
  // Its port on a front's land nearest them by sea.
  const z = seaOf(world);
  const keys = waterKeys(world, n);
  const mine = keyAt(world, keys, c.x[fleet]!, c.y[fleet]!);
  /** Whether port `i`, on a front's land, takes the ferry: open, unbombed, its sea in their waters and not an enemy's. */
  const open = (i: number): boolean => {
    const at = water[i]!;
    if (at < 0 || !lands.has(comp[world.ports[i]!.cell]!) || portShut(world, i)) return false;
    const zone = z.zoneOf[at]!;
    if (zone === 0 || z.closed[zone] === 1 || keys[zone] !== mine) return false;
    const sea = seaHolder(world, zone);
    return sea === 0 || !world.wars.atWar(sea, n);
  };
  const km = (i: number): number => seaKm(world, c.x[fleet]!, c.y[fleet]!, (water[i]! % w) + 0.5, Math.floor(water[i]! / w) + 0.5);
  /** The squared straight cells from port `i` to the nearest front cell of n's on its land (PLAN 7.63). */
  const toFront = (i: number): number => {
    const at = world.ports[i]!.cell;
    const l = comp[at]!;
    let d2 = Infinity;
    for (const k of front) {
      if (comp[k] !== l) continue;
      let dx = Math.abs((k % w) - (at % w));
      if (world.settings.loopingMap && dx > w / 2) dx = w - dx;
      const dy = Math.floor(k / w) - Math.floor(at / w);
      d2 = Math.min(d2, dx * dx + dy * dy);
    }
    return d2;
  };
  // Of the ports that pass `whose`, the nearest a front cell of n's on that land (straight cells),
  // the sea's way the tie-break: its own first (PLAN 7.63), else an ally's (PLAN 7.49d2).
  const pick = (whose: (h: number) => boolean): number => {
    let target = -1;
    let near2 = Infinity;
    let best = Infinity;
    world.ports.forEach((p, i) => {
      if (!whose(ctl[p.cell]!) || !open(i)) return;
      const d2 = toFront(i);
      if (d2 > near2) return;
      const d = km(i);
      if (d2 < near2 || d < best) [near2, best, target] = [d2, d, i];
    });
    return target;
  };
  let target = pick((h) => h === n);
  if (target < 0) target = pick((h) => h !== 0 && h !== n && world.wars.sameSide(n, h));
  if (target < 0) return false;
  return board(world, fleet, tp.room, port, world.ports[target]!.cell, free);
}

/**
 * Transport group `fleet` (room `room`, at port `port`) takes its nation's formations (`free`) to
 * cell `goal`: those at the port (within `AT_PORT_CELLS` of its land cell or of its water, as
 * `tryLanding` takes them) are ordered there one by one until the room is full; with none there,
 * the nearest on the port's land are sent to it (`sendToPort`), or, with the nearest unable to
 * march there, the transports sail to them (`sailToArmy`). See the head of the file. Whether any
 * order was given (PLAN 7.64).
 */
function board(world: World, fleet: number, room: number, port: number, goal: number, free: (id: number) => boolean): boolean {
  const f = world.formations;
  const c = f.cols;
  const w = world.cells.w;
  const water = portSeaOf(world);
  const n = c.nation[fleet]!;
  const cellOf = (id: number): number => Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!);
  const [tx, ty] = world.cellPoint(goal);
  // Its formations at the port go aboard.
  let sent = 0;
  const atPort: number[] = [];
  f.forEach((id) => {
    if (free(id) && (near(world, cellOf(id), world.ports[port]!.cell, world.atSize(AT_PORT_CELLS)) || near(world, cellOf(id), water[port]!, world.atSize(AT_PORT_CELLS)))) atPort.push(id);
  });
  for (const id of atPort) {
    if (!orderLanding(world, id, tx, ty)) break;
    sent++;
  }
  if (sent > 0 || atPort.length > 0) return sent > 0;
  // None there: the nearest free ones on the port's land are sent to it, to fill the room.
  const home = world.ports[port]!.cell;
  const comp = navOf(world).grid.component;
  const land = comp[home]!;
  const by: [number, number][] = [];
  f.forEach((id) => {
    if (!free(id) || comp[cellOf(id)] !== land) return;
    const k = cellOf(id);
    let dx = Math.abs((k % w) - (home % w));
    if (world.settings.loopingMap && dx > w / 2) dx = w - dx;
    by.push([dx + Math.abs(Math.floor(k / w) - Math.floor(home / w)), id]);
  });
  by.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (by.length === 0) return false;
  const [px, py] = world.cellPoint(home);
  // The transports go to the army (PLAN 7.54b): the nearest's march to their port refused.
  const pass = passageOf(world, n);
  if (!marches(world, by[0]![1], home, pass)) return sailToArmy(world, fleet, port, by.slice(0, SAIL_TRIES).map(([, id]) => id), pass);
  return sendToPort(world, by.map(([, id]) => id), px, py, room, pass) > 0;
}

/** How many formations, and of the ports nearest each, a sail to the army tries (PLAN 7.54b). */
export const SAIL_TRIES = 4;

/** Whether land formation `id` may march to `cell` under `pass` (as `orderMove` routes it; a route asked again is the passage's). */
function marches(world: World, id: number, cell: number, pass: Passage): boolean {
  const c = world.formations.cols;
  const w = world.cells.w;
  const nav = navOf(world);
  const at = Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!);
  const goal = snapTarget(world, at, cell % w, Math.floor(cell / w));
  const rule = world.rules?.templates[c.template[id]!];
  return goal >= 0 && rule !== undefined && findRoute(nav.grid, nav.graph, rule.mobility as MobilityId, at, goal, pass) !== null;
}

/**
 * Transport group `fleet`, at port `from`, sails for a port of its nation on the land of the
 * formations `ids` (the nearest first): for each in turn, of the SAIL_TRIES ports nearest it (cells,
 * the lower index on a tie), the first it may march to with a way by sea (PLAN 7.54b, ADR-595).
 * After a landing the transports sail for their nation's nearest port (`sailHome`), which may be an
 * exclave (seed 4513 year 10: Germany's at Kotor, 7247 and 8693: Annaba, neutral ground all round):
 * its army could not walk there, and nobody was sent, every week. Whether it sailed.
 */
function sailToArmy(world: World, fleet: number, from: number, ids: readonly number[], pass: Passage): boolean {
  const c = world.formations.cols;
  const w = world.cells.w;
  const ctl = world.cells.controller;
  const water = portSeaOf(world);
  const comp = navOf(world).grid.component;
  for (const id of ids) {
    const n = c.nation[id]!;
    const at = Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!);
    const ports: [number, number][] = [];
    world.ports.forEach((p, k) => {
      if (k === from || water[k]! < 0 || ctl[p.cell] !== n || comp[p.cell] !== comp[at]) return;
      let dx = Math.abs((p.cell % w) - (at % w));
      if (world.settings.loopingMap && dx > w / 2) dx = w - dx;
      ports.push([dx + Math.abs(Math.floor(p.cell / w) - Math.floor(at / w)), k]);
    });
    ports.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    for (const [, k] of ports.slice(0, SAIL_TRIES)) {
      if (!marches(world, id, world.ports[k]!.cell, pass)) continue;
      const sea = water[k]!;
      if (orderSail(world, fleet, (sea % w) + 0.5, Math.floor(sea / w) + 0.5)) return true;
    }
  }
  return false;
}

/**
 * A send passes over at most this many refused marches that were searches (PLAN 7.54, ADR-594):
 * each such refusal is a search of the map (up to about 10 ms, PLAN 7.7), so the send costs at
 * most a few of them.
 */
export const SEND_SEARCHES = 3;

/**
 * Orders formations `ids`, the nearest first, of one nation, to (px, py), a port's point, until
 * their men fill `room` (`passage`: the nation's, if the caller has it). The men ordered.
 *
 * - One whose land is not the port's ends it (PLAN 7.7, critic R7-B2): no way by land reaches the
 *   port from there. Seed 3371's Italy tried its 109 formations each week from year 27, each a
 *   failed search of about 10 ms: calls of 0.7 to 1.1 s, 86 % of the tick.
 * - One refused on the port's land is passed over (PLAN 7.54, ADR-594): a refusal says its own
 *   ground is cut off from the port (a neutral nation between), not the army's. Before, the first
 *   refusal ended the send, and with the nearest cut off nobody was sent, every week (seed 1129
 *   year 20: Britain's nearest three in Turkey's way to Warri, the fourth's march open). The
 *   others at a cell already refused are passed over with no order; the send ends at the
 *   SEND_SEARCHES-th refusal that was a search (not judged at once by `mayReach`: the start's
 *   ground and the port's in two groups of the passage, a refusal of microseconds).
 */
export function sendToPort(world: World, ids: readonly number[], px: number, py: number, room: number, passage?: Passage): number {
  const c = world.formations.cols;
  const nav = navOf(world);
  const w = world.cells.w;
  const tx = Math.floor(px);
  const ty = Math.floor(py);
  const pass = passage ?? (ids.length > 0 ? passageOf(world, c.nation[ids[0]!]!) : undefined);
  const refusedAt = new Set<number>();
  let searched = 0;
  let men = 0;
  for (const id of ids) {
    if (men + c.strength[id]! > room) break;
    const at = Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!);
    if (refusedAt.has(at)) continue;
    if (orderMove(world, id, px, py, pass)) {
      men += c.strength[id]!;
      continue;
    }
    if (nav.grid.component[at] !== nav.grid.component[ty * w + tx]) break;
    refusedAt.add(at);
    const goal = snapTarget(world, at, tx, ty);
    if (goal >= 0 && mayReach(nav.grid, nav.graph, at, goal, pass) && ++searched >= SEND_SEARCHES) break;
  }
  return men;
}
