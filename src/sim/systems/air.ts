/**
 * The air wings at their bases (PLAN 5.1d). A wing's base is state (`world.wingBase`): an airbase
 * (its index + 1) or a carrier's fleet (the fleet's id, negative). Hourly after the movement, a
 * wing on a carrier is where its fleet is; one whose carrier is gone (`destroyFormation` sets its
 * base to 0) is lost with it. Then the scheduler (PLAN 5.2b): a wing with a mission and no sortie,
 * ready on its base, launches one; then the air power flown by zone (`airPowerSystem`, PLAN 5.3c)
 * and the hour's air fights (`airCombat`, PLAN 5.3a). No rule
 * of the land reads a wing yet (`World.offLand`).
 */
import { EventKind, RejectReason } from '../../shared/events';
import { airbaseRoom } from '../data/airbases';
import { airCombat, antiAir, strikes } from './airCombat';
import { airPowerSystem } from './airSuperiority';
import { destroyFormation } from './elements';
import { seaKm } from './navalCombat';
import { Leg, patrolHours, sortieAt, sortieEnd } from './sorties';
import { blocOf } from './supply';
import { airOf, type World } from '../world';

export function airSystem(world: World): void {
  if (world.wingBase.size === 0) return;
  const f = world.formations;
  const c = f.cols;
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
    if (base < 0) {
      c.x[id] = c.x[-base]!;
      c.y[id] = c.y[-base]!;
    }
    schedule(world, id);
  }
  const byZone = world.sorties.size > 0 ? airborne(world, world.tick) : new Map<number, number[]>();
  if (byZone.size > 0 || world.airPower.size > 0) airPowerSystem(world, byZone);
  strikes(world);
  if (byZone.size > 0) airCombat(world, byZone);
  antiAir(world);
}

/** Hours a wing is on its base after a sortie before it can fly the next (refuelled, rearmed). */
export const TURNAROUND_HOURS = 2;

/**
 * The scheduler for wing `id` this hour (PLAN 5.2b): a sortie done and turned round is
 * forgotten; then a wing with a mission and none, whose target is within its range of its base,
 * takes off now: a strike turns over its target, a patrol stays `patrolHours`.
 */
function schedule(world: World, id: number): void {
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
  world.sorties.set(id, { bx: at[0], by: at[1], tx: m.x, ty: m.y, launch: world.tick, kmh, km, over: m.kind === 'patrol' ? patrolHours(range, kmh, km) : 0 });
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
    const p = sortieAt(s, t, w);
    if (p.leg === Leg.Home) continue;
    const zone = zones[Math.min(world.cells.h - 1, Math.floor(p.y)) * w + Math.floor(p.x)]!;
    const list = out.get(zone);
    if (list) list.push(id);
    else out.set(zone, [id]);
  }
  return out;
}

/** A wing's mission (PLAN 5.1e): to patrol about a place or strike it. Read by the scheduler of PLAN 5.2. */
export interface WingMission {
  kind: 'patrol' | 'strike';
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

/**
 * Orders wing `id` to patrol about or strike (x, y) (PLAN 5.1e): kept as its mission
 * (`world.wingMission`) where the place is within its range of its base, else refused
 * (`MoveRejected`, `OutOfRange`; `NotLand` for no wing). 0 when ordered.
 */
export function orderMission(world: World, id: number, kind: WingMission['kind'], x: number, y: number): 0 | RejectReason {
  if (!world.formations.has(id) || !world.isWing(id) || !world.wingBase.has(id)) return reject(world, id, RejectReason.NotLand);
  if (kmFromBase(world, id, x, y) > wingRange(world, id)) return reject(world, id, RejectReason.OutOfRange);
  world.wingMission.set(id, { kind, x, y });
  return 0;
}

/**
 * Orders wing `id` to the base at (x, y) (PLAN 5.1e): an airbase within `BASE_PICK_CELLS` held by
 * its nation or a nation of its side (its supply bloc, or one fighting beside it), or a fleet of
 * its nation's with a carrier there; within its range of its base now, with room for it (an
 * airbase's `airbaseRoom` in aircraft; a fleet's a wing to each carrier). The wing is at its new
 * base at once (the flight is PLAN 5.2's) and its mission ends. Else refused: `OutOfRange`, or
 * `NoBase`. 0 when ordered.
 */
export function orderRebase(world: World, id: number, x: number, y: number): 0 | RejectReason {
  if (!world.formations.has(id) || !world.isWing(id) || !world.wingBase.has(id)) return reject(world, id, RejectReason.NotLand);
  const c = world.formations.cols;
  const nation = c.nation[id]!;
  const bloc = blocOf(world, nation);
  const w = world.cells.w;
  const near = (px: number, py: number): boolean => {
    let dx = Math.abs(px - x);
    if (world.settings.loopingMap && dx > w / 2) dx = w - dx;
    return dx <= BASE_PICK_CELLS && Math.abs(py - y) <= BASE_PICK_CELLS;
  };
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
    if (seaKm(world, ...basePlace(world, world.wingBase.get(id)!)!, px, py) > wingRange(world, id)) {
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
    const holder = world.cells.controller[b.cell]!;
    if (holder !== nation && blocOf(world, holder) !== bloc && !world.wars.sameSide(nation, holder)) return;
    consider(i + 1, ...world.cellPoint(b.cell), (u) => u.aircraft + need <= airbaseRoom(b));
  });
  const carrier = world.rules!.units.findIndex((u) => u.cls === 'cv');
  world.formations.forEach((f) => {
    if (!world.isFleet(f) || c.nation[f] !== nation) return;
    const cvs = world.rules!.templates[c.template[f]!]!.elements.filter((e) => e.unit === carrier).reduce((s, e) => s + e.count, 0);
    if (cvs > 0) consider(-f, c.x[f]!, c.y[f]!, (u) => u.wings + 1 <= cvs);
  });
  if (best === 0) return reject(world, id, far ? RejectReason.OutOfRange : RejectReason.NoBase);
  world.wingBase.set(id, best);
  world.wingMission.delete(id);
  world.sorties.delete(id); // the flight there is PLAN 5.3's; it is ready at its new base
  [c.x[id], c.y[id]] = basePlace(world, best)!;
  return 0;
}
