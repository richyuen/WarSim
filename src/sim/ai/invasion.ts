/**
 * The AI's invasions (PLAN 4.6b, SPEC §7): a nation at war with no front lands an army on an
 * enemy's coast.
 *
 * Daily at 00:00, each nation in a war (living, its AI on; staggered by `STAGGER` days as the
 * strategic AI) with no landing at sea (a formation of its aboard for a cell held by a nation it is
 * at war with; PLAN 7.89, ADR-643: before, any formation aboard, a ferry's too) plans one landing,
 * in its wars in which it has no land
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
 *   never boarded): the landing takes a port, a cell with water by it; or, nearer by sea, the
 *   capital (`capitalCell`) of one of those enemies held by one of them on a coast (a cell beside
 *   it of a zone that passes the same tests; PLAN 7.69, ADR-621: a capital on a land with no port
 *   of its nation was never invaded, the Netherlands' on a one-cell islet, land 529, in 6 of the
 *   critic's 48 saves); a port wins a tie;
 * - its formations at that port (land formations within `AT_PORT_CELLS` of its land cell or of its
 *   water, as `tryLanding` takes them; not under way, in no fight, not retreating or going home)
 *   are ordered there by `orderLanding`, one by one, onto those transports (under way once the
 *   first is aboard; PLAN 7.72, ADR-625), until they have no room for the next (PLAN 7.49f, ADR-593: by its water alone, an army sent to a port whose water is 4–11 cells
 *   off its land cell, as Glasgow's or Hamburg's, stood there and was never loaded);
 * - with none there, its free land formations on the port's land, nearest the port first, are
 *   sent to it (`orderMove`) until their men fill the room (`sendToPort`: one refused on the port's
 *   land is passed over, PLAN 7.54; the send ends at one on another land, PLAN 7.7, or at the
 *   SEND_SEARCHES-th refusal that was a search of the map); they go aboard on a later day;
 * - with the nearest of them unable to march there (the transports in an exclave, neutral ground
 *   between), the transports sail instead for a port of the nation that it, or one of the next
 *   nearest, can march to (`sailToArmy`, PLAN 7.54b), and nobody is sent that day.
 *
 * A landing in a war in which the nation has a front, behind or beside it, is a new front's
 * (`planNormandy`, PLAN 7.70b, ADR-623), taken when no landing above gave an order and its front is
 * held; the ferry (`planFerry`) takes the turn after.
 *
 * Not here: an escort or a fleet sent to hold the landing's sea (PLAN 4.6c).
 */
import { isDayStart } from '../../shared/calendar';
import { neighbours4, type MobilityId, type Passage } from '../nav/grid';
import { frontierOf } from '../systems/territory';
import { marchingToPort, orderLanding, transportRoom } from '../systems/amphibious';
import { CORRIDOR_REFUSAL, findRoute, mayReach } from '../nav/provinceGraph';
import { marchHoursLeft, orderMove, passageOf, snapTarget } from '../systems/movement';
import { AT_PORT_CELLS, keyAt, seaKm, waterKeys } from '../systems/navalCombat';
import { portShut } from '../systems/bombing';
import { capitalCell } from '../systems/capitals';
import { orderSail } from '../systems/sail';
import { seaHolder } from '../systems/seaControl';
import { beachReach } from '../systems/seaSupply';
import { navOf, portSeaOf, seaOf, seaRangeOf, type World } from '../world';
import { DEPLOY_RANGE_CELLS, groundReader, reachOnLand, reachesOnLand } from './operational';
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
    // By holder, the bare actors on its side (PLAN 7.83b: asked once a holder, not once a cell).
    const sided = new Map<number, number[]>();
    for (const c of frontierOf(world)) {
      const a = controller[c]!;
      if (a === 0) continue;
      let mates = sided.get(a);
      if (!mates) sided.set(a, (mates = bare.filter((n) => world.wars.sameSide(n, a))));
      if (mates.length === 0) continue;
      const next = neighbours4(c, w, h, world.settings.loopingMap, nb);
      for (const n of mates) {
        if (!next.some((q) => controller[q] !== 0 && world.wars.together(n, a, controller[q]!))) continue;
        (allyFront.get(n) ?? allyFront.set(n, []).get(n)!).push(c);
      }
    }
  }
  // The nations with a landing at sea: a formation aboard for a cell held by a nation it is at war
  // with. They plan no other landing nor Normandy until it is ashore (PLAN 4.6b's lock); the ferry
  // is not held by it (PLAN 7.89, ADR-643): a group that gave an order is under way, so the next
  // turn's groups are others. Before, any formation aboard held the nation's whole turn: on critic
  // run 12's 1129 year 10, 2 US divisions aboard for 22 days skipped three ferry turns while 49 and
  // 60 stood on two cells.
  const landing = new Set<number>();
  for (const [id, e] of world.embarked) {
    const n = world.formations.cols.nation[id]!;
    const at = controller[e.target]!;
    if (at !== 0 && at !== n && world.wars.atWar(n, at)) landing.add(n);
  }
  for (const n of actors) {
    // The enemies of its wars in which it has no front (PLAN 7.26c3a).
    const mine = faced.get(n);
    const front = frontCells.get(n) ?? [];
    const ferried = front.length > 0 ? front : (allyFront.get(n) ?? []);
    let groups: ReturnType<AtPorts> | undefined;
    const atPorts: AtPorts = () => (groups ??= transportGroupsAtPort(world, n));
    if (landing.has(n)) {
      FERRY_PROBE.skip?.(n, 'aboard');
      LANDING_PROBE.turn?.(n, 'aboard');
      if (ferried.length > 0) planFerry(world, n, ferried, atPorts);
      continue;
    }
    const foes = new Set<number>();
    for (const war of world.wars.list) {
      const i = war.sides[0].includes(n) ? 0 : war.sides[1].includes(n) ? 1 : -1;
      if (i < 0) continue;
      const other = war.sides[1 - i]!;
      if (mine && other.some((e) => mine.has(e))) continue;
      for (const e of other) if (e !== n) foes.add(e);
    }
    if (foes.size > 0 && planLanding(world, n, foes, front, atPorts)) {
      FERRY_PROBE.skip?.(n, 'landing');
      continue;
    }
    // A new front (PLAN 7.70b, ADR-623): with its own front held, its free army lands behind the
    // enemy's; with it not held, the ferry takes its army there first.
    const held = front.length > 0 && mine !== undefined && frontHeld(world, n, front);
    if (front.length > 0 && mine && !held) LANDING_PROBE.turn?.(n, 'frontNotHeld');
    if (held && planNormandy(world, n, mine!, front, atPorts)) {
      FERRY_PROBE.skip?.(n, 'normandy');
      LANDING_PROBE.turn?.(n, 'normandy');
      continue;
    }
    LANDING_PROBE.turn?.(n, 'ferry');
    if (ferried.length > 0) planFerry(world, n, ferried, atPorts);
    else FERRY_PROBE.skip?.(n, 'noFront');
  }
}

/**
 * One landing or Normandy a nation planned (`LANDING_PROBE`, PLAN 7.82b): the enemies it looked at,
 * the cell picked (-1 for none), how the plan ended, and for each watched nation among the enemies
 * how its best place fared (`watched`: its nearest port's km, or its best city's score, against the
 * pick's; else the tests its places failed, by count).
 */
export type LandingPlan = {
  nation: number;
  kind: 'landing' | 'normandy';
  foes: number[];
  target: number;
  why: 'noTransports' | 'noFeed' | 'noEnemies' | 'noTarget' | 'noArmy' | 'order';
  best?: number;
  watched?: Record<number, { best: number; failed: Record<string, number> }> | undefined;
};
/**
 * Diagnostics only (`tools/diag/overseasHold.ts`): each landing and Normandy planned past its
 * transports' test, the branch each invasion turn took, and the nations whose places are traced.
 */
export const LANDING_PROBE: {
  plan?: (p: LandingPlan) => void;
  turn?: (n: number, branch: 'aboard' | 'frontNotHeld' | 'normandy' | 'ferry') => void;
  watch?: ReadonlySet<number>;
} = {};
type Watched = NonNullable<LandingPlan['watched']>;
const watchFail = (seen: Watched | undefined, holder: number, why: string): void => {
  if (!seen || !LANDING_PROBE.watch!.has(holder)) return;
  const e = (seen[holder] ??= { best: Number.NaN, failed: {} });
  e.failed[why] = (e.failed[why] ?? 0) + 1;
};
const watchBest = (seen: Watched | undefined, holder: number, v: number, better: (a: number, b: number) => boolean): void => {
  if (!seen || !LANDING_PROBE.watch!.has(holder)) return;
  const e = (seen[holder] ??= { best: Number.NaN, failed: {} });
  if (Number.isNaN(e.best) || better(v, e.best)) e.best = v;
};

/** A Normandy's target is looked for this many cells about an enemy's coastal city for the enemy's land formations (PLAN 7.70b). */
export const NORMANDY_NEAR_CELLS = 10;
/** A Normandy's worth of an enemy's capital against one of its other cities (PLAN 7.70b). */
export const NORMANDY_CAPITAL_WORTH = 3;
/** A Normandy's group goes aboard with at least this share of its transports' room, or all its free army on their port's land (PLAN 7.70b). */
export const NORMANDY_GROUP_SHARE = 0.75;
/** A Normandy's group waits for a march to its port that is there within this many days: the nation's next invasion turn (PLAN 7.73b). */
export const NORMANDY_WAIT_DAYS = STAGGER;
/** How far, in cells, from a city the water its landing goes ashore by is looked for (as `tryLanding`'s reach; PLAN 7.70b). */
const NORMANDY_SHORE_CELLS = 2;

/**
 * Whether nation `n`'s front (`front`, its cells on it) is held (PLAN 7.70b, ADR-623): its land
 * formations' men about the front at least those of the nations at war with it there. "About": in
 * a square of DEPLOY_RANGE_CELLS' side (this map's) that holds a front cell, or one beside it, and
 * more than none (PLAN 7.73c, ADR-628: before, a front with nobody of either side near was held, and
 * the free army sailed overseas while the front stood empty). A front not held wants the army the
 * ferry brings (planFerry); a held one spares its free army for a landing behind the enemy's
 * (planNormandy).
 */
function frontHeld(world: World, n: number, front: readonly number[]): boolean {
  const c = world.formations.cols;
  const w = world.cells.w;
  const bs = Math.max(1, Math.ceil(world.atSize(DEPLOY_RANGE_CELLS)));
  const bw = Math.ceil(w / bs);
  const bh = Math.ceil(world.cells.h / bs);
  const near = new Set<number>();
  for (const k of front) {
    const bx = Math.floor((k % w) / bs);
    const by = Math.floor(Math.floor(k / w) / bs);
    for (let dy = -1; dy <= 1; dy++) {
      const y = by + dy;
      if (y < 0 || y >= bh) continue;
      for (let dx = -1; dx <= 1; dx++) {
        let x = bx + dx;
        if (x < 0 || x >= bw) {
          if (!world.settings.loopingMap) continue;
          x = (x + bw) % bw;
        }
        near.add(y * bw + x);
      }
    }
  }
  let own = 0;
  let theirs = 0;
  world.formations.forEach((id) => {
    if (world.isFleet(id) || world.isWing(id) || world.offLand(id)) return;
    const b = Math.floor(c.y[id]! / bs) * bw + Math.floor(c.x[id]! / bs);
    if (!near.has(b)) return;
    const m = c.nation[id]!;
    if (m === n) own += c.strength[id]!;
    else if (world.wars.atWar(n, m)) theirs += c.strength[id]!;
  });
  // Nobody of either side near: not held, so the ferry brings the army (PLAN 7.73c, ADR-628).
  return own > 0 && own >= theirs;
}

/**
 * Whether formation `id` stands within DEPLOY_RANGE_CELLS (this map's) of a cell of `front` on its
 * own land: the operational AI's, which orders those (PLAN 7.26c3a).
 */
function nearOwnFront(world: World, id: number, front: readonly number[]): boolean {
  const c = world.formations.cols;
  const w = world.cells.w;
  const r = world.atSize(DEPLOY_RANGE_CELLS);
  const onLand = navOf(world).grid.component;
  const mine = onLand[Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!)];
  for (const k of front) {
    if (onLand[k] !== mine) continue;
    let dx = Math.abs(c.x[id]! - ((k % w) + 0.5));
    if (world.settings.loopingMap && dx > w / 2) dx = w - dx;
    const dy = c.y[id]! - (Math.floor(k / w) + 0.5);
    if (dx * dx + dy * dy <= r * r) return true;
  }
  return false;
}

/**
 * A new front (PLAN 7.70b, ADR-623): nation `n`, at war with a land front (`front`, its cells on
 * it; `faced`, the enemies it touches there) that it holds (`frontHeld`), lands its free army on an
 * enemy's coast more than DEPLOY_RANGE_CELLS from that front. Before, the AI landed only in a war
 * in which it had no land front (`planLanding`), and the ferry took its army to its own front
 * (`planFerry`): no landing opened a front beside or behind one (critic run 11, emergent 6 and naval 7).
 *
 * - its transports: as a landing's (`transportsAtPort`);
 * - its free army: its land formations standing (not under way, in no fight, not retreating or
 *   going home), not within DEPLOY_RANGE_CELLS of a cell of its front on their land;
 * - the target: of the cities held by a nation at war with it that fights it in a war in which it
 *   has a front (`faced`'s wars), each with a water cell within NORMANDY_SHORE_CELLS whose zone is
 *   not iced, is in the waters the transports sail, is held by no nation at war with it, and is
 *   reached by its bloc's way from home (`beachReach`: a beachhead there is fed from the beach,
 *   PLAN 7.70a; on any land since PLAN 7.75, ADR-630, the user's decision; until then only on one
 *   where its bloc owned and controlled no city), more than DEPLOY_RANGE_CELLS (straight) from every cell of
 *   its front: the most worth (NORMANDY_CAPITAL_WORTH for an enemy's capital, 1 for another city,
 *   times DEPLOY_RANGE_CELLS over its straight distance to the nearest cell of its front: near the
 *   enemy's front's rear, PLAN 7.73a, ADR-626; before, of two cities alike the nearest by sea won
 *   however far from the war, and the armies landed where nobody fought) over one more than the
 *   enemy's land formations within NORMANDY_NEAR_CELLS, the nearest by sea on a tie, then the lower
 *   cell;
 * - a group (`board` with `group`): its free formations at the transports' port go aboard once
 *   their men fill NORMANDY_GROUP_SHARE of the room, or no more of its free army there is left to
 *   come; before that, the nearest on the port's land are sent to it, and none goes aboard while
 *   one of its nation marches to the port. The escort is the naval AI's, as for any landing.
 *
 * In the landing's turn and lock (the head of the file); the ferry takes the turn when it gave no
 * order. Whether it acted.
 */
function planNormandy(world: World, n: number, faced: ReadonlySet<number>, front: readonly number[], atPorts: AtPorts): boolean {
  const c = world.formations.cols;
  const { w, h } = world.cells;
  const ctl = world.cells.controller;
  const tp = transportsAtPort(atPorts);
  if (!tp) {
    LANDING_PROBE.plan?.({ nation: n, kind: 'normandy', foes: [...faced], target: -1, why: 'noTransports' });
    return false;
  }
  const feed = beachReach(world, n);
  if (!feed) {
    LANDING_PROBE.plan?.({ nation: n, kind: 'normandy', foes: [...faced], target: -1, why: 'noFeed' });
    return false;
  }
  // The enemies of its wars with a front.
  const enemies = new Set<number>();
  for (const war of world.wars.list) {
    const i = war.sides[0].includes(n) ? 0 : war.sides[1].includes(n) ? 1 : -1;
    if (i < 0) continue;
    const other = war.sides[1 - i]!;
    if (!other.some((e) => faced.has(e))) continue;
    for (const e of other) if (e !== n && world.nations.cols.living[e] === 1) enemies.add(e);
  }
  if (enemies.size === 0) {
    LANDING_PROBE.plan?.({ nation: n, kind: 'normandy', foes: [...faced], target: -1, why: 'noEnemies' });
    return false;
  }
  const comp = navOf(world).grid.component;
  const z = seaOf(world);
  const keys = waterKeys(world, n);
  const fx = c.x[tp.fleet]!;
  const fy = c.y[tp.fleet]!;
  const mine = keyAt(world, keys, fx, fy);
  // Why a zone takes no beach ('' when it does).
  const zoneWhy = (zone: number): string => {
    if (zone === 0) return 'land';
    if (z.closed[zone] === 1) return 'ice';
    if (keys[zone] !== mine) return 'otherWater';
    if (feed.seen[zone] !== 1) return 'notFed';
    const sea = seaHolder(world, zone);
    return sea === 0 || !world.wars.atWar(sea, n) ? '' : 'seaHeld';
  };
  const zoneOk = (zone: number): boolean => zoneWhy(zone) === '';
  const seen: Watched | undefined = LANDING_PROBE.watch && LANDING_PROBE.plan ? {} : undefined;
  const r = world.atSize(DEPLOY_RANGE_CELLS);
  const toFront2 = nearestSq(world, front);
  // The enemy's land formations, by squares of NORMANDY_NEAR_CELLS.
  const bs = Math.max(1, Math.ceil(world.atSize(NORMANDY_NEAR_CELLS)));
  const bw = Math.ceil(w / bs);
  const bh = Math.ceil(h / bs);
  const count = new Map<number, number>();
  world.formations.forEach((id) => {
    if (world.isFleet(id) || world.isWing(id) || world.offLand(id) || !enemies.has(c.nation[id]!)) return;
    const b = Math.floor(c.y[id]! / bs) * bw + Math.floor(c.x[id]! / bs);
    count.set(b, (count.get(b) ?? 0) + 1);
  });
  const enemiesNear = (cell: number): number => {
    const bx = Math.floor((cell % w) / bs);
    const by = Math.floor(Math.floor(cell / w) / bs);
    let k = 0;
    for (let dy = -1; dy <= 1; dy++) {
      const y = by + dy;
      if (y < 0 || y >= bh) continue;
      for (let dx = -1; dx <= 1; dx++) {
        let x = bx + dx;
        if (x < 0 || x >= bw) {
          if (!world.settings.loopingMap) continue;
          x = (x + bw) % bw;
        }
        k += count.get(y * bw + x) ?? 0;
      }
    }
    return k;
  };
  const shore = Math.max(1, Math.round(world.atSize(NORMANDY_SHORE_CELLS)));
  const cc = world.cities.cols;
  let target = -1;
  let score = 0;
  let km = Infinity;
  world.cities.forEach((city) => {
    const cell = cc.cell[city]!;
    const holder = ctl[cell]!;
    if (!enemies.has(holder)) return;
    const land = comp[cell]!;
    if (land === 0) return watchFail(seen, holder, 'noLand');
    // The water it goes ashore by: the nearest open one within the shore's reach (looked for before
    // the front's distance, the dearer test: most enemy cities lie inland; PLAN 7.83b).
    let sea = -1;
    let d2 = Infinity;
    const x0 = cell % w;
    const y0 = Math.floor(cell / w);
    for (let dy = -shore; dy <= shore; dy++) {
      const y = y0 + dy;
      if (y < 0 || y >= h) continue;
      for (let dx = -shore; dx <= shore; dx++) {
        let x = x0 + dx;
        if (x < 0 || x >= w) {
          if (!world.settings.loopingMap) continue;
          x = (x + w) % w;
        }
        const q = y * w + x;
        if (dx * dx + dy * dy >= d2 || !zoneOk(z.zoneOf[q]!)) continue;
        [sea, d2] = [q, dx * dx + dy * dy];
      }
    }
    if (sea < 0) {
      if (seen && LANDING_PROBE.watch!.has(holder)) {
        // The first test the nearest water within the shore's reach failed.
        let why = 'noWater';
        let dBest = Infinity;
        for (let dy = -shore; dy <= shore; dy++) {
          for (let dx = -shore; dx <= shore; dx++) {
            const y = y0 + dy;
            const x = (x0 + dx + w) % w;
            if (y < 0 || y >= h || dx * dx + dy * dy >= dBest) continue;
            const reason = zoneWhy(z.zoneOf[y * w + x]!);
            if (reason === 'land') continue;
            [why, dBest] = [reason, dx * dx + dy * dy];
          }
        }
        watchFail(seen, holder, why);
      }
      return;
    }
    const d2Front = toFront2(cell);
    if (d2Front <= r * r) return watchFail(seen, holder, 'nearFront');
    // Near the enemy's front's rear (PLAN 7.73a): the worth falls as the city lies farther from n's
    // front, DEPLOY_RANGE_CELLS over its straight distance (under 1, as it is beyond that range).
    const worth = ((cc.capitalOf[city] === holder ? NORMANDY_CAPITAL_WORTH : 1) * r) / Math.sqrt(d2Front);
    const s = worth / (1 + enemiesNear(cell));
    watchBest(seen, holder, s, (a, b) => a > b);
    if (s < score) return;
    const d = seaKm(world, fx, fy, (sea % w) + 0.5, Math.floor(sea / w) + 0.5);
    if (s > score || d < km || (d === km && cell < target)) [target, score, km] = [cell, s, d];
  });
  if (target < 0) {
    LANDING_PROBE.plan?.({ nation: n, kind: 'normandy', foes: [...enemies], target: -1, why: 'noTarget', watched: seen });
    return false;
  }
  const free = (id: number): boolean => standing(world, id, n) && !nearOwnFront(world, id, front);
  const acted = board(world, tp.fleet, tp.room, tp.port, target, free, true);
  LANDING_PROBE.plan?.({ nation: n, kind: 'normandy', foes: [...enemies], target, why: acted ? 'order' : 'noArmy', best: score, watched: seen });
  return acted;
}

/**
 * The squared straight cells from a cell to the nearest of `cells` (the map's loop taken), as a
 * function: the cells by row, looked through outward from the cell's row until the rows alone are
 * farther than the nearest found (PLAN 7.83b: before, every cell was measured, for every city of a
 * Normandy's scan). Infinity for none.
 */
function nearestSq(world: World, cells: readonly number[]): (cell: number) => number {
  const w = world.cells.w;
  const loop = world.settings.loopingMap;
  const ys = new Int32Array(cells.length);
  const xs = new Int32Array(cells.length);
  const order = Array.from(cells, (_, i) => i).sort((a, b) => Math.floor(cells[a]! / w) - Math.floor(cells[b]! / w));
  order.forEach((i, j) => {
    ys[j] = Math.floor(cells[i]! / w);
    xs[j] = cells[i]! % w;
  });
  const n = cells.length;
  return (cell: number): number => {
    const x = cell % w;
    const y = Math.floor(cell / w);
    // The first index whose row is at least y.
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ys[mid]! < y) lo = mid + 1;
      else hi = mid;
    }
    let d2 = Infinity;
    const at = (j: number): void => {
      let dx = Math.abs(xs[j]! - x);
      if (loop && dx > w / 2) dx = w - dx;
      const dy = ys[j]! - y;
      const d = dx * dx + dy * dy;
      if (d < d2) d2 = d;
    };
    for (let j = lo; j < n; j++) {
      const dy = ys[j]! - y;
      if (dy * dy >= d2) break;
      at(j);
    }
    for (let j = lo - 1; j >= 0; j--) {
      const dy = y - ys[j]!;
      if (dy * dy >= d2) break;
      at(j);
    }
    return d2;
  };
}

/**
 * The transport groups of nation `n` standing at a port it holds (as `transportsAtPort` takes
 * them): fleet, room, port index; the most room first, the lower id on a tie.
 */
function transportGroupsAtPort(world: World, n: number): { fleet: number; room: number; port: number }[] {
  const c = world.formations.cols;
  const w = world.cells.w;
  const water = portSeaOf(world);
  const ctl = world.cells.controller;
  const out: { fleet: number; room: number; port: number }[] = [];
  world.formations.forEach((id) => {
    if (c.nation[id] !== n || !world.isFleet(id) || c.moving[id] === 1 || c.engaged[id] === 1 || seaRangeOf(world, id) !== undefined) return;
    const room = transportRoom(world, id);
    if (room <= 0) return;
    const at = Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!);
    const port = world.ports.findIndex((p, k) => water[k]! >= 0 && ctl[p.cell] === n && near(world, at, water[k]!, world.atSize(AT_PORT_CELLS)));
    if (port >= 0) out.push({ fleet: id, room, port });
  });
  return out.sort((a, b) => b.room - a.room || a.fleet - b.fleet);
}

/**
 * The transport group of a nation standing at a port it holds with the most room (the lower id on
 * a tie): fleet, room, port index; null for none. The first of `transportGroupsAtPort`'s, which the
 * actor's turn asks once (`AtPorts`; PLAN 7.83b: before, its landing and its Normandy each scanned
 * the formations for it).
 */
function transportsAtPort(atPorts: AtPorts): { fleet: number; room: number; port: number } | null {
  return atPorts()[0] ?? null;
}

/** An actor's transport groups at its ports (`transportGroupsAtPort`), asked once a turn: the landing, Normandy and ferry of one actor give no order between them but the last. */
type AtPorts = () => readonly { fleet: number; room: number; port: number }[];

/**
 * Whether `n`'s landing acted: false with no transports at a port of its own, no enemy port nor
 * coastal capital to sail for (the ferry may take the turn then, PLAN 7.49d1), or nobody to ship from where they stand
 * (PLAN 7.64, ADR-617: no army at the port nor on its land; before, the turn was taken all the same,
 * on 970 of the 1,521 days of the nations fronted through an ally alone on the critic's 48 saves).
 */
function planLanding(world: World, n: number, foes: ReadonlySet<number>, front: readonly number[], atPorts: AtPorts): boolean {
  const c = world.formations.cols;
  const w = world.cells.w;
  const water = portSeaOf(world);
  const ctl = world.cells.controller;
  // Its transports at a port it holds: the most room.
  const tp = transportsAtPort(atPorts);
  if (!tp) {
    LANDING_PROBE.plan?.({ nation: n, kind: 'landing', foes: [...foes], target: -1, why: 'noTransports' });
    return false;
  }
  const { fleet } = tp;
  // The enemy's port nearest them whose sea is open to n, in the waters they sail (PLAN 7.56b), or
  // an enemy capital on a coast of such a sea (PLAN 7.69).
  const z = seaOf(world);
  const keys = waterKeys(world, n);
  const mine = keyAt(world, keys, c.x[fleet]!, c.y[fleet]!);
  let target = -1;
  let best = Infinity;
  const seen: Watched | undefined = LANDING_PROBE.watch && LANDING_PROBE.plan ? {} : undefined;
  // The km to the water at a cell, or why a landing does not sail there.
  const reach = (at: number): number | string => {
    const zone = z.zoneOf[at]!;
    if (zone === 0) return 'land';
    if (z.closed[zone] === 1) return 'ice';
    if (keys[zone] !== mine) return 'otherWater';
    const sea = seaHolder(world, zone);
    if (sea !== 0 && world.wars.atWar(sea, n)) return 'seaHeld';
    return seaKm(world, c.x[fleet]!, c.y[fleet]!, (at % w) + 0.5, Math.floor(at / w) + 0.5);
  };
  const open = (at: number): number => {
    const d = reach(at);
    return typeof d === 'number' ? d : Infinity;
  };
  world.ports.forEach((p, i) => {
    const holder = ctl[p.cell]!;
    const at = water[i]!;
    if (holder === 0 || !foes.has(holder)) return;
    if (at < 0) return watchFail(seen, holder, 'noWater');
    const d = reach(at);
    if (typeof d === 'string') watchFail(seen, holder, d);
    else watchBest(seen, holder, d, (a, b) => a < b);
    if (typeof d === 'number' && d < best) [best, target] = [d, p.cell];
  });
  const nb: number[] = [];
  for (const e of [...foes].sort((a, b) => a - b)) {
    if (world.nations.cols.living[e] !== 1) continue;
    const cap = capitalCell(world, e);
    if (cap < 0 || cap >= ctl.length || !foes.has(ctl[cap]!)) continue;
    for (const q of neighbours4(cap, w, world.cells.h, world.settings.loopingMap, nb)) {
      const d = open(q);
      if (d < best) [best, target] = [d, cap];
    }
  }
  if (target < 0) {
    LANDING_PROBE.plan?.({ nation: n, kind: 'landing', foes: [...foes], target: -1, why: 'noTarget', watched: seen });
    return false;
  }
  // A nation with a front in another war lands with its far army only (PLAN 7.26c3a): those within
  // the deploy range of its own front, on that front's land, are the operational AI's, which
  // marched them back.
  const free = (id: number): boolean => standing(world, id, n) && (front.length === 0 || !nearOwnFront(world, id, front));
  const acted = board(world, tp.fleet, tp.room, tp.port, target, free);
  LANDING_PROBE.plan?.({ nation: n, kind: 'landing', foes: [...foes], target, why: acted ? 'order' : 'noArmy', best, watched: seen });
  return acted;
}

/** Whether land formation `id` of nation `n` is free to be shipped: on land, standing, in no fight, not retreating or going home. */
function standing(world: World, id: number, n: number): boolean {
  const c = world.formations.cols;
  return !world.offLand(id) && c.nation[id] === n && c.moving[id] !== 1 && c.engaged[id] !== 1 && c.retreat[id] === 0 && c.home[id] === 0;
}

/**
 * Whether a formation of nation `n` at a cell reaches a front cell on its land (PLAN 7.79c,
 * ADR-636): a cell of `front` (its own, or its allies' for a nation with none, `invasionAi`), else
 * a cell of its side's beside an enemy of n's (those whose sectors the operational AI allots it
 * to), by `reachesOnLand`. Asked once per class of cells (landmass, group of provinces with open
 * ground, and ground; the operational AI's classes) and kept for the call; the side's cells are
 * looked for once, when a class reaches none of `front`. The economic AI's `wantsFerry` reads it
 * too (PLAN 7.90e, ADR-648).
 */
export function frontReach(world: World, n: number, front: readonly number[], pass: Passage): (cell: number) => boolean {
  const nav = navOf(world);
  const comp = nav.grid.component;
  const nodeOf = nav.graph.nodeOf;
  const groundAt = groundReader(world, pass);
  let side: number[] | undefined;
  const byLand = (cells: readonly number[]): Map<number, number[]> => {
    const m = new Map<number, number[]>();
    for (const k of cells) (m.get(comp[k]!) ?? m.set(comp[k]!, []).get(comp[k]!)!).push(k);
    return m;
  };
  const own = byLand(front);
  let sideOn: Map<number, number[]> | undefined;
  const known = new Map<string, boolean>();
  return (cell: number): boolean => {
    const l = comp[cell]!;
    if (l === 0) return false;
    const node = nodeOf[cell]!;
    const g = node !== 0 && pass.ok[pass.holder[cell]!] === 1 ? pass.group![node]! : -1;
    const key = `${l}:${g}:${g < 0 ? 0 : groundAt(cell)}`;
    const was = known.get(key);
    if (was !== undefined) return was;
    // Every cell is asked without a walk of the passage's cells first (`reachOnLand`), and those
    // only a walk would tell after, when none answered (PLAN 7.83b): the same answer.
    const any = (cells: readonly number[] | undefined): boolean => {
      let walk = false;
      for (const k of cells ?? []) {
        const r = reachOnLand(world, pass, groundAt, cell, k, false);
        if (r === 1) return true;
        if (r < 0) walk = true;
      }
      return walk && (cells ?? []).some((k) => reachesOnLand(world, pass, groundAt, cell, k));
    };
    let r = any(own.get(l));
    if (!r) {
      if (!side) {
        side = [];
        const { w, h, controller } = world.cells;
        const nb: number[] = [];
        for (const c of frontierOf(world)) {
          const a = controller[c]!;
          if (a === 0 || (a !== n && !world.wars.sameSide(n, a))) continue;
          if (neighbours4(c, w, h, world.settings.loopingMap, nb).some((q) => controller[q] !== 0 && world.wars.atWar(n, controller[q]!))) side.push(c);
        }
        sideOn = byLand(side);
      }
      r = any(sideOn!.get(l));
    }
    known.set(key, r);
    return r;
  };
}

/**
 * The ferry (PLAN 7.49d1, ADR-612): nation `n`, at war with a land front (`front`, its cells on
 * it), ships its army standing on a landmass with none of those cells to its own port on a front's
 * land. Before, no rule did: the invasion AI landed only in a war with no front, and the
 * operational AI orders only the formations within DEPLOY_RANGE_CELLS of a front on its land
 * (critic run 11, seed 7019 year 10: Britain's 117 divisions at home while its war with Japan was
 * fought in Asia; of the land formations at war, 21–30 % stood so on the critic's 48 saves).
 *
 * - its transports: its groups standing at its ports (`transportGroupsAtPort`), those on the land
 *   of an army they would carry first, then the most room, the lower id, each taking the turn in
 *   turn until the room of those that gave an order covers the army's men, or the refusals' route
 *   searches reach FERRY_SEARCHES, a refusal at a port taken by the groups after it there until an
 *   order (PLAN 7.90b, ADR-645; PLAN 7.88b, ADR-642, ended it at SAIL_TRIES groups that gave none,
 *   always the same; PLAN 7.88a, ADR-638, tried them until one gave an order; before
 *   that, the most room's alone, as a landing's, and on critic run 12's saves that one could never act);
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
 * In the landing's turn: a nation's actor day, a landing in a war with no front planned first (the
 * ferry takes the turn when it gave no order). Not in the landing's lock (PLAN 7.89, ADR-643): with
 * a landing of its at sea, the ferry still takes the turn; a group already under way is not
 * standing, so it is not tried again. Whether it acted.
 */
function planFerry(world: World, n: number, front: readonly number[], atPortsOf: AtPorts): boolean {
  const f = world.formations;
  const c = f.cols;
  const w = world.cells.w;
  const water = portSeaOf(world);
  const ctl = world.cells.controller;
  const comp = navOf(world).grid.component;
  const cellOf = (id: number): number => Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!);
  const lands = new Set<number>();
  for (const k of front) lands.add(comp[k]!);
  // On a front's land, the formations that reach none of its front cells there, nor of its side's
  // beside its enemies (the operational AI's sectors), are the ferry's too (PLAN 7.79c, ADR-636):
  // the operational AI allots a class only to the sectors it reaches, so they stood for good.
  // With no transports at a port the turn is over before the army is looked for (PLAN 7.83b).
  const atPorts = atPortsOf();
  if (atPorts.length === 0) return false;
  const pass = passageOf(world, n);
  const reach = frontReach(world, n, front, pass);
  const free = (id: number): boolean => {
    if (!standing(world, id, n)) return false;
    const k = cellOf(id);
    const l = comp[k]!;
    return l !== 0 && (!lands.has(l) || !reach(k));
  };
  const island: number[] = [];
  f.forEach((id) => {
    if (c.nation[id] === n && !world.isFleet(id) && !world.isWing(id) && free(id)) island.push(id);
  });
  if (island.length === 0) return false;
  // Its transport groups standing at its ports (PLAN 7.88a, ADR-638): those on the land of an army
  // they would carry first, then the most room, the lower id (each takes the turn, below). Before
  // PLAN 7.88a, the turn was the one with the most room's, and on critic run
  // 12's saves that one could never act (1129 year 10: at Nuuk, Greenland's army does not march to
  // it; 6421 year 20: at Port-of-Spain and Roseau, the sail to the army refused) while 11 and 33
  // more stood idle at the USA's ports: 0 orders in 4 turns on each.
  const armyLands = new Set(island.map((id) => comp[cellOf(id)]!));
  const onArmy = (g: { port: number }): number => (armyLands.has(comp[world.ports[g.port]!.cell]!) ? 0 : 1);
  const groups = atPorts.slice().sort((a, b) => onArmy(a) - onArmy(b) || b.room - a.room || a.fleet - b.fleet);
  const z = seaOf(world);
  const keys = waterKeys(world, n);
  // Every group with an army left to carry acts (PLAN 7.88b, the user's ADR-637 a): the turn goes
  // on until the room of the groups that gave an order covers the free army's men, or SAIL_TRIES
  // groups gave none (each refusal may cost searches of the map). A formation ordered is no longer
  // standing, so the next group takes others. Before, the first group that acted ended the turn:
  // one group (24,000 men) a week while 60 divisions stood on 1129 year 10.
  //
  // The turn's bound is the route searches its refusals made (PLAN 7.90b, ADR-645): it ends once they
  // reach FERRY_SEARCHES. A group at a port where one refused since the turn's last order takes that
  // refusal (`same`) with no search: the army it would carry and its port's ways are the same. Before,
  // the turn ended at SAIL_TRIES groups that gave no order, and the same ones refused first every
  // week (critic run 12, 1129 year 10: Nuuk's two, then Bathurst's or San Juan's; 6421 year 20: Freetown,
  // Dakar, Roseau, Port-of-Spain), most of them refusing with no search at all: of the groups at a port,
  // 6.5 of 11.4 and 26.3 of 30.6 were never tried in a turn, 30 at Norfolk among them.
  let men = 0;
  for (const id of island) men += c.strength[id]!;
  const tries: FerryTry[] = [];
  let acted = false;
  let searched = 0;
  const refusedAt = new Set<number>();
  // The free formations a sail found marching to none of their land's ports this turn (PLAN 7.90h,
  // ADR-652): the sails after it pass over them. Of the turn only, never kept.
  const cut = new Set<number>();
  for (const g of groups) {
    if (men <= 0 || searched >= FERRY_SEARCHES) break;
    const t: FerryTry = { fleet: g.fleet, port: g.port, room: g.room, way: 'board', acted: false, searches: 0 };
    tries.push(t);
    if (refusedAt.has(g.port)) {
      t.way = 'same';
      continue;
    }
    const was = CORRIDOR_REFUSAL.searches;
    const cutWas = cut.size;
    t.acted = ferryGroup(g.fleet, g.room, g.port, t);
    t.searches = CORRIDOR_REFUSAL.searches - was;
    if (t.acted) {
      acted = true;
      men -= g.room;
      refusedAt.clear();
    } else {
      // A sail that found formations cut off leaves its port open: the next group there sails
      // for the army past them (PLAN 7.90h).
      if (cut.size === cutWas) refusedAt.add(g.port);
      searched += t.searches;
    }
  }
  FERRY_PROBE.turn?.({ nation: n, free: island.length, island, groups: groups.length, tries });
  return acted;

  /** Transport group `fleet` (room `room`, at port `port`) takes the turn: whether it gave an order. */
  function ferryGroup(fleet: number, room: number, port: number, t: FerryTry): boolean {
    const from = world.ports[port]!.cell;
    // Away from the army (in the theatre, or on another island): they go to it, the nearest first.
    if (!island.some((id) => comp[cellOf(id)] === comp[from])) {
      t.way = 'sail';
      // Of the free army, those on a land with a port of n's to sail for (PLAN 7.90c, ADR-646):
      // `sailToArmy` takes no other. Before, the SAIL_TRIES nearest were tried whatever their land,
      // and from a far port they were garrisons on islands with none (critic run 12, 1129 year 10:
      // Bathurst's five groups, the four nearest on Caribbean islands with no US port, stood 52–62
      // days while ~150 free formations stood on the mainland with 73 ports).
      const ported = new Set<number>();
      world.ports.forEach((p, k) => {
        if (k !== port && water[k]! >= 0 && ctl[p.cell] === n) ported.add(comp[p.cell]!);
      });
      const by = island.filter((id) => ported.has(comp[cellOf(id)]!)).map((id): [number, number] => {
        const k = cellOf(id);
        let dx = Math.abs((k % w) - (from % w));
        if (world.settings.loopingMap && dx > w / 2) dx = w - dx;
        return [dx + Math.abs(Math.floor(k / w) - Math.floor(from / w)), id];
      });
      by.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      // The nearest that march to a port of their land, past those cut off from every one (PLAN
      // 7.90h, ADR-652), within the turn's searches left. Before, the SAIL_TRIES nearest whatever
      // their march, and on critic run 12, 6421 year 20 day 7387, four remnants on a US enclave in
      // Africa cut off from the USA's six ports there were searched again by the groups at five
      // ports, all refused, while division 16, a cell from Glasgow, was never tried.
      t.tried = [];
      return sailToArmy(world, fleet, port, by.map(([, id]) => id), pass, { cut, budget: FERRY_SEARCHES - searched, tried: t.tried });
    }
    // Its port on a front's land nearest them by sea.
    const mine = keyAt(world, keys, c.x[fleet]!, c.y[fleet]!);
    /**
     * Whether port `i`, on a front's land, takes the ferry: open, unbombed, its sea in their waters
     * and not an enemy's, and a front cell reached from it (PLAN 7.79c: who lands where none is
     * reached stands there for good).
     */
    const open = (i: number): boolean => {
      const at = water[i]!;
      if (at < 0 || !lands.has(comp[world.ports[i]!.cell]!) || portShut(world, i)) return false;
      const zone = z.zoneOf[at]!;
      if (zone === 0 || z.closed[zone] === 1 || keys[zone] !== mine) return false;
      const sea = seaHolder(world, zone);
      return (sea === 0 || !world.wars.atWar(sea, n)) && reach(world.ports[i]!.cell);
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
    // the sea's way the tie-break: its own first (PLAN 7.63), else an ally's (PLAN 7.49d2). The cell
    // to land at, or -1.
    // The ports are asked nearest the front first, the lower index on a tie, and none farther than
    // the nearest open one (PLAN 7.83b: `open` asks the front's reach, which may walk the passage's
    // cells; before, every port was asked in index order). The same pick: the least d2, then the
    // least km, then the lower index.
    const pick = (whose: (h: number) => boolean, near2 = Infinity, best = Infinity, target = -1): number => {
      const by: [number, number][] = [];
      world.ports.forEach((p, i) => {
        if (water[i]! < 0 || !lands.has(comp[p.cell]!) || !whose(ctl[p.cell]!)) return;
        const d2 = toFront(i);
        if (d2 <= near2) by.push([d2, i]);
      });
      by.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      for (const [d2, i] of by) {
        if (d2 > near2) break;
        if (!open(i)) continue;
        const d = km(i);
        if (d2 < near2 || d < best) [near2, best, target] = [d2, d, world.ports[i]!.cell];
      }
      return target;
    };
    // A beachhead with no port (PLAN 7.70c, ADR-624): on a front's land where no port of its own nor
    // of a nation fighting beside it passes `open`, a front cell of n's beside water whose zone passes
    // `open`'s tests stands as its port, on the front itself; the nearest the transports by sea.
    // Asked per land of its own front cells, to the first port that passes (PLAN 7.83b).
    const portedOn = new Map<number, boolean>();
    const ported = (l: number): boolean => {
      let r = portedOn.get(l);
      if (r === undefined) {
        r = world.ports.some((p, i) => {
          const hd = ctl[p.cell]!;
          return comp[p.cell] === l && (hd === n || (hd !== 0 && world.wars.sameSide(n, hd))) && open(i);
        });
        portedOn.set(l, r);
      }
      return r;
    };
    const { h } = world.cells;
    const nb: number[] = [];
    let beach = -1;
    let beachKm = Infinity;
    for (const k of front) {
      if (ctl[k] !== n) continue;
      for (const q of neighbours4(k, w, h, world.settings.loopingMap, nb)) {
        const zone = z.zoneOf[q]!;
        if (zone === 0 || z.closed[zone] === 1 || keys[zone] !== mine) continue;
        const sea = seaHolder(world, zone);
        if (sea !== 0 && world.wars.atWar(sea, n)) continue;
        // Its land's ports asked once a cell of it has such water (PLAN 7.83b).
        if (ported(comp[k]!)) break;
        const d = seaKm(world, c.x[fleet]!, c.y[fleet]!, (q % w) + 0.5, Math.floor(q / w) + 0.5);
        if (d < beachKm || (d === beachKm && k < beach)) [beach, beachKm] = [k, d];
      }
    }
    let target = beach >= 0 ? pick((hd) => hd === n, 0, beachKm, beach) : pick((hd) => hd === n);
    if (target < 0) target = pick((hd) => hd !== 0 && hd !== n && world.wars.sameSide(n, hd));
    if (target < 0) {
      t.way = 'noPort';
      return false;
    }
    return board(world, fleet, room, port, target, free, false, pass);
  }
}

/** One transport group a ferry turn tried (`FERRY_PROBE`): its way (`sail` to the army, `noPort` on a front's land, `board`, `same`: a refusal at its port since the turn's last order taken as its own, PLAN 7.90b) and whether it gave an order. */
export interface FerryTry {
  fleet: number;
  port: number;
  room: number;
  way: 'sail' | 'noPort' | 'board' | 'same';
  acted: boolean;
  /** The route searches it made (`CORRIDOR_REFUSAL.searches`; 0 for `same`, PLAN 7.90b). */
  searches: number;
  /** For a `sail`, the formations whose ports it tried (PLAN 7.90h; read only). */
  tried?: number[];
}
/** One ferry turn (`FERRY_PROBE`): the nation, its army free for the ferry, its groups standing at its ports, and those tried. */
export interface FerryTurn {
  nation: number;
  free: number;
  /** The free army's formations at the turn's start (PLAN 7.90a). */
  island: readonly number[];
  groups: number;
  tries: FerryTry[];
}
/** A read-only probe of the invasion AI's turns (PLAN 7.88a, `tools/diag/ferryTurns.ts`): `skip` for an actor whose turn did not reach the ferry (`aboard`: a landing at sea held its landing and Normandy, and the ferry's turn follows; PLAN 7.89), `turn` for each that did. */
export const FERRY_PROBE: { turn?: (t: FerryTurn) => void; skip?: (n: number, why: 'aboard' | 'landing' | 'normandy' | 'noFront') => void } = {};

/**
 * Transport group `fleet` (room `room`, at port `port`) takes its nation's formations (`free`) to
 * cell `goal`: those at the port (within `AT_PORT_CELLS` of its land cell or of its water, as
 * `tryLanding` takes them) are ordered there one by one until the room is full; with none there,
 * the nearest on the port's land are sent to it (`sendToPort`), or, with the nearest unable to
 * march there, the transports sail to them (`sailToArmy`). See the head of the file. Whether any
 * order was given (PLAN 7.64).
 */
function board(world: World, fleet: number, room: number, port: number, goal: number, free: (id: number) => boolean, group = false, passage?: Passage): boolean {
  const f = world.formations;
  const c = f.cols;
  const w = world.cells.w;
  const water = portSeaOf(world);
  const n = c.nation[fleet]!;
  const cellOf = (id: number): number => Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!);
  const [tx, ty] = world.cellPoint(goal);
  const home = world.ports[port]!.cell;
  const comp = navOf(world).grid.component;
  const land = comp[home]!;
  const atPort: number[] = [];
  f.forEach((id) => {
    if (free(id) && (near(world, cellOf(id), home, world.atSize(AT_PORT_CELLS)) || near(world, cellOf(id), water[port]!, world.atSize(AT_PORT_CELLS)))) atPort.push(id);
  });
  // Its formations at the port go aboard.
  const aboard = (ids: readonly number[]): boolean => {
    let sent = 0;
    for (const id of ids) {
      // On `fleet` though the first's order set it sailing (PLAN 7.72, ADR-625: before, the standing
      // test refused the rest, and every landing and ferry trip carried one formation), and on no
      // other group (PLAN 7.90g, ADR-649): the next group at the port takes the rest in its own try.
      if (orderLanding(world, id, tx, ty, fleet)) sent++;
      // A group passes over one with no room left for it, for a smaller one after it.
      else if (!group) break;
    }
    return sent > 0;
  };
  // A group (PLAN 7.70b): aboard once it fills NORMANDY_GROUP_SHARE of the room or no more is to
  // come; meanwhile none goes while one of its nation marches to the port and is there within
  // NORMANDY_WAIT_DAYS, and the rest of its free army on the port's land is sent to fill the room
  // left. A march that does not go on (in a fight, before the enemy's ground) or comes later is not
  // waited for (PLAN 7.73b, ADR-627): the group at the port goes aboard as it is, or with nobody
  // there the turn is the ferry's. Before, a march that stalled held the transports with no bound.
  let left = room;
  let boarding: readonly number[] = atPort;
  const there = new Set(group ? atPort : []);
  if (group) {
    let men = 0;
    for (const id of atPort) men += c.strength[id]!;
    if (men < NORMANDY_GROUP_SHARE * room) {
      let coming = false;
      let late = false;
      let others = false;
      const wait = NORMANDY_WAIT_DAYS * 24;
      f.forEach((id) => {
        if (c.nation[id] !== n || world.isFleet(id) || world.isWing(id)) return;
        if (marchingToPort(world, id, [home])) {
          if (marchHoursLeft(world, id) <= wait) coming = true;
          else late = true;
        } else if (!there.has(id) && free(id) && comp[cellOf(id)] === land) others = true;
      });
      if (coming) return true;
      if (late) return there.size > 0 && aboard(atPort);
      if (others) [boarding, left] = [[], room - men];
    }
  }
  if (boarding.length > 0) return aboard(boarding);
  // None there: the nearest free ones on the port's land are sent to it, to fill the room.
  const by: [number, number][] = [];
  f.forEach((id) => {
    if (!free(id) || comp[cellOf(id)] !== land || there.has(id)) return;
    const k = cellOf(id);
    let dx = Math.abs((k % w) - (home % w));
    if (world.settings.loopingMap && dx > w / 2) dx = w - dx;
    by.push([dx + Math.abs(Math.floor(k / w) - Math.floor(home / w)), id]);
  });
  by.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (by.length === 0) return false;
  const [px, py] = world.cellPoint(home);
  // The transports go to the army (PLAN 7.54b): the nearest's march to their port refused. A group
  // at the port whose rest cannot come goes aboard as it is.
  // The ferry's turn hands its passage on (PLAN 7.83b: one a turn, its pockets walked once).
  const pass = passage ?? passageOf(world, n);
  if (!marches(world, by[0]![1], home, pass)) return there.size > 0 ? aboard(atPort) : sailToArmy(world, fleet, port, by.slice(0, SAIL_TRIES).map(([, id]) => id), pass);
  return sendToPort(world, by.map(([, id]) => id), px, py, left, pass) > 0 || (there.size > 0 && aboard(atPort));
}

/** How many formations, and of the ports nearest each, a sail to the army tries (PLAN 7.54b). */
export const SAIL_TRIES = 4;

/**
 * The route searches (`CORRIDOR_REFUSAL.searches`) the refusals of a ferry turn may make before it
 * ends (PLAN 7.90b, ADR-645; it replaced ADR-642's SAIL_TRIES refusing groups). A refusal's worst is
 * a march refused and a sail to the army refused (1 + SAIL_TRIES × SAIL_TRIES searches, up to about
 * 10 ms each, PLAN 7.7), so the turn's refusals cost about what ADR-642's four groups' could. The
 * ferry's sail to the army scans past formations cut off from their ports (PLAN 7.90h, ADR-652) with
 * the turn's searches left as its bound, so one refusal may take them all (and up to SAIL_TRIES − 1
 * over: the bound is asked between formations).
 */
export const FERRY_SEARCHES = 4 * (1 + SAIL_TRIES * SAIL_TRIES);

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
function sailToArmy(world: World, fleet: number, from: number, ids: readonly number[], pass: Passage, scan?: SailScan): boolean {
  const c = world.formations.cols;
  const w = world.cells.w;
  const ctl = world.cells.controller;
  const water = portSeaOf(world);
  const comp = navOf(world).grid.component;
  const start = CORRIDOR_REFUSAL.searches;
  let open = 0;
  // The ports of the transports' nation (the formations') with water, by land (PLAN 7.83b: once a
  // call, not once a formation).
  const n = c.nation[fleet]!;
  const byLand = new Map<number, number[]>();
  world.ports.forEach((p, k) => {
    if (k === from || water[k]! < 0 || ctl[p.cell] !== n) return;
    const l = comp[p.cell]!;
    (byLand.get(l) ?? byLand.set(l, []).get(l)!).push(k);
  });
  for (const id of ids) {
    if (scan !== undefined && (open >= SAIL_TRIES || CORRIDOR_REFUSAL.searches - start >= scan.budget)) break;
    if (scan?.cut.has(id)) continue;
    scan?.tried.push(id);
    const at = Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!);
    const ports: [number, number][] = [];
    for (const k of byLand.get(comp[at]!) ?? []) {
      const p = world.ports[k]!;
      let dx = Math.abs((p.cell % w) - (at % w));
      if (world.settings.loopingMap && dx > w / 2) dx = w - dx;
      ports.push([dx + Math.abs(Math.floor(p.cell / w) - Math.floor(at / w)), k]);
    }
    ports.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let marched = false;
    for (const [, k] of ports.slice(0, SAIL_TRIES)) {
      if (!marches(world, id, world.ports[k]!.cell, pass)) continue;
      marched = true;
      const sea = water[k]!;
      if (orderSail(world, fleet, (sea % w) + 0.5, Math.floor(sea / w) + 0.5)) return true;
    }
    if (marched) open++;
    else scan?.cut.add(id);
  }
  return false;
}

/**
 * A ferry's sail to the army over its whole free army (PLAN 7.90h, ADR-652): the formations in
 * `cut` (found marching to none of their land's SAIL_TRIES nearest ports earlier in the turn) are
 * passed over and those found so are added; it ends at SAIL_TRIES formations whose march was open
 * (their ports' ways by sea refused) or once its route searches reach `budget`. `tried`: those it
 * asked, for `FERRY_PROBE`.
 */
interface SailScan {
  cut: Set<number>;
  budget: number;
  tried: number[];
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
