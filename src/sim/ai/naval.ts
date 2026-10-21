/**
 * The AI's fleets at sea (PLAN 4.6c, SPEC §7): a nation at war sails its warships to hold the
 * sea by its enemies' ports, and by its own landings; it seeks a battle where its ships are the
 * stronger and keeps out of one where they are not; at peace its fleets come home.
 *
 * Daily at 00:00, each nation (living, its AI on; staggered by `STAGGER` days as the strategic
 * AI). Its ports are those its bloc holds (a nation, its overlord and its puppets). Its warfleets are its fleets with power (`fleetPower`: the hit points of its live ships
 * with a gun or torpedoes, a submarine's none: submarines raid, PLAN 4.6d) that stand (not under
 * way, not in a sea battle).
 *
 * - At war: each of those at a port it holds (`AT_PORT_CELLS`) sails, within `SORTIE_KM` of
 *   it, to the water of a landing of its nation's under way (the escort); else to the water
 *   of the nearest port held by a nation at war with it, its zone not closed by ice, whose
 *   zone's enemy power (`navalPower`, the blocs at war with it) is no more than that of its
 *   nation's warfleets in port within `SORTIE_KM` of that water together (they choose alike,
 *   and go together): a battle it would lose is not sought. Or, nearer, to a standing enemy
 *   warfleet within `SORTIE_KM` in its basin, whose zone's enemy power passes the same test
 *   (PLAN 7.35d2c, ADR-550): fleets on station at a partner's port or a neutral's were no target.
 *   Every target, port or fleet, is of the fleet's basin (`basinAt`, PLAN 7.35d2d1, ADR-551): a
 *   port across land on a lake is not in reach, and `orderSail` would refuse its way. So too an away
 *   fleet's new order and a forward base's targets. Nor is one behind a passage shut to the fleet
 *   (`waterKeys`, PLAN 7.35d2d2, ADR-552: its bank an enemy's, PLAN 4.4e), as `orderSail` routes.
 * - At war, such a warfleet with no enemy port within `SORTIE_KM` at all stages (PLAN 7.35b2):
 *   it sails to the nearest port of its bloc's that has one (`forwardBases`; not empty water under
 *   the enemy's naval bombers, PLAN 7.35b4c2), in its basin (`stageTo`, PLAN 7.35b4c1), and
 *   sorties from there. The US Pacific Fleet at San Diego goes west against Japan.
 * - At war, a warfleet away from its ports in a zone where the enemy's power is over
 *   `AVOID_RATIO` times its own sails home (`sailHome`).
 * - At war, any other warfleet away from its ports gets a new order on its AI day (`awayOrder`,
 *   PLAN 7.35d2b): a winnable battle in reach first (a standing enemy warfleet too, PLAN 7.35d2c);
 *   else one beyond reach its navy of those waters can win (the chase, ADR-580); else it keeps its station by an enemy port
 *   (the blockade); else a new station at an enemy port in reach; else home. Before, it stood
 *   where its sortie ended until peace, at ports whose holders had made their peace.
 * - At war, under the enemy's naval bombers (PLAN 7.35b3b, ADR-544: a wing of the naval role at an
 *   airbase within its range of the water), a zone with no enemy ship holds nothing to fight: a
 *   warfleet away from its ports there sails home, unless it escorts a landing; and an enemy port
 *   whose water is such is no sortie's target (it still counts as in reach: the fleet stands, it
 *   does not stage). Fleets sat at an empty enemy port for weeks, struck until sunk
 *   (`docs/evidence/7.35/measure-b3.md`).
 * - At war, a transport group (no power, no submarine, transports) with no formation aboard, away
 *   from its bloc's ports, sails home (`sailHome`, PLAN 7.26h1): after a landing it stood at the
 *   landing's water until peace, and a nation's landings load only at a port of its own.
 * - At war, its submarine flotillas raid (`raid`, PLAN 4.6d): each that stands off an enemy
 *   bloc's convoy way sails for the zone of one nearest it within `RAID_KM`.
 * - At peace: a fleet away from its bloc's ports sails home (`sailHome`: its bloc's nearest port, a
 *   transport group's its nation's, PLAN 7.35b4b).
 * - A fleet the editor placed (`World.station`, PLAN 7.22c) holds its place, at peace and at war:
 *   none of the above moves it; away from it by more than `AT_PORT_CELLS` (a battle drew it off)
 *   it sails back. It fights where it is seen, as any fleet.
 */
import { isDayStart } from '../../shared/calendar';
import { transportRoom } from '../systems/amphibious';
import { elementIndex } from '../systems/elements';
import { convoyWays } from '../systems/seaSupply';
import { AT_PORT_CELLS, keyAt, sailHome, seaKm, waterKeys } from '../systems/navalCombat';
import { fleetPower, navalPower } from '../systems/seaControl';

export { fleetPower };
import { orderSail } from '../systems/sail';
import { blocOf } from '../systems/supply';
import { portSeaOf, seaOf, seaRangeOf, type World } from '../world';

// The waters a nation's ships sail between (PLAN 7.35d2d2) live with `basinAt`, read by `nearestOwnPort` too (PLAN 7.35d2d3a).
export { keyAt, waterKeys };
import { STAGGER } from './strategic';
import { roleOf } from './air';
import { basePlace, wingRange } from '../systems/air';

/** How far, in km, a warfleet sails from its port to an enemy's (a little over the Mediterranean's length from Malta to Gibraltar or to Haifa). */
export const SORTIE_KM = 2500;
/** How far, in km, a submarine flotilla sails from its port to raid (an ocean boat's patrol: Lorient to the Western Approaches and beyond). */
export const RAID_KM = 4000;
/** A warfleet away from its ports turns home where the enemy's power in its zone is over this many times its own. */
export const AVOID_RATIO = 1.5;


/** Whether fleet `id` has a formation aboard. */
function carries(world: World, id: number): boolean {
  for (const e of world.embarked.values()) if (e.fleet === id) return true;
  return false;
}

/** Whether fleet `id` has a live submarine. */
function hasBoats(world: World, id: number): boolean {
  const units = world.rules!.units;
  const ec = world.elements.cols;
  return (elementIndex(world).get(id) ?? []).some((e) => ec.strength[e]! > 0 && units[ec.unit[e]!]!.cls === 'ss');
}

/**
 * Submarines at war (PLAN 4.6d): each standing flotilla not in a zone on the way of a convoy
 * of a bloc at war with its nation (`convoyWays`, PLAN 4.4d) sails for the nearest such zone
 * within `RAID_KM`, to its seed cell. Convoys pass there; destroyers that screen them may too.
 * A way moves as the sea is won and lost (it keeps off the zones an enemy holds): a flotilla
 * whose zone is no longer on one goes on.
 */
function raid(world: World, n: number, boats: number[]): void {
  const z = seaOf(world);
  const w = world.cells.w;
  const c = world.formations.cols;
  const zones = new Set<number>();
  for (const [bloc, byLand] of convoyWays(world)) {
    if (!world.wars.atWar(bloc, n)) continue;
    for (const way of byLand.values()) for (const zone of way) if (z.closed[zone] !== 1 && z.seedCell[zone]! >= 0) zones.add(zone);
  }
  if (zones.size === 0) return;
  const sorted = [...zones].sort((a, b) => a - b);
  for (const id of boats) {
    // On a way already: it stays (a way moves as the sea is won and lost: then it goes on).
    if (zones.has(z.zoneOf[Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!)]!)) continue;
    let best = Infinity;
    let at = -1;
    for (const zone of sorted) {
      const cell = z.seedCell[zone]!;
      const d = seaKm(world, c.x[id]!, c.y[id]!, (cell % w) + 0.5, Math.floor(cell / w) + 0.5);
      if (d <= RAID_KM && d < best) [best, at] = [d, cell];
    }
    if (at >= 0) orderSail(world, id, (at % w) + 0.5, Math.floor(at / w) + 0.5);
  }
}

export function navalAi(world: World): void {
  if (!world.settings.aiEnabled || !isDayStart(world.tick) || !world.rules) return;
  const nc = world.nations.cols;
  const day = world.tick / 24;
  const f = world.formations;
  const c = f.cols;
  // The standing fleets by nation, of the nations that act today.
  const fleets = new Map<number, number[]>();
  f.forEach((id) => {
    if (!world.isFleet(id) || c.moving[id] === 1 || c.engaged[id] === 1 || seaRangeOf(world, id) !== undefined) return;
    const n = c.nation[id]!;
    if (nc.living[n] !== 1 || nc.aiOff[n] === 1 || (day + n) % STAGGER !== 0) return;
    const at = world.station.get(id);
    if (at) {
      // Placed by the editor: back to its place when a battle drew it off.
      if (Math.abs(c.x[id]! - at[0]) > world.atSize(AT_PORT_CELLS) || Math.abs(c.y[id]! - at[1]) > world.atSize(AT_PORT_CELLS)) orderSail(world, id, at[0], at[1]);
      return;
    }
    let list = fleets.get(n);
    if (!list) fleets.set(n, (list = []));
    list.push(id);
  });
  if (fleets.size === 0) return;
  const power = world.wars.list.length > 0 ? navalPower(world) : new Map<number, Map<number, number>>();
  let standing: Prey[] | undefined;
  const prey = (): Prey[] => (standing ??= standingWarfleets(world));
  for (const n of [...fleets.keys()].sort((a, b) => a - b)) plan(world, n, fleets.get(n)!, power, prey);
}

/** An enemy port as a target: its water's cell, its zone's enemy power, its waters' key (`waterKeys`, PLAN 7.35d2d; named for the basin it was). */
interface Target {
  at: number;
  enemy: number;
  basin: number;
}

/** An enemy warfleet as a target (PLAN 7.35d2c): its cell, its zone's enemy power, its waters' key (`waterKeys`). */
interface Hunt {
  at: number;
  enemy: number;
  basin: number;
}

/** A standing warfleet, as another nation's naval AI hunts it (PLAN 7.35d2c). */
interface Prey {
  /** Its cell, the hunter's target. */
  at: number;
  nation: number;
  zone: number;
}

/**
 * Every warfleet that stands (PLAN 7.35d2c, ADR-550): power over 0 (`fleetPower`; a submarine
 * flotilla has none and is not hunted), not under way, not in a sea battle, on an open zone; by id.
 * Any nation's, not only those whose AI acts today: they are the prey.
 */
export function standingWarfleets(world: World): Prey[] {
  const c = world.formations.cols;
  const w = world.cells.w;
  const z = seaOf(world);
  const out: Prey[] = [];
  world.formations.forEach((id) => {
    if (!world.isFleet(id) || c.moving[id] === 1 || c.engaged[id] === 1 || seaRangeOf(world, id) !== undefined) return;
    const at = Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!);
    const zone = z.zoneOf[at]!;
    if (zone === 0 || z.closed[zone] === 1 || fleetPower(world, id) <= 0) return;
    out.push({ at, nation: c.nation[id]!, zone });
  });
  return out;
}

function plan(world: World, n: number, mine: number[], power: Map<number, Map<number, number>>, prey: () => Prey[]): void {
  const c = world.formations.cols;
  const w = world.cells.w;
  const water = portSeaOf(world);
  const ctl = world.cells.controller;
  const z = seaOf(world);
  const cellOf = (id: number): number => Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!);
  const near = (a: number, b: number): boolean => {
    let dx = Math.abs((a % w) - (b % w));
    if (world.settings.loopingMap && dx > w / 2) dx = w - dx;
    return dx <= world.atSize(AT_PORT_CELLS) && Math.abs(Math.floor(a / w) - Math.floor(b / w)) <= world.atSize(AT_PORT_CELLS);
  };
  // A port of its bloc's is home: the Netherlands' East Indies squadrons stand at Surabaya, the
  // Dutch East Indies' (sent for Den Helder at peace, a way of 2 s to find, every week).
  const bloc = blocOf(world, n);
  const atOwnPort = (id: number): boolean => world.ports.some((p, i) => water[i]! >= 0 && ctl[p.cell] !== 0 && blocOf(world, ctl[p.cell]!) === bloc && near(cellOf(id), water[i]!));
  const atWar = world.wars.list.some((war) => war.sides[0].includes(n) || war.sides[1].includes(n));
  if (!atWar) {
    // At peace: home.
    for (const id of mine) if (!atOwnPort(id)) sailHome(world, id);
    return;
  }
  /** The power of the blocs at war with n in zone `zone`. */
  const enemyIn = (zone: number): number => {
    let e = 0;
    for (const [b, p] of power.get(zone) ?? []) if (b !== bloc && world.wars.atWar(b, n)) e += p;
    return e;
  };
  // The enemy's naval bombers on land (PLAN 7.35b3b, ADR-544): each live wing of the naval role
  // (`roleOf`, the wings the air AI sends at the nearest enemy fleet) at an airbase, of a nation at
  // war with n, its base's place and range. Built once a call, on the first ask.
  let bombers: { x: number; y: number; r: number }[] | undefined;
  /** Whether an enemy naval bomber wing on land has (x, y) within its range of its base. */
  const bombed = (x: number, y: number): boolean => {
    bombers ??= navalBombers(world, n);
    return bombers.some((b) => seaKm(world, b.x, b.y, x, y) <= b.r);
  };
  /** Whether fleet `id` stands by the water of a landing of its nation's under way (the escort, exempt from the bombers' test). */
  const escorting = (id: number): boolean => {
    for (const [fid, e] of world.embarked) if (c.nation[fid] === n && e.water >= 0 && near(cellOf(id), e.water)) return true;
    return false;
  };
  const war: { id: number; p: number }[] = [];
  const away: { id: number; p: number; e: number }[] = [];
  const raiders: number[] = [];
  for (const id of mine) {
    const p = fleetPower(world, id);
    if (p <= 0) {
      // Submarines raid (PLAN 4.6d).
      if (hasBoats(world, id)) raiders.push(id);
      // Transports that have landed their men come home, where the next landing loads (PLAN 7.26h1).
      else if (transportRoom(world, id) > 0 && !atOwnPort(id) && !carries(world, id)) sailHome(world, id);
      continue;
    }
    if (!atOwnPort(id)) {
      // Away: out of a zone where the enemy is far the stronger; and from one with no enemy ship
      // to fight under the enemy's naval bombers (PLAN 7.35b3b), unless it escorts a landing.
      const e = enemyIn(z.zoneOf[cellOf(id)]!);
      if (e > AVOID_RATIO * p || (e === 0 && bombed(c.x[id]!, c.y[id]!) && !escorting(id))) sailHome(world, id);
      else away.push({ id, p, e });
      continue;
    }
    war.push({ id, p });
  }
  if (raiders.length > 0) raid(world, n, raiders);
  if (war.length === 0 && away.length === 0) return;
  // The escort: the water of a landing of its own under way.
  let escort = -1;
  for (const [fid, e] of [...world.embarked].sort((a, b) => a[0] - b[0])) {
    if (c.nation[fid] === n && e.water >= 0) {
      escort = e.water;
      break;
    }
  }
  const km = (id: number, cell: number): number => seaKm(world, c.x[id]!, c.y[id]!, (cell % w) + 0.5, Math.floor(cell / w) + 0.5);
  /** The power of its standing warfleets, in port and away (PLAN 7.35d2b), within `SORTIE_KM` of cell `cell`: those that would sail there together. */
  const sums = new Map<number, number>();
  const together = (cell: number): number => {
    let t = sums.get(cell);
    if (t === undefined) {
      t = 0;
      for (const x of war) if (km(x.id, cell) <= SORTIE_KM) t += x.p;
      for (const x of away) if (km(x.id, cell) <= SORTIE_KM) t += x.p;
      sums.set(cell, t);
    }
    return t;
  };
  // The enemy's ports with water a fleet reaches, their zones' enemy power and their waters' key
  // (PLAN 7.35d2d, ADR-551, ADR-552: a port across land on a lake, or behind a passage shut to n, is
  // no target: `orderSail` refuses its way).
  const keys = waterKeys(world, n);
  const targets: Target[] = [];
  world.ports.forEach((p, i) => {
    const holder = ctl[p.cell]!;
    const at = water[i]!;
    if (holder === 0 || at < 0 || !world.wars.atWar(n, holder)) return;
    const zone = z.zoneOf[at]!;
    if (zone !== 0 && z.closed[zone] !== 1) targets.push({ at, enemy: enemyIn(zone), basin: keys[zone]! });
  });
  /** Whether target `t`'s water has no enemy ship and is under the enemy's naval bombers (no sortie's target, PLAN 7.35b3b). */
  const emptyBombed = (t: Target): boolean => t.enemy === 0 && bombed((t.at % w) + 0.5, Math.floor(t.at / w) + 0.5);
  // The enemy's standing warfleets (PLAN 7.35d2c, ADR-550), wherever they stand, and their zones'
  // enemy power: a battle to seek, as a port with enemy ships is; no station, no forward base.
  const hunts: Hunt[] = [];
  for (const q of prey()) if (world.wars.atWar(n, q.nation)) hunts.push({ at: q.at, enemy: enemyIn(q.zone), basin: keys[q.zone]! });
  // Away (PLAN 7.35d2b): a new order from where it stands; one escorting a landing stays.
  // The power of its standing warfleets by waters' key, in port and away (PLAN 7.39b, ADR-580): its navy there, that a chase is weighed against.
  const navy = new Map<number, number>();
  for (const x of [...war, ...away]) {
    const k = keyAt(world, keys, c.x[x.id]!, c.y[x.id]!);
    navy.set(k, (navy.get(k) ?? 0) + x.p);
  }
  for (const { id, e } of away) {
    if (escorting(id)) continue;
    const mine = keyAt(world, keys, c.x[id]!, c.y[id]!);
    awayOrder(world, id, e, mine, targets, hunts, together, emptyBombed, (cell) => near(cellOf(id), cell), navy.get(mine) ?? 0);
  }
  if (war.length === 0) return;
  let bases: number[] | undefined;
  /** The targets a sortie may take (PLAN 7.35b4c2): not empty water under the enemy's naval bombers; a base with none of them in reach is no forward base. */
  const fightable = (): Target[] => targets.filter((t) => !emptyBombed(t));
  for (const { id } of war) {
    // Its landing's water within reach, else the nearest enemy port within reach whose sea the fleets there together can win.
    let target = escort >= 0 && km(id, escort) <= SORTIE_KM ? escort : -1;
    let inReach = false;
    if (target < 0) {
      let best = Infinity;
      const mine = keyAt(world, keys, c.x[id]!, c.y[id]!);
      for (const t of targets) {
        // Of its waters only (PLAN 7.35d2d): one across land, or behind a passage shut, is not in reach, so the fleet may stage.
        if (t.basin !== mine) continue;
        const d = km(id, t.at);
        if (d > SORTIE_KM) continue;
        inReach = true;
        // No enemy ship to fight under the enemy's naval bombers: not a target (PLAN 7.35b3b);
        // still in reach, so the fleet stands rather than stages.
        if (d < best && t.enemy <= together(t.at) && !emptyBombed(t)) [best, target] = [d, t.at];
      }
      // An enemy warfleet in reach, of its basin, whose zone the fleets together can win (PLAN 7.35d2c).
      // It does not count as in reach for the stage: a fleet stands at sea for days, a port for good.
      for (const t of hunts) {
        if (t.basin !== mine) continue;
        const d = km(id, t.at);
        if (d <= SORTIE_KM && d < best && t.enemy <= together(t.at)) [best, target] = [d, t.at];
      }
    }
    // No enemy port within reach at all: it stages, to its bloc's nearest port that has one (PLAN 7.35b2).
    if (target < 0 && !inReach && targets.length > 0) target = stageTo(world, id, (bases ??= forwardBases(world, bloc, fightable(), war, enemyIn, keys)), keys);
    if (target < 0 || near(cellOf(id), target)) continue;
    orderSail(world, id, (target % w) + 0.5, Math.floor(target / w) + 0.5);
  }
}

/**
 * A warfleet at war away from its bloc's ports, not sent home (PLAN 7.35d2b, ADR-549): a sortie ends
 * at the target's water, and before this the fleet stood there until peace, at a port whose holder
 * had made its peace since (90 % of the late fleet-days at a port of a nation at war with neither
 * side, `docs/evidence/7.35/measure-d.md` §4). On its AI day, from where it stands, in order:
 * - by a standing enemy warfleet of its basin whose zone its warfleets together can win: it stays
 *   (PLAN 7.35d2c);
 * - the nearest battle in reach, its zone's enemy no more than its warfleets there together
 *   (`together`) can win: a standing enemy warfleet's cell, from any zone (PLAN 7.35d2c, ADR-550: it
 *   sails to the ships, and a battle begins by sight); or, from a zone with no enemy ship (`here`),
 *   an enemy port with enemy ships in its zone. Sought by its ports, from a zone that has the
 *   enemy's ships already, the fleets hopped every week between them a few cells apart, never
 *   meeting the ships (seed 1129, year 3, five British fleets);
 * - else, from a zone with no enemy ship, the nearest standing enemy warfleet of its waters beyond
 *   `SORTIE_KM` whose zone's enemy power is no more than its nation's standing warfleets of those
 *   waters together (`navy`): it sails for it, the chase (PLAN 7.39b, 7.46c, ADR-580). Before, late
 *   wars' navies stood on stations a median 4,423 km apart until peace (`docs/evidence/7.39/
 *   measure-b.md` §1). With the navies rebuilt (ADR-574, ADR-575, ADR-579) the chase empties those
 *   stations (886 → 53 fleet-weeks a world-year) and lifts the late sea battles 12.6 → 14.7 a
 *   world-year, at about half the world's navy in years 2–5 (`docs/evidence/7.46/c.md`);
 * - by an enemy-held port's water: it stays, on station (the blockade, PLAN 4.4b: the zone held
 *   against the port's holder halves its province's income);
 * - else the nearest enemy port within `SORTIE_KM` that a sortie may take (its zone's enemy no more
 *   than `together`, not empty water under naval bombers): it sails there, a new station;
 * - else it sails home (`sailHome`); no stage (it is past its base).
 */
function awayOrder(
  world: World,
  id: number,
  here: number,
  mine: number,
  targets: readonly Target[],
  hunts: readonly Hunt[],
  together: (cell: number) => number,
  emptyBombed: (t: Target) => boolean,
  by: (cell: number) => boolean,
  navy: number,
): void {
  const c = world.formations.cols;
  const w = world.cells.w;
  let battle = -1;
  let station = -1;
  let bestB = Infinity;
  let bestS = Infinity;
  let onStation = false;
  // An enemy warfleet in reach, of its basin, whose zone the fleets together can win (PLAN 7.35d2c):
  // a battle from any zone, as its ships are sought, not their zone's ports. By one already: it stays.
  let beside = false;
  // Beyond `SORTIE_KM` (PLAN 7.39b, ADR-580): the nearest enemy warfleet of its waters whose zone its
  // navy there (`navy`) can win, from a zone with no enemy ship: the chase, before a station.
  let chase = -1;
  let bestC = Infinity;
  for (const t of hunts) {
    if (t.basin !== mine) continue;
    const d = seaKm(world, c.x[id]!, c.y[id]!, (t.at % w) + 0.5, Math.floor(t.at / w) + 0.5);
    if (d > SORTIE_KM) {
      if (here === 0 && t.enemy <= navy && d < bestC) [bestC, chase] = [d, t.at];
      continue;
    }
    if (t.enemy > together(t.at)) continue;
    if (by(t.at)) {
      beside = true;
      continue;
    }
    if (d < bestB) [bestB, battle] = [d, t.at];
  }
  if (beside) return;
  for (const t of targets) {
    // Of its waters only (PLAN 7.35d2d).
    if (t.basin !== mine) continue;
    if (by(t.at)) {
      onStation = true;
      continue;
    }
    const d = seaKm(world, c.x[id]!, c.y[id]!, (t.at % w) + 0.5, Math.floor(t.at / w) + 0.5);
    if (d > SORTIE_KM || t.enemy > together(t.at) || emptyBombed(t)) continue;
    if (here === 0 && t.enemy > 0 && d < bestB) [bestB, battle] = [d, t.at];
    if (d < bestS) [bestS, station] = [d, t.at];
  }
  const target = battle >= 0 ? battle : chase >= 0 ? chase : onStation ? -1 : station;
  if (target >= 0) orderSail(world, id, (target % w) + 0.5, Math.floor(target / w) + 0.5);
  else if (!onStation) sailHome(world, id);
}

/**
 * The forward base fleet `id` stages to (PLAN 7.35b2): the water of `bases` nearest it (`seaKm`), of
 * those in its basin (`basinAt`, PLAN 7.35b4c: by the line a lake's port may be the nearest, the
 * Great Lakes' Toronto for a fleet at Halifax, and `orderSail` refuses it every turn); −1 with none.
 */
export function stageTo(world: World, id: number, bases: readonly number[], keys: Int32Array = waterKeys(world, 0)): number {
  const c = world.formations.cols;
  const w = world.cells.w;
  const z = seaOf(world);
  const mine = keyAt(world, keys, c.x[id]!, c.y[id]!);
  let best = Infinity;
  let at = -1;
  for (const b of bases) {
    if (keys[z.zoneOf[b]!] !== mine) continue;
    const d = seaKm(world, c.x[id]!, c.y[id]!, (b % w) + 0.5, Math.floor(b / w) + 0.5);
    if (d < best) [best, at] = [d, b];
  }
  return at;
}

/**
 * The enemy's naval bombers on land, as nation `n`'s naval AI reads them (PLAN 7.35b3b, ADR-544):
 * each wing with a live squadron, of the naval role (`roleOf`), at an airbase (not a carrier's),
 * of a nation at war with `n`; its base's place and its range (`wingRange`), by wing id.
 */
export function navalBombers(world: World, n: number): { x: number; y: number; r: number }[] {
  const c = world.formations.cols;
  const ec = world.elements.cols;
  const out: { x: number; y: number; r: number }[] = [];
  for (const [wing, base] of [...world.wingBase].sort((a, b) => a[0] - b[0])) {
    if (base <= 0 || !world.formations.has(wing) || !world.wars.atWar(n, c.nation[wing]!) || roleOf(world, wing) !== 'naval') continue;
    if (!(elementIndex(world).get(wing) ?? []).some((e) => ec.strength[e]! > 0)) continue;
    const at = basePlace(world, base);
    if (at) out.push({ x: at[0], y: at[1], r: wingRange(world, wing) });
  }
  return out;
}

/**
 * The forward bases of a nation at war (PLAN 7.35b2, ADR-543): the water of each port its bloc `bloc`
 * holds, its zone open, with an enemy port (`targets`) within `SORTIE_KM` of it, and in whose zone
 * the enemy's power is no more than its warfleets' in port together (`war`). A warfleet with no
 * enemy port within `SORTIE_KM` sails to the nearest (`plan`): the US Pacific Fleet at San Diego,
 * 5,900 km from Japan's nearest port with no American port between Hawaii and Guam, stood in port
 * through a war with Japan (`docs/evidence/7.35/measure-b.md`). The way there is a transit, not a
 * sortie: no bound on its length. From the base the sortie test runs as from any port of its own.
 */
export function forwardBases(world: World, bloc: number, targets: readonly { at: number; basin: number }[], war: readonly { p: number }[], enemyIn: (zone: number) => number, keys: Int32Array = waterKeys(world, 0)): number[] {
  const w = world.cells.w;
  const z = seaOf(world);
  const water = portSeaOf(world);
  const ctl = world.cells.controller;
  const all = war.reduce((s, x) => s + x.p, 0);
  const out: number[] = [];
  world.ports.forEach((p, i) => {
    const at = water[i]!;
    const holder = ctl[p.cell]!;
    if (at < 0 || holder === 0 || blocOf(world, holder) !== bloc) return;
    const zone = z.zoneOf[at]!;
    if (zone === 0 || z.closed[zone] === 1 || enemyIn(zone) > all) return;
    const ax = (at % w) + 0.5;
    const ay = Math.floor(at / w) + 0.5;
    // A target of the base's waters (PLAN 7.35d2d): one across land on a lake, or behind a passage shut, is none.
    const mine = keys[zone]!;
    if (targets.some((t) => t.basin === mine && seaKm(world, ax, ay, (t.at % w) + 0.5, Math.floor(t.at / w) + 0.5) <= SORTIE_KM)) out.push(at);
  });
  return out;
}
