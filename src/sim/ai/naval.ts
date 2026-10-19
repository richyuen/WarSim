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
 *   and go together): a battle it would lose is not sought.
 * - At war, such a warfleet with no enemy port within `SORTIE_KM` at all stages (PLAN 7.35b2):
 *   it sails to the nearest port of its bloc's that has one (`forwardBases`), and sorties from
 *   there. The US Pacific Fleet at San Diego goes west against Japan.
 * - At war, a warfleet away from its ports in a zone where the enemy's power is over
 *   `AVOID_RATIO` times its own sails home (`sailHome`).
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
import { AT_PORT_CELLS, sailHome, seaKm } from '../systems/navalCombat';
import { fleetPower, navalPower } from '../systems/seaControl';

export { fleetPower };
import { orderSail } from '../systems/sail';
import { blocOf } from '../systems/supply';
import { portSeaOf, seaOf, seaRangeOf, type World } from '../world';
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
  for (const n of [...fleets.keys()].sort((a, b) => a - b)) plan(world, n, fleets.get(n)!, power);
}

function plan(world: World, n: number, mine: number[], power: Map<number, Map<number, number>>): void {
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
      continue;
    }
    war.push({ id, p });
  }
  if (raiders.length > 0) raid(world, n, raiders);
  if (war.length === 0) return;
  // The escort: the water of a landing of its own under way.
  let escort = -1;
  for (const [fid, e] of [...world.embarked].sort((a, b) => a[0] - b[0])) {
    if (c.nation[fid] === n && e.water >= 0) {
      escort = e.water;
      break;
    }
  }
  const km = (id: number, cell: number): number => seaKm(world, c.x[id]!, c.y[id]!, (cell % w) + 0.5, Math.floor(cell / w) + 0.5);
  /** The power of its warfleets in port within `SORTIE_KM` of cell `cell`: those that would sail there together. */
  const together = (cell: number): number => war.reduce((s, x) => s + (km(x.id, cell) <= SORTIE_KM ? x.p : 0), 0);
  // The enemy's ports with water a fleet reaches, and their zones' enemy power.
  const targets: { at: number; enemy: number }[] = [];
  world.ports.forEach((p, i) => {
    const holder = ctl[p.cell]!;
    const at = water[i]!;
    if (holder === 0 || at < 0 || !world.wars.atWar(n, holder)) return;
    const zone = z.zoneOf[at]!;
    if (zone !== 0 && z.closed[zone] !== 1) targets.push({ at, enemy: enemyIn(zone) });
  });
  let bases: number[] | undefined;
  for (const { id } of war) {
    // Its landing's water within reach, else the nearest enemy port within reach whose sea the fleets there together can win.
    let target = escort >= 0 && km(id, escort) <= SORTIE_KM ? escort : -1;
    let inReach = false;
    if (target < 0) {
      let best = Infinity;
      for (const t of targets) {
        const d = km(id, t.at);
        if (d > SORTIE_KM) continue;
        inReach = true;
        // No enemy ship to fight under the enemy's naval bombers: not a target (PLAN 7.35b3b);
        // still in reach, so the fleet stands rather than stages.
        if (d < best && t.enemy <= together(t.at) && !(t.enemy === 0 && bombed((t.at % w) + 0.5, Math.floor(t.at / w) + 0.5))) [best, target] = [d, t.at];
      }
    }
    // No enemy port within reach at all: it stages, to its bloc's nearest port that has one (PLAN 7.35b2).
    if (target < 0 && !inReach && targets.length > 0) target = stage(id, (bases ??= forwardBases(world, bloc, targets, war, enemyIn)));
    if (target < 0 || near(cellOf(id), target)) continue;
    orderSail(world, id, (target % w) + 0.5, Math.floor(target / w) + 0.5);
  }

  /** The water of `bases` nearest fleet `id`, or −1 with none. */
  function stage(id: number, list: number[]): number {
    let best = Infinity;
    let at = -1;
    for (const b of list) {
      const d = km(id, b);
      if (d < best) [best, at] = [d, b];
    }
    return at;
  }
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
export function forwardBases(world: World, bloc: number, targets: readonly { at: number }[], war: readonly { p: number }[], enemyIn: (zone: number) => number): number[] {
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
    if (targets.some((t) => seaKm(world, ax, ay, (t.at % w) + 0.5, Math.floor(t.at / w) + 0.5) <= SORTIE_KM)) out.push(at);
  });
  return out;
}
