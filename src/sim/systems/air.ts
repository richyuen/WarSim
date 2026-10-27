/**
 * The air wings at their bases (PLAN 5.1d). A wing's base is state (`world.wingBase`): an airbase
 * (its index + 1) or a carrier's fleet (the fleet's id, negative). Hourly after the movement, a
 * wing on a carrier is where its fleet is; one whose carrier is gone (`destroyFormation` sets its
 * base to 0) is lost with it, as are the wings beyond its fleet's live carriers (PLAN 5.8l); one
 * whose airbase a nation not of its side took falls back to its nation's nearest, or is lost
 * (PLAN 5.8m). Then the scheduler (PLAN 5.2b): a wing with a mission and no sortie,
 * ready on its base, launches one; then the air power flown by zone (`airPowerSystem`, PLAN 5.3c)
 * and the hour's air fights (`airCombat`, PLAN 5.3a). No rule
 * of the land reads a wing yet (`World.offLand`).
 */
import { EventKind, RejectReason } from '../../shared/events';
import { airbaseRoom } from '../data/airbases';
import { airCombat, antiAir, strikes } from './airCombat';
import { airLift } from './airLift';
import { airPowerSystem } from './airSuperiority';
import { repairSystem } from './bombing';
import { destroyFormation, elementIndex, loopW, wrapDx } from './elements';
import { seaKm } from './navalCombat';
import { Leg, patrolHours, sortieAt, sortieEnd } from './sorties';
import { blocOf } from './supply';
import { airOf, type World } from '../world';

export function airSystem(world: World): void {
  repairSystem(world);
  if (world.wingBase.size === 0) {
    // No wing left: what was flown fades all the same (PLAN 5.8k).
    if (world.airPower.size > 0) airPowerSystem(world, new Map());
    return;
  }
  const f = world.formations;
  const c = f.cols;
  // A wing to each live carrier of a fleet, the lowest ids first (PLAN 5.8l).
  const decks = new Map<number, number>();
  // The patrols' relays (PLAN 7.36a), made when a patrol is first ready to take off this hour.
  let relay: Map<string, Relay> | null = null;
  const relayOf = (): Map<string, Relay> => (relay ??= relays(world));
  for (const [id, base] of [...world.wingBase].sort((a, b) => a[0] - b[0])) {
    if (!f.has(id)) {
      world.wingBase.delete(id);
      continue;
    }
    if (base === 0) {
      // Its carrier is gone: lost with it.
      destroyFormation(world, id);
      continue;
    }
    if (base > 0 && !ofSide(world, c.nation[id]!, world.cells.controller[world.airbases[base - 1]!.cell]!)) {
      // Its airbase taken (PLAN 5.8m): to its nation's nearest with room, or lost.
      const to = fallBack(world, id, base);
      if (to === 0) {
        destroyFormation(world, id);
        continue;
      }
      world.wingBase.set(id, to);
      world.wingMission.delete(id);
      world.sorties.delete(id);
      world.wingFerry.delete(id);
      [c.x[id], c.y[id]] = basePlace(world, to)!;
    }
    const due = world.wingFerry.get(id);
    if (due !== undefined) {
      // At sea (PLAN 7.133): it flies nothing until it is at its new base.
      if (world.tick < due) continue;
      world.wingFerry.delete(id);
      [c.x[id], c.y[id]] = basePlace(world, world.wingBase.get(id)!)!;
    }
    if (base < 0) {
      const left = decks.get(-base) ?? liveCarriers(world, -base);
      if (left === 0) {
        // Its carrier sunk, the fleet afloat: lost with it.
        destroyFormation(world, id);
        continue;
      }
      decks.set(-base, left - 1);
      c.x[id] = c.x[-base]!;
      c.y[id] = c.y[-base]!;
    }
    schedule(world, id, relayOf);
  }
  const byZone = world.sorties.size > 0 ? airborne(world, world.tick) : new Map<number, number[]>();
  if (byZone.size > 0 || world.airPower.size > 0) airPowerSystem(world, byZone);
  strikes(world);
  airLift(world);
  if (byZone.size > 0) airCombat(world, byZone);
  antiAir(world);
}

/** Whether `holder` is nation `nation` or of its side: its supply bloc, or fighting beside it. */
export function ofSide(world: World, nation: number, holder: number): boolean {
  return holder === nation || blocOf(world, holder) === blocOf(world, nation) || world.wars.sameSide(nation, holder);
}

/**
 * The airbase wing `id` falls back to from airbase `from`, taken (PLAN 5.8m): its nation's
 * nearest by km with room for it, the lowest index of the nearest; 0 for none.
 */
function fallBack(world: World, id: number, from: number): number {
  const c = world.formations.cols;
  const nation = c.nation[id]!;
  const need = wingAircraft(world, c.template[id]!);
  const used = new Map<number, number>();
  for (const [o, b] of world.wingBase) if (b > 0 && o !== id) used.set(b, (used.get(b) ?? 0) + wingAircraft(world, c.template[o]!));
  const [fx, fy] = world.cellPoint(world.airbases[from - 1]!.cell);
  let best = 0;
  let bd = Infinity;
  world.airbases.forEach((b, i) => {
    if (world.cells.controller[b.cell] !== nation || (used.get(i + 1) ?? 0) + need > airbaseRoom(b)) return;
    const d = seaKm(world, fx, fy, ...world.cellPoint(b.cell));
    if (d < bd) {
      bd = d;
      best = i + 1;
    }
  });
  return best;
}

/** Fleet `fleet`'s carriers afloat: its live elements of a carrier class (PLAN 5.8l). */
export function liveCarriers(world: World, fleet: number): number {
  const els = elementIndex(world).get(fleet);
  if (!els) return 0;
  const units = world.rules!.units;
  const ec = world.elements.cols;
  let n = 0;
  for (const e of els) if (ec.strength[e]! > 0 && units[ec.unit[e]!]!.cls === 'cv') n++;
  return n;
}

/** Hours a wing is on its base after a sortie before it can fly the next (refuelled, rearmed). */
export const TURNAROUND_HOURS = 2;

/** The patrols of one nation over one place (PLAN 7.36a): how many wings it has on them, and the last launch of one. */
interface Relay {
  wings: number;
  last: number;
}

/** The key of a patrol's relay: its nation and its place. */
const relayKey = (nation: number, m: WingMission): string => `${nation}:${m.x}:${m.y}`;

/** The hour's relays: of each nation's wings on a patrol, by place, their count and their latest launch. */
function relays(world: World): Map<string, Relay> {
  const out = new Map<string, Relay>();
  const c = world.formations.cols;
  for (const [id, m] of world.wingMission) {
    if (m.kind !== 'patrol' || !world.formations.has(id)) continue;
    const key = relayKey(c.nation[id]!, m);
    let r = out.get(key);
    if (!r) out.set(key, (r = { wings: 0, last: -Infinity }));
    r.wings++;
    const s = world.sorties.get(id);
    if (s && s.launch > r.last) r.last = s.launch;
  }
  return out;
}

/**
 * The scheduler for wing `id` this hour (PLAN 5.2b): a sortie done and turned round is
 * forgotten; then a wing with a mission and none, whose target is within its range of its base,
 * takes off now: a strike turns over its target, a patrol stays `patrolHours`.
 *
 * Patrols over one place take off in turn (PLAN 7.36a, ADR-558): of a nation's `n` wings on a
 * patrol of the same place, one takes off no sooner than ⌈its cycle⌉ / n hours (its flight out,
 * over and back, and its turnaround, in the whole hours it takes) after the last of them did,
 * within the hour where that falls in it (a launch is then a fraction of an hour past the tick). They had all flown at the hour
 * their missions came and turned home together, and the front had no aircraft over it 40 % of
 * the time, a fighter wing tasked there or not (seed 7019, Germany–Poland: 0 drawn at 25 and
 * 10 m/px, the critic's run 10). The aircraft-hours over the place are the same.
 */
function schedule(world: World, id: number, relayOf: () => Map<string, Relay>): void {
  const s = world.sorties.get(id);
  if (s) {
    if (world.tick < sortieEnd(s) + TURNAROUND_HOURS) return;
    world.sorties.delete(id);
  }
  const m = world.wingMission.get(id);
  const at = m && basePlace(world, world.wingBase.get(id)!);
  if (!m || !at) return;
  const km = seaKm(world, at[0], at[1], m.x, m.y);
  const range = wingRange(world, id);
  if (km > range) return; // its carrier sailed off: it waits
  const kmh = world.rules!.templates[world.formations.cols.template[id]!]!.speedKmh;
  const over = m.kind === 'patrol' ? patrolHours(range, kmh, km) : 0;
  const r = m.kind === 'patrol' ? relayOf().get(relayKey(world.formations.cols.nation[id]!, m)) : undefined;
  let launch = world.tick;
  if (r && r.wings > 1) {
    const cycle = (kmh > 0 ? (2 * km) / kmh : 0) + over + TURNAROUND_HOURS;
    // A wing is ready again at the first hour from its launch past its cycle; spaced by an n-th of
    // that, the relay holds none of them back once it turns. The turn may fall within the hour.
    const next = r.last + Math.ceil(cycle) / r.wings;
    if (next >= world.tick + 1) return;
    launch = Math.max(world.tick, next);
    r.last = launch;
  }
  world.sorties.set(id, { bx: at[0], by: at[1], tx: m.x, ty: m.y, launch, kmh, km, over });
}

/**
 * The sorties in the air at time `t` by the air zone they are in (PLAN 5.2b; `airOf`), each zone's
 * wings by id: where PLAN 5.3's interceptions are reckoned. From `sortieAt`, nothing stored.
 */
export function airborne(world: World, t: number): Map<number, number[]> {
  const zones = airOf(world).zoneOf;
  const w = world.cells.w;
  const out = new Map<number, number[]>();
  for (const [id, s] of [...world.sorties].sort((a, b) => a[0] - b[0])) {
    const p = sortieAt(s, t, loopW(world));
    if (p.leg === Leg.Home) continue;
    const zone = zones[Math.min(world.cells.h - 1, Math.floor(p.y)) * w + Math.floor(p.x)]!;
    const list = out.get(zone);
    if (list) list.push(id);
    else out.set(zone, [id]);
  }
  return out;
}

/** A wing's mission (PLAN 5.1e): to patrol about a place or strike it, or (a transport's, PLAN 5.8u1) to fly supply to it. Read by the scheduler of PLAN 5.2. */
export interface WingMission {
  kind: 'patrol' | 'strike' | 'supply';
  x: number;
  y: number;
}

/** How far an airbase or a carrier is from (x, y) and still the place an order names, cells. */
export const BASE_PICK_CELLS = 2;

/** Wing `id`'s range, km: the least `rangeKm` of its aircraft (PLAN 5.1e). */
export function wingRange(world: World, id: number): number {
  const rules = world.rules!;
  let r = Infinity;
  for (const e of rules.templates[world.formations.cols.template[id]!]!.elements) r = Math.min(r, rules.units[e.unit]!.rangeKm);
  return r;
}

/** The aircraft a wing of template `t` has (its squadrons × their size). */
export function wingAircraft(world: World, t: number): number {
  const rules = world.rules!;
  return rules.templates[t]!.elements.reduce((s, e) => s + e.count * rules.units[e.unit]!.size, 0);
}

/** Where base `base` (`world.wingBase`'s code) is: an airbase's land cell, or its carrier fleet's place; null for none. */
export function basePlace(world: World, base: number): [number, number] | null {
  if (base > 0) return world.cellPoint(world.airbases[base - 1]!.cell);
  if (base < 0 && world.formations.has(-base)) return [world.formations.cols.x[-base]!, world.formations.cols.y[-base]!];
  return null;
}

/** The km from wing `id`'s base to (x, y); Infinity with no base. */
export function kmFromBase(world: World, id: number, x: number, y: number): number {
  const at = basePlace(world, world.wingBase.get(id) ?? 0);
  return at ? seaKm(world, at[0], at[1], x, y) : Infinity;
}

const reject = (world: World, id: number, why: RejectReason): RejectReason => {
  world.out.emit(world.tick, EventKind.MoveRejected, id, world.formations.has(id) ? world.formations.cols.nation[id]! : 0, why, NaN);
  return why;
};

/** Whether wing `id` is of transports: every squadron of its template of class `transport_air` (PLAN 5.8u1). */
export function isTransport(world: World, id: number): boolean {
  const rules = world.rules!;
  return rules.templates[world.formations.cols.template[id]!]!.elements.every((e) => rules.units[e.unit]!.cls === 'transport_air');
}

/**
 * Orders wing `id` to patrol about, strike or (a transport) fly supply to (x, y) (PLAN 5.1e,
 * 5.8u1): kept as its mission (`world.wingMission`) where the place is within its range of its
 * base, else refused (`MoveRejected`, `OutOfRange`; `NoBase` for a wing with none, its carrier sunk
 * this hour; `NotLand` for no wing, or supply by a wing not of transports). 0 when ordered.
 */
export function orderMission(world: World, id: number, kind: WingMission['kind'], x: number, y: number): 0 | RejectReason {
  if (!world.formations.has(id) || !world.isWing(id) || !world.wingBase.has(id)) return reject(world, id, RejectReason.NotLand);
  // A carrier sunk this hour leaves its wings no base until the air system loses them (PLAN 5.8j).
  if (!basePlace(world, world.wingBase.get(id)!) || world.wingFerry.has(id)) return reject(world, id, RejectReason.NoBase);
  // Supply is flown by transports alone (PLAN 5.8u1).
  if (kind === 'supply' && !isTransport(world, id)) return reject(world, id, RejectReason.NotLand);
  if (kmFromBase(world, id, x, y) > wingRange(world, id)) return reject(world, id, RejectReason.OutOfRange);
  world.wingMission.set(id, { kind, x, y });
  return 0;
}

/**
 * How far a rebase flies, in ranges (PLAN 5.12a): a wing's range is a radius, out and back
 * (`patrolHours`); a rebase is one way, a ferry flight. (At one range a wing could not cross the
 * gaps between Siberia's airbases to a front in the east.)
 */
export const FERRY_RANGE = 2;

/**
 * Orders wing `id` to the base at (x, y) (PLAN 5.1e): an airbase within `BASE_PICK_CELLS` held by
 * its nation or a nation of its side (its supply bloc, or one fighting beside it), or a fleet of
 * its nation's with a carrier there; within FERRY_RANGE of its range of its base now, with room for it (an
 * airbase's `airbaseRoom` in aircraft; a fleet's a wing to each live carrier). The wing is at its new
 * base at once (the flight is PLAN 5.2's) and its mission ends. Else refused: `OutOfRange`, or
 * `NoBase`. 0 when ordered.
 */
export function orderRebase(world: World, id: number, x: number, y: number): 0 | RejectReason {
  if (!world.formations.has(id) || !world.isWing(id) || !world.wingBase.has(id)) return reject(world, id, RejectReason.NotLand);
  // No base to fly from (its carrier sunk this hour, PLAN 5.8j): nowhere it reaches.
  const from = basePlace(world, world.wingBase.get(id)!);
  if (!from || world.wingFerry.has(id)) return reject(world, id, RejectReason.NoBase);
  const c = world.formations.cols;
  const nation = c.nation[id]!;
  const near = (px: number, py: number): boolean => Math.abs(wrapDx(world, x, px)) <= world.atSize(BASE_PICK_CELLS) && Math.abs(py - y) <= world.atSize(BASE_PICK_CELLS);
  const need = wingAircraft(world, c.template[id]!);
  const used = (base: number): { aircraft: number; wings: number } => {
    let aircraft = 0;
    let wings = 0;
    for (const [o, b] of world.wingBase) {
      if (b !== base || o === id) continue;
      aircraft += wingAircraft(world, c.template[o]!);
      wings++;
    }
    return { aircraft, wings };
  };
  let best = 0;
  let bd = Infinity;
  let far = false;
  const consider = (base: number, px: number, py: number, room: (u: { aircraft: number; wings: number }) => boolean): void => {
    if (base === world.wingBase.get(id) || !near(px, py) || !room(used(base))) return;
    if (seaKm(world, from[0], from[1], px, py) > FERRY_RANGE * wingRange(world, id)) {
      far = true;
      return;
    }
    const d = Math.abs(px - x) + Math.abs(py - y);
    if (d < bd) {
      bd = d;
      best = base;
    }
  };
  world.airbases.forEach((b, i) => {
    if (!ofSide(world, nation, world.cells.controller[b.cell]!)) return;
    consider(i + 1, ...world.cellPoint(b.cell), (u) => u.aircraft + need <= airbaseRoom(b));
  });
  world.formations.forEach((f) => {
    if (!world.isFleet(f) || c.nation[f] !== nation) return;
    const cvs = liveCarriers(world, f);
    if (cvs > 0) consider(-f, c.x[f]!, c.y[f]!, (u) => u.wings + 1 <= cvs);
  });
  if (best === 0) return reject(world, id, far ? RejectReason.OutOfRange : RejectReason.NoBase);
  world.wingBase.set(id, best);
  world.wingMission.delete(id);
  world.sorties.delete(id); // the flight there is PLAN 5.3's; it is ready at its new base
  [c.x[id], c.y[id]] = basePlace(world, best)!;
  return 0;
}

/** A wing crosses the sea at this speed, km/h, where the scenario has no transport fleet to read it from (PLAN 7.133). */
export const SEA_FERRY_KMH = 30;

/** The speed a wing crosses the sea at, km/h (PLAN 7.133): the slowest fleet of transports alone (a convoy's), else SEA_FERRY_KMH. */
export function seaFerryKmh(world: World): number {
  const rules = world.rules!;
  let kmh = Infinity;
  for (const t of rules.templates) if (t.elements.length > 0 && t.elements.every((e) => rules.units[e.unit]!.cls === 'tp')) kmh = Math.min(kmh, t.speedKmh);
  return Number.isFinite(kmh) && kmh > 0 ? kmh : SEA_FERRY_KMH;
}

/**
 * Orders wing `id` over the sea to airbase `base` (its index + 1; PLAN 7.133, ADR-723): an airbase held by
 * its nation or one of its side (`ofSide`), not its own, with room for it (counting the wings sailing to it). Its
 * base is the new one at once (the room is its), and it is there (`world.wingFerry`) after the hours a
 * convoy takes over the km between (`seaFerryKmh`, at least one): until then it flies nothing and takes no
 * order. No path and no interception at sea. Its mission and sortie end. Refused (`NoBase`) from a carrier,
 * at sea already, or to a base that is not such; `NotLand` for no wing. 0 when ordered.
 */
export function orderFerry(world: World, id: number, base: number): 0 | RejectReason {
  if (!world.formations.has(id) || !world.isWing(id) || !world.wingBase.has(id)) return reject(world, id, RejectReason.NotLand);
  const now = world.wingBase.get(id)!;
  const from = now > 0 ? basePlace(world, now) : null;
  const b = world.airbases[base - 1];
  const c = world.formations.cols;
  if (!from || world.wingFerry.has(id) || !b || base === now || !ofSide(world, c.nation[id]!, world.cells.controller[b.cell]!)) return reject(world, id, RejectReason.NoBase);
  let aircraft = wingAircraft(world, c.template[id]!);
  for (const [o, ob] of world.wingBase) if (ob === base && o !== id) aircraft += wingAircraft(world, c.template[o]!);
  if (aircraft > airbaseRoom(b)) return reject(world, id, RejectReason.NoBase);
  const [px, py] = world.cellPoint(b.cell);
  const hours = Math.max(1, Math.ceil(seaKm(world, from[0], from[1], px, py) / seaFerryKmh(world)));
  world.wingBase.set(id, base);
  world.wingFerry.set(id, world.tick + hours);
  world.wingMission.delete(id);
  world.sorties.delete(id);
  return 0;
}
