/**
 * Fleet battles (PLAN 4.3a, SPEC §6.2): detection, contact, the range of a battle and gunnery
 * by range, at the level of the ship.
 *
 * Detection (hourly): a fleet of a nation at war sees an enemy fleet within its best ship's
 * `detection` (km; × 1 + AIR_DETECTION × (2s − 1), s its side's air superiority over it, PLAN
 * 5.8t2) × (1 − the enemy's least stealthy ship's `stealth` / 100). Two fleets of
 * nations at war in which either sees the other, and of which one has a weapon (a gun: `rangeKm`
 * and `hard` above 0; torpedoes: `torpedoKm` and `torpedo`), are in contact; fleets in contact, joined, are one sea battle. A fleet in a battle
 * is `engaged`: the movement system leaves it, as a land formation in contact; it moves only to close.
 *
 * The closing (PLAN 7.19a, ADR-493; until then one range for the whole battle closed by the two
 * sides' reach and pace while every fleet stood still, and a fleet fired at fleets hundreds of km
 * off): from a battle's second hour a fleet that has no enemy fleet of the battle within its reach
 * (against a surface ship its longest gun or torpedo, or its carriers' wings; against a submarine
 * its depth charges', its guns' reach) closes on the nearest one it can hit, on the water, by
 * `closeBy`: beyond both reaches the two close together, by their paces (the template's top
 * speed), to the longer reach at most; between the two the fleet of the shorter reach closes by
 * what its pace has over the other's, to its reach, and the other holds it off. The range of a
 * battle (km, its record's in `world.seaBattles`, state) is the distance of its nearest two fleets
 * at war with each other. A side's fleets are the battle's that are not at war with its first
 * fleet's nation; the other side, those that are.
 *
 * Fire (per battle, per hour): every ship with a weapon fires at a ship of an enemy fleet of its
 * battle within its reach (its gun's where its gun reaches that fleet, its torpedoes' where they
 * do), chosen by weight (its hit points: a battleship draws more fire than a
 * destroyer) with hash32(seed, tick, element) and kept for `COOLDOWN` hours. Damage in ships:
 *   hard × (ARMOR_PEN where its armour beats the shell's piercing) × SEA_FIRE_SCALE
 *       × the attack buffs of the shooter ÷ the defence buffs of the target ÷ target hpPerUnit.
 * All volleys of an hour before any loss (simultaneous), as on land. A ship's end is the
 * element's (`ElementDestroyed`); a fleet with no ship left is gone. Each volley emits a
 * FireEvent (not state).
 *
 * Torpedoes and the screen (PLAN 4.3b): a ship with torpedoes fires them at its target too, where
 * their reach (`torpedoKm`) covers the range; a submarine whatever the range (it closes
 * submerged). A torpedo's damage is its `torpedo` with no armour against it, × the screen of
 * the target: a ship that is no destroyer, of a side with destroyers in the battle, takes
 * × (1 − SCREEN × min(1, its side's destroyers ÷ its side's other surface ships)). A
 * submarine is no target of a gun or a torpedo (it is under water): only of depth charges
 * (`asw`, a destroyer's), within the reach of its guns, chosen among the enemy's submarines. A
 * submarine closes to its torpedoes' reach as any other ship, at its pace whatever the other's: a
 * fleet of submarines closes under water, and no faster fleet holds it off (before PLAN 7.19a it
 * fired them at any range).
 *
 * A battle's record (PLAN 4.3c, `world.seaBattles`): its fleets with the ships each came in
 * with, its range, its two sides' first nations and the ships each side lost, where it began.
 * An hour's battle takes the record that has one of its fleets (two such are merged). A fleet
 * under half the ships it came in with, or with no weapon against an enemy that has one once it
 * is under fire (a volley or a carrier strike on it that hour, PLAN 7.31; until then it stands in
 * the battle, engaged, and the enemy closes on it), breaks off unless it is at its port
 * (`atOwnPort`, PLAN 7.31: it has nowhere to go, and fights there) (`breakOff`: `BREAK_HOURS` out of
 * every sea battle, sailing for its nation's nearest port).
 * A battle with no fleet of one side left, or with no contact in an hour, is over: one row in the
 * history log (`SeaBattle`: each side with the ships it lost; where it began).
 *
 * Carrier air groups (PLAN 5.4d): a fleet's carriers' wings (on board, not in the air on a sortie
 * of their own) see for it and are its weapon as far as `CARRIER_SPOT_SHARE` of their range:
 * its detection and its reach; once in `CARRIER_CYCLE` hours each strikes the enemy's surface
 * ships of the battle in the fleets within that reach, as a naval strike does.
 *
 * Not here: sea control (PLAN 4.4); the AI's orders (PLAN 4.6).
 */
import { hash32, hashToUnit } from '../core/hash';
import { atan2, hypot } from '../core/dmath';
import { EventKind } from '../../shared/events';
import { SIDE_SHIPS } from '../../shared/history';
import { isLand } from '../../shared/terrain';
import { nearestCellWhere } from '../data/ownership';
import { airOf, basinOf, navOf, portSeaOf, seaOf, type SeaBattle, type World } from '../world';
import { orderSail, sailStep } from './sail';
import { applyLoss, elementIndex, elementPlace, loopW, noteMove, settleFormation, slotCount } from './elements';
import { ARMOR_PEN, COOLDOWN } from './combat';
import { wingRange } from './air';
import { NAVAL_STRIKE_FIRE, shipEffectiveness } from './airCombat';
import { AIR_DETECTION, airSuperiority } from './airSuperiority';
import { Leg, sortieAt, type Sortie } from './sorties';

/** Ships removed per hour by one ship per point of `hard` against a target of 1 hit point. */
export const SEA_FIRE_SCALE = 2;
/** The share of the torpedoes' damage a full screen of destroyers takes off (one destroyer to each other surface ship of the side). */
export const SCREEN = 0.6;
const SALT_TARGET = 0x5e47;
const SALT_HUNT = 0x5e49;
/** Hours a fleet that broke off is out of every sea battle (PLAN 4.3c). */
export const BREAK_HOURS = 24;
/** The slack of a reach (km, `inReach`): a micrometre. */
export const REACH_EPS_KM = 1e-9;
const SALT_SUBTICK = 0x5e48;
/**
 * How far a carrier's wings see and strike for its fleet (PLAN 5.4d): this share of the wing's
 * range (`wingRange`; a search out and back and its strike): a naval bomber group's 1,000 km
 * gives 250 km.
 */
export const CARRIER_SPOT_SHARE = 0.25;
/** A carrier's wings strike the enemy's fleets of its battle once in this many hours (their sortie and turn round). */
export const CARRIER_CYCLE = 4;

/** Per fleet, the wings on its carriers with aircraft, and not in the air on a sortie of their own (PLAN 5.4d). */
function carrierWings(world: World): Map<number, number[]> {
  const out = new Map<number, number[]>();
  if (world.wingBase.size === 0) return out;
  for (const [wing, base] of [...world.wingBase].sort((a, b) => a[0] - b[0])) {
    if (base >= 0 || !world.formations.has(wing)) continue;
    const s = world.sorties.get(wing);
    if (s && sortieAt(s, world.tick, loopW(world)).leg !== Leg.Home) continue;
    const list = out.get(-base);
    if (list) list.push(wing);
    else out.set(-base, [wing]);
  }
  return out;
}

/** What the battle reads of a fleet at the hour's start. */
interface FleetFacts {
  id: number;
  nation: number;
  /** Its best ship's detection, km; its least stealthy ship's stealth; its longest gun, km; its pace, km/h. */
  detection: number;
  stealth: number;
  reach: number;
  kmh: number;
  /** Its depth charges (`asw`), the only weapon a submarine is a target of, and their reach (km, the gun's of a ship that has them); and what of it can be hit: a surface ship, a submarine. */
  asw: number;
  aswReach: number;
  surface: boolean;
  submerged: boolean;
}

/** The distance in km between two points (cells) of the map: by the km of a cell at their middle row, the short way round a looping map. */
export function seaKm(world: World, x0: number, y0: number, x1: number, y1: number): number {
  const g = navOf(world).grid;
  const w = world.cells.w;
  let dx = Math.abs(x1 - x0);
  if (world.settings.loopingMap && dx > w / 2) dx = w - dx;
  const row = Math.min(g.h - 1, Math.max(0, Math.floor((y0 + y1) / 2)));
  return hypot(dx * g.kx[row]!, (y1 - y0) * g.ky[row]!);
}

/**
 * The km a fleet closes in an hour on the enemy fleet it closes on, `d` km off (PLAN 7.19a; see the
 * head of the file): by its reach and pace against that fleet, and that fleet's against it. Beyond
 * both reaches both close, together by their two paces and to the longer reach at most, each its
 * share of it by its pace; between the two the fleet of the shorter reach closes by what its pace
 * has over the other's, to its reach at most, and the other holds it off; within its reach, or
 * with no weapon against that fleet, it closes none.
 */
export function closeBy(d: number, reach: number, kmh: number, theirReach: number, theirKmh: number): number {
  if (reach <= 0 || d <= reach) return 0;
  if (d <= theirReach) return Math.min(Math.max(0, kmh - theirKmh), d - reach);
  // They close too where they have a weapon against it: the two together to the longer reach.
  if (theirReach <= 0 || kmh + theirKmh <= 0) return Math.min(kmh, d - reach);
  return (Math.min(kmh + theirKmh, d - Math.max(reach, theirReach)) * kmh) / (kmh + theirKmh);
}

/**
 * Fleet `id` closes `km` on the point (`tx`, `ty`) (PLAN 7.19a): on the straight line where it is
 * water all the way, else along its sea way (`orderSail`, at that pace for the hour). A closing
 * is the battle's, not an order: the fleet is under no way after it (an order it had is dropped).
 */
function closeOn(world: World, id: number, tx: number, ty: number, km: number): void {
  const c = world.formations.cols;
  const { w, h, terrain } = world.cells;
  const x0 = c.x[id]!;
  const y0 = c.y[id]!;
  let dx = tx - x0;
  if (world.settings.loopingMap && Math.abs(dx) > w / 2) dx -= Math.sign(dx) * w;
  const dy = ty - y0;
  const d = seaKm(world, x0, y0, tx, ty);
  if (d <= 0 || km <= 0) return;
  const t = Math.min(1, km / d);
  const steps = Math.max(1, Math.ceil(4 * hypot(dx, dy) * t));
  let clear = true;
  for (let i = 1; i <= steps && clear; i++) {
    const x = x0 + (dx * t * i) / steps;
    const y = y0 + (dy * t * i) / steps;
    const cx = ((Math.floor(x) % w) + w) % w;
    const cy = Math.floor(y);
    if (cy < 0 || cy >= h || isLand(terrain[cy * w + cx]!)) clear = false;
  }
  c.moving[id] = 0;
  world.paths.delete(id);
  if (clear) {
    noteMove(world, id);
    const x = x0 + dx * t;
    c.x[id] = x < 0 ? x + w : x >= w ? x - w : x;
    c.y[id] = y0 + dy * t;
    c.facing[id] = atan2(dy, dx);
    return;
  }
  if (!orderSail(world, id, tx, ty)) return;
  sailStep(world, id, km);
  c.moving[id] = 0;
  world.paths.delete(id);
}

function factsOf(world: World, id: number, els: readonly number[], air: Map<number, number[]>): FleetFacts | null {
  const units = world.rules!.units;
  const ec = world.elements.cols;
  let detection = 0;
  let stealth = Infinity;
  let reach = 0;
  let asw = 0;
  let aswReach = 0;
  let surface = false;
  let submerged = false;
  for (const e of els) {
    if (ec.strength[e]! <= 0) continue;
    const u = units[ec.unit[e]!]!;
    detection = Math.max(detection, u.detection);
    stealth = Math.min(stealth, u.stealth);
    if (u.hard > 0) reach = Math.max(reach, u.rangeKm);
    if (u.torpedo > 0) reach = Math.max(reach, u.torpedoKm);
    asw = Math.max(asw, u.asw);
    if (u.asw > 0) aswReach = Math.max(aswReach, u.rangeKm);
    if (u.cls === 'ss') submerged = true;
    else surface = true;
  }
  if (stealth === Infinity) return null;
  // Its carriers' wings (PLAN 5.4d) see and strike for it as far as the farthest of them reaches.
  for (const wing of air.get(id) ?? []) {
    const km = CARRIER_SPOT_SHARE * wingRange(world, wing);
    detection = Math.max(detection, km);
    reach = Math.max(reach, km);
  }
  // The air over it (PLAN 5.8t2): its side's sees for it, the enemy's keeps it blind.
  const c = world.formations.cols;
  if (world.airPower.size > 0) {
    const s = airSuperiority(world, c.nation[id]!, airOf(world).zoneOf[Math.floor(c.y[id]!) * world.cells.w + Math.floor(c.x[id]!)]!);
    detection *= 1 + AIR_DETECTION * (2 * s - 1);
  }
  const rule = world.rules!.templates[c.template[id]!];
  return { id, nation: c.nation[id]!, detection, stealth, reach, kmh: rule?.speedKmh ?? 0, asw, aswReach, surface, submerged };
}

/**
 * Whether fleets `a` and `b` (of nations at war) are within reach of a ship's weapon of either
 * against the other (PLAN 7.19b): a gun or torpedoes on a surface ship, depth charges on a
 * submarine; not the carriers' wings. The pair a sea battle's row shows is such a pair.
 */
export function inShipReach(world: World, a: number, b: number): boolean {
  const idx = elementIndex(world);
  const none = new Map<number, number[]>();
  const fa = factsOf(world, a, idx.get(a) ?? [], none);
  const fb = factsOf(world, b, idx.get(b) ?? [], none);
  if (!fa || !fb) return false;
  const c = world.formations.cols;
  return inReach(seaKm(world, c.x[a]!, c.y[a]!, c.x[b]!, c.y[b]!), Math.max(reachOn(fa, fb), reachOn(fb, fa)));
}

/**
 * The carrier strike of a battle of `fleets` (PLAN 7.35a): the nearest pair of a fleet whose
 * carriers' wings are aboard and an enemy fleet with a ship on the surface within their reach
 * (`CARRIER_SPOT_SHARE` of the farthest wing's range), as `navalCombatSystem` strikes; null for
 * none. Its battle fights by the wings alone where no ship's weapon reaches (`inShipReach`).
 */
export function strikeTarget(world: World, fleets: readonly number[]): { carrier: number; target: number } | null {
  const air = carrierWings(world);
  if (air.size === 0) return null;
  const c = world.formations.cols;
  const units = world.rules!.units;
  const ec = world.elements.cols;
  const idx = elementIndex(world);
  const surface = (g: number): boolean => (idx.get(g) ?? []).some((e) => ec.strength[e]! > 0 && units[ec.unit[e]!]!.cls !== 'ss');
  let best: { carrier: number; target: number } | null = null;
  let bd = Infinity;
  for (const f of fleets) {
    const wings = air.get(f);
    if (!wings || !world.formations.has(f)) continue;
    let reach = 0;
    for (const wing of wings) reach = Math.max(reach, CARRIER_SPOT_SHARE * wingRange(world, wing));
    for (const g of fleets) {
      if (!world.formations.has(g) || !world.wars.atWar(c.nation[f]!, c.nation[g]!) || !surface(g)) continue;
      const d = seaKm(world, c.x[f]!, c.y[f]!, c.x[g]!, c.y[g]!);
      if (inReach(d, reach) && d < bd) [best, bd] = [{ carrier: f, target: g }, d];
    }
  }
  return best;
}

/** Fleet `id`'s detection this hour, km (PLAN 4.3a; its carriers' wings and the air over it with it): 0 for one with no ship. */
export function fleetDetection(world: World, id: number): number {
  const els = elementIndex(world).get(id);
  return (els && factsOf(world, id, els, carrierWings(world))?.detection) || 0;
}

/**
 * Whether `d` km is within `reach` km (PLAN 7.31, ADR-526): with REACH_EPS_KM over it, as a fleet
 * that closes to its reach (`closeBy`) stands there by a sum of floats; it stood a hair beyond it
 * (12.00000000000062 km off at a reach of 12) and closed and held its fire for 7,164 hours.
 */
export function inReach(d: number, reach: number): boolean {
  return d <= reach + REACH_EPS_KM;
}

/** The reach of fleet `a`'s weapons against fleet `b`, km: on its surface ships, and on its submarines (PLAN 7.19a). */
function reachOn(a: FleetFacts, b: FleetFacts): number {
  return Math.max(b.surface ? a.reach : 0, b.submerged ? a.aswReach : 0);
}

/** Whether a fleet of `a`'s facts has a weapon a ship of `b`'s can be hit by. */
function canHit(a: FleetFacts, b: FleetFacts): boolean {
  return (a.reach > 0 && b.surface) || (a.asw > 0 && b.submerged);
}

/** Fleets in contact, joined into battles (ascending ids), and the nearest distance of a pair in each; sets `engaged`. */
export function findSeaBattles(world: World): { fleets: number[]; km: number }[] {
  const f = world.formations;
  const c = f.cols;
  const idx = elementIndex(world);
  const atWar = world.wars.nations();
  const air = carrierWings(world);
  const facts: FleetFacts[] = [];
  f.forEach((id) => {
    // A fleet that broke off is out of every sea battle while it retreats (PLAN 4.8l), as a land
    // formation is out of every fight (`findBattles`).
    if (!world.isFleet(id) || !atWar.has(c.nation[id]!) || c.retreat[id]! > 0) return;
    const els = idx.get(id);
    const ff = els ? factsOf(world, id, els, air) : null;
    if (ff) facts.push(ff);
  });
  const parent = new Map<number, number>();
  const nearest = new Map<number, number>();
  const find = (a: number): number => {
    let r = a;
    while (parent.get(r) !== r) r = parent.get(r)!;
    return r;
  };
  // By row (PLAN 4.8i): a pair further apart in rows than the most a fleet sees, at the fewest km a
  // row has, cannot see each other. What is found is the same in any order of the pairs (the
  // nearest is a least, a battle's root its least id): only the pairs looked at are fewer.
  const g = navOf(world).grid;
  let minKy = Infinity;
  for (let r = 0; r < g.h; r++) minKy = Math.min(minKy, g.ky[r]!);
  let maxSees = 0;
  for (const ff of facts) maxSees = Math.max(maxSees, ff.detection);
  facts.sort((p, q) => c.y[p.id]! - c.y[q.id]! || p.id - q.id);
  for (let i = 0; i < facts.length; i++) {
    const a = facts[i]!;
    for (let j = i + 1; j < facts.length; j++) {
      const b = facts[j]!;
      if ((c.y[b.id]! - c.y[a.id]!) * minKy > maxSees) break;
      // A battle needs a weapon the other side can be hit by (PLAN 4.8k): a gun or a torpedo for a
      // surface ship, depth charges for a submarine. Two submarine flotillas have none.
      if (!canHit(a, b) && !canHit(b, a)) continue;
      if (!world.wars.atWar(a.nation, b.nation)) continue;
      const km = seaKm(world, c.x[a.id]!, c.y[a.id]!, c.x[b.id]!, c.y[b.id]!);
      const sees = Math.max(a.detection * (1 - b.stealth / 100), b.detection * (1 - a.stealth / 100));
      if (km > sees) continue;
      if (!parent.has(a.id)) parent.set(a.id, a.id);
      if (!parent.has(b.id)) parent.set(b.id, b.id);
      const ra = find(a.id);
      const rb = find(b.id);
      if (ra !== rb) parent.set(ra > rb ? ra : rb, ra > rb ? rb : ra);
      nearest.set(a.id, Math.min(nearest.get(a.id) ?? Infinity, km));
      nearest.set(b.id, Math.min(nearest.get(b.id) ?? Infinity, km));
    }
  }
  const groups = new Map<number, { fleets: number[]; km: number }>();
  for (const id of [...parent.keys()].sort((p, q) => p - q)) {
    const r = find(id);
    let g = groups.get(r);
    if (!g) groups.set(r, (g = { fleets: [], km: Infinity }));
    g.fleets.push(id);
    g.km = Math.min(g.km, nearest.get(id)!);
    c.engaged[id] = 1;
  }
  return [...groups.values()].sort((p, q) => p.fleets[0]! - q.fleets[0]!);
}

/** Live ships of fleet `id` (0 for one that is gone). */
function shipsOf(world: World, id: number): number {
  if (!world.formations.has(id)) return 0;
  const ec = world.elements.cols;
  let n = 0;
  for (const e of elementIndex(world).get(id) ?? []) if (ec.strength[e]! > 0) n += ec.strength[e]!;
  return n;
}

/** The ships a side packs into a `SeaBattle` row with its nation (`seaSide`, shared/history). */
function side(nation: number, ships: number): number {
  return nation + SIDE_SHIPS * Math.min(ships, SIDE_SHIPS - 1);
}

/** A sea battle is over: its row in the log, and its record gone. */
function endBattle(world: World, rec: SeaBattle): void {
  world.out.emit(world.tick, EventKind.SeaBattle, side(rec.a, rec.lostA), side(rec.b, rec.lostB), rec.x, rec.y);
  world.seaBattles.splice(world.seaBattles.indexOf(rec), 1);
}

/**
 * Fleet `id` breaks off (PLAN 4.3c): out of every sea battle for `BREAK_HOURS` (its `retreat`,
 * which the retreat system counts down), and sails for the nearest port its nation holds that a
 * ship reaches; it stands where it is with none.
 */
function breakOff(world: World, id: number): void {
  const c = world.formations.cols;
  const n = c.nation[id]!;
  c.retreat[id] = BREAK_HOURS;
  c.engaged[id] = 0;
  world.out.emit(world.tick, EventKind.FormationRetreated, id, n, c.x[id]!, c.y[id]!);
  // Driven off: a placed fleet holds its place no more (PLAN 7.22c).
  world.station.delete(id);
  sailHome(world, id);
}

/**
 * The water of the port nearest to fleet `id` that its nation holds and a ship reaches, or -1:
 * one in the basin of the fleet's water (`basinOf`, PLAN 4.8o; the world's seas where the fleet
 * stands on no zone), not a port across land on a lake.
 */
export function nearestOwnPort(world: World, id: number): number {
  const c = world.formations.cols;
  const n = c.nation[id]!;
  const water = portSeaOf(world);
  const sea = seaOf(world);
  const { w, h } = world.cells;
  const { basin, ocean } = basinOf(world);
  const here = nearestCellWhere((k) => sea.zoneOf[k] !== 0, c.x[id]!, c.y[id]!, w, h, world.atSize(AT_PORT_CELLS), world.settings.loopingMap);
  const mine = here >= 0 && basin[sea.zoneOf[here]!] !== 0 ? basin[sea.zoneOf[here]!]! : ocean;
  let best = -1;
  let bd = Infinity;
  world.ports.forEach((p, i) => {
    const at = water[i]!;
    if (world.cells.controller[p.cell] !== n || at < 0 || basin[sea.zoneOf[at]!] !== mine) return;
    const d = seaKm(world, c.x[id]!, c.y[id]!, (at % w) + 0.5, Math.floor(at / w) + 0.5);
    if (d < bd) {
      bd = d;
      best = at;
    }
  });
  return best;
}

/**
 * Whether fleet `id` stands at the port it would sail for (`nearestOwnPort`, within
 * `AT_PORT_CELLS`; PLAN 7.31): a fleet has nowhere to break off to there.
 */
export function atOwnPort(world: World, id: number): boolean {
  const at = nearestOwnPort(world, id);
  if (at < 0) return false;
  const c = world.formations.cols;
  const w = world.cells.w;
  let dx = Math.abs((at % w) - Math.floor(c.x[id]!));
  if (world.settings.loopingMap && dx > w / 2) dx = w - dx;
  return dx <= world.atSize(AT_PORT_CELLS) && Math.abs(Math.floor(at / w) - Math.floor(c.y[id]!)) <= world.atSize(AT_PORT_CELLS);
}

/** Fleet `id` sails for `nearestOwnPort`; it stands where it is with none, or with no way to it. */
export function sailHome(world: World, id: number): boolean {
  const at = nearestOwnPort(world, id);
  const w = world.cells.w;
  return at >= 0 && orderSail(world, id, (at % w) + 0.5, Math.floor(at / w) + 0.5);
}

/** How near, in cells, a fleet stands to a port to be at it: the start's fleets stand up to 3 cells from their base's water (PLAN 4.2b). */
export const AT_PORT_CELLS = 3;

/**
 * A fleet at a base its nation has lost (PLAN 4.4e): daily, a fleet that stands (not under way,
 * not in a sea battle) with a port held by a nation at war with it within `AT_PORT_CELLS` of it,
 * and no port its nation holds there, sails for its nation's nearest port (`sailHome`).
 */
export function rebaseFleets(world: World): void {
  const f = world.formations;
  const c = f.cols;
  f.forEach((id) => {
    // A fleet the editor placed holds its place (PLAN 7.22c).
    if (!world.isFleet(id) || c.moving[id] === 1 || c.engaged[id] === 1 || world.station.has(id)) return;
    if (atLostBase(world, id)) sailHome(world, id);
  });
}

/**
 * Whether fleet `id` is at a base its nation has lost: a port its nation owns, held by a nation
 * at war with it, within `AT_PORT_CELLS`, and none its nation holds. An enemy's own port is no
 * lost base: a fleet sent to an enemy's coast stays there (PLAN 4.5c).
 */
export function atLostBase(world: World, id: number): boolean {
  const c = world.formations.cols;
  const water = portSeaOf(world);
  const { w } = world.cells;
  const ctl = world.cells.controller;
  const n = c.nation[id]!;
  const cell = Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!);
  let lost = false;
  let own = false;
  world.ports.forEach((p, i) => {
    const at = water[i]!;
    if (at < 0) return;
    let dx = Math.abs((at % w) - (cell % w));
    if (world.settings.loopingMap && dx > w / 2) dx = w - dx;
    if (dx > world.atSize(AT_PORT_CELLS) || Math.abs(Math.floor(at / w) - Math.floor(cell / w)) > world.atSize(AT_PORT_CELLS)) return;
    const holder = ctl[p.cell]!;
    if (holder === n) own = true;
    else if (holder !== 0 && world.cells.owner[p.cell] === n && world.wars.atWar(holder, n)) lost = true;
  });
  return lost && !own;
}

export function navalCombatSystem(world: World): void {
  const groups = findSeaBattles(world);
  const records = world.seaBattles;
  if (groups.length === 0 && records.length === 0) return;
  const seen = new Set<SeaBattle>();
  const units = world.rules!.units;
  const f = world.formations.cols;
  const e = world.elements;
  const ec = e.cols;
  const idx = elementIndex(world);
  const fires = world.out.fires;
  const bf = world.buffs;
  const air = carrierWings(world);
  for (const battle of groups) {
    // Its record: the first that has one of its fleets; another that has one is merged into it.
    const mine = records.filter((rec) => rec.fleets.some((id) => battle.fleets.includes(id)));
    let rec = mine[0];
    const fresh = rec === undefined;
    if (!rec) {
      const a = f.nation[battle.fleets[0]!]!;
      const b = f.nation[battle.fleets.find((o) => world.wars.atWar(a, f.nation[o]!))!]!;
      rec = { fleets: [], ships: [], range: battle.km, a, b, lostA: 0, lostB: 0, x: f.x[battle.fleets[0]!]!, y: f.y[battle.fleets[0]!]! };
      records.push(rec);
    }
    for (const other of mine.slice(1)) {
      const same = !world.wars.atWar(rec.a, other.a);
      rec.lostA += same ? other.lostA : other.lostB;
      rec.lostB += same ? other.lostB : other.lostA;
      other.fleets.forEach((id, k) => {
        rec.fleets.push(id);
        rec.ships.push(other.ships[k]!);
      });
      records.splice(records.indexOf(other), 1);
    }
    // Its fleets are this hour's: one that left or is gone is out, one that came in is counted in.
    const entry = new Map(rec.fleets.map((id, k) => [id, rec.ships[k]!]));
    rec.fleets = battle.fleets.slice();
    rec.ships = rec.fleets.map((id) => entry.get(id) ?? shipsOf(world, id));
    seen.add(rec);
    const first = rec.a;
    // The two sides' reach (for who breaks off), and each fleet's facts at the hour's start.
    let reachA = 0;
    let reachB = 0;
    const facts = new Map<number, FleetFacts>();
    for (const id of battle.fleets) {
      const ff = factsOf(world, id, idx.get(id)!, air)!;
      facts.set(id, ff);
      if (world.wars.atWar(first, ff.nation)) reachB = Math.max(reachB, ff.reach);
      else reachA = Math.max(reachA, ff.reach);
    }
    // The closing (PLAN 7.19a): from its second hour each fleet out of reach of every enemy fleet
    // of the battle it can hit closes on the nearest of them (`closeBy`), all from where they
    // stood at the hour's start.
    if (!fresh) {
      const moves: [number, number, number, number][] = [];
      for (const id of battle.fleets) {
        const a = facts.get(id)!;
        let near: FleetFacts | null = null;
        let nd = Infinity;
        let within = false;
        for (const o of battle.fleets) {
          const b = facts.get(o)!;
          if (!world.wars.atWar(a.nation, b.nation) || reachOn(a, b) <= 0) continue;
          const d = seaKm(world, f.x[id]!, f.y[id]!, f.x[o]!, f.y[o]!);
          if (inReach(d, reachOn(a, b))) within = true;
          if (d < nd) [near, nd] = [b, d];
        }
        if (within || !near) continue;
        // A fleet of submarines closes under water: the other does not see it coming to hold it off.
        const km = closeBy(nd, reachOn(a, near), a.kmh, reachOn(near, a), a.surface ? near.kmh : 0);
        if (km > 0) moves.push([id, f.x[near.id]!, f.y[near.id]!, km]);
      }
      for (const [id, tx, ty, km] of moves) closeOn(world, id, tx, ty, km);
    }
    // The range of the hour: its nearest two fleets at war with each other.
    const kmTo = new Map<number, number>();
    const km = (p: number, q: number): number => {
      const key = p < q ? p * 67108864 + q : q * 67108864 + p;
      let v = kmTo.get(key);
      if (v === undefined) kmTo.set(key, (v = seaKm(world, f.x[p]!, f.y[p]!, f.x[q]!, f.y[q]!)));
      return v;
    };
    let r = Infinity;
    for (const p of battle.fleets) for (const q of battle.fleets) if (p < q && world.wars.atWar(f.nation[p]!, f.nation[q]!)) r = Math.min(r, km(p, q));
    rec.range = r;
    const before = new Map(battle.fleets.map((id) => [id, shipsOf(world, id)]));
    // Each fleet's nation at the hour's start: a fleet sunk whole in it is gone, its column cleared,
    // and its last ships were counted to the other side (PLAN 7.31's check, ADR-527).
    const nationOf = new Map(battle.fleets.map((id) => [id, f.nation[id]!]));

    const pending = new Map<number, number>();
    // Each side's screen: its destroyers and its other surface ships alive at the hour's start.
    const screenOf = new Map<number, number>();
    const screen = (n: number): number => {
      let v = screenOf.get(n);
      if (v === undefined) {
        let dd = 0;
        let big = 0;
        for (const o of battle.fleets) {
          if (world.wars.atWar(n, f.nation[o]!)) continue;
          for (const el of idx.get(o)!) {
            if (ec.strength[el]! <= 0) continue;
            const cls = units[ec.unit[el]!]!.cls;
            if (cls === 'dd') dd++;
            else if (cls !== 'ss') big++;
          }
        }
        screenOf.set(n, (v = big === 0 ? 1 : 1 - SCREEN * Math.min(1, dd / big)));
      }
      return v;
    };
    for (const sf of battle.fleets) {
      const n = f.nation[sf]!;
      const enemies = battle.fleets.filter((o) => world.wars.atWar(n, f.nation[o]!));
      const buffAtk = Math.max(0, 1 + bf.sum('attack', 'nation', n) + bf.sum('attack', 'formation', sf));
      // The enemy's ships by weight (hit points), on the surface or under water, in the fleets
      // within `reach` km of this one (PLAN 7.19a: a weapon reaches the fleet it fires at).
      const tables = new Map<number, { cand: number[]; cum: number[]; total: number }>();
      const tableOf = (sub: boolean, reach: number): { cand: number[]; cum: number[]; total: number } => {
        const key = sub ? -1 - reach : reach;
        let table = tables.get(key);
        if (!table) {
          const cand: number[] = [];
          const cum: number[] = [];
          let total = 0;
          for (const tf of enemies) {
            if (!inReach(km(sf, tf), reach)) continue;
            for (const tid of idx.get(tf) ?? []) {
              if (ec.strength[tid]! <= 0 || (units[ec.unit[tid]!]!.cls === 'ss') !== sub) continue;
              total += units[ec.unit[tid]!]!.hpPerUnit * ec.strength[tid]!;
              cand.push(tid);
              cum.push(total);
            }
          }
          tables.set(key, (table = { cand, cum, total }));
        }
        return table;
      };
      const pick = (table: { cand: number[]; cum: number[]; total: number }, s: number, salt: number): number => {
        if (table.total <= 0) return 0;
        const u = hashToUnit(hash32(world.seed, world.tick, s, salt)) * table.total;
        let lo = 0;
        let hi = table.cand.length - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (table.cum[mid]! > u) hi = mid;
          else lo = mid + 1;
        }
        return table.cand[lo]!;
      };
      // `torpedo`: the record's weapon field is −1 − the unit type (PLAN 4.7c: the view draws its track).
      const volley = (s: number, t: number, dmg: number, torpedo = false): void => {
        if (dmg <= 0) return;
        const tf = ec.formation[t]!;
        pending.set(t, (pending.get(t) ?? 0) + dmg);
        const [x0, y0] = elementPlace(world, sf, ec.slot[s]!, slotCount(world, sf, idx.get(sf)!.length), s);
        const [x1, y1] = elementPlace(world, tf, ec.slot[t]!, slotCount(world, tf, idx.get(tf)!.length), t);
        fires.push(world.tick, hash32(world.seed, world.tick, s, SALT_SUBTICK) % 60, s, t, torpedo ? -1 - ec.unit[s]! : ec.unit[s]!, dmg, x0, y0, x1, y1);
      };
      const defOf = (t: number): number => {
        const tf = ec.formation[t]!;
        return Math.max(0.05, 1 + bf.sum('defense', 'nation', f.nation[tf]!) + bf.sum('defense', 'formation', tf));
      };
      for (const s of idx.get(sf)!) {
        if (ec.strength[s]! <= 0) continue;
        const us = units[ec.unit[s]!]!;
        const full = (ec.strength[s]! / us.size) * SEA_FIRE_SCALE * buffAtk;
        const gunKm = us.hard > 0 ? us.rangeKm : 0;
        const torpedoKm = us.torpedo > 0 ? us.torpedoKm : 0;
        const reach = Math.max(gunKm, torpedoKm);
        if (reach > 0) {
          // A target on the surface in a fleet within its reach, kept while it lives, is the
          // enemy's and is within its reach.
          let t = ec.target[s]!;
          const valid = t !== 0 && e.has(t) && ec.strength[t]! > 0 && enemies.includes(ec.formation[t]!) && units[ec.unit[t]!]!.cls !== 'ss' && inReach(km(sf, ec.formation[t]!), reach);
          if (valid && ec.cooldown[s]! > 0) {
            ec.cooldown[s] = ec.cooldown[s]! - 1;
          } else {
            t = pick(tableOf(false, reach), s, SALT_TARGET);
            ec.target[s] = t;
            ec.cooldown[s] = COOLDOWN;
          }
          if (t !== 0) {
            const ut = units[ec.unit[t]!]!;
            const d = km(sf, ec.formation[t]!);
            if (gunKm > 0 && inReach(d, gunKm)) volley(s, t, (us.hard * (ut.armor > us.piercing ? ARMOR_PEN : 1) * full) / defOf(t) / ut.hpPerUnit);
            if (torpedoKm > 0 && inReach(d, torpedoKm)) volley(s, t, (us.torpedo * full * (ut.cls === 'dd' ? 1 : screen(f.nation[ec.formation[t]!]!))) / defOf(t) / ut.hpPerUnit, true);
          }
        }
        if (us.asw > 0) {
          // Depth charges at a submarine of the enemy within its guns' reach.
          const t = pick(tableOf(true, us.rangeKm), s, SALT_HUNT);
          if (t !== 0) volley(s, t, (us.asw * full) / defOf(t) / units[ec.unit[t]!]!.hpPerUnit);
        }
      }
      // Its carriers' wings (PLAN 5.4d): once in CARRIER_CYCLE hours, each wing that reaches the
      // range strikes the enemy's surface ships of the battle, as a naval strike does (`strikes`):
      // its aircraft × `shipEffectiveness` × NAVAL_STRIKE_FIRE, spread by the ships' hit points.
      if (world.tick % CARRIER_CYCLE === 0) {
        for (const wing of air.get(sf) ?? []) {
          const table = tableOf(false, CARRIER_SPOT_SHARE * wingRange(world, wing));
          if (table.total <= 0) continue;
          // Its bombs on the fleets it strikes, for the page (PLAN 7.35a; as a strike's, PLAN 5.9):
          // about each fleet at T0 to T2, on its ships as drawn at T3. Events, not state.
          for (const g of new Set(table.cand.map((t) => ec.formation[t]!))) {
            world.out.emit(world.tick, EventKind.StrikeHit, g, wing, f.x[g]!, f.y[g]!);
            world.out.emit(world.tick, EventKind.AirStrike, wing, 0, f.x[g]!, f.y[g]!);
          }
          for (const s of idx.get(wing) ?? []) {
            if (ec.strength[s]! <= 0) continue;
            const us = units[ec.unit[s]!]!;
            for (const t of table.cand) {
              const ut = units[ec.unit[t]!]!;
              const share = (ut.hpPerUnit * ec.strength[t]!) / table.total;
              const dmg = (ec.strength[s]! * shipEffectiveness(us, ut) * NAVAL_STRIKE_FIRE * buffAtk * share) / defOf(t) / ut.hpPerUnit;
              if (dmg > 0) pending.set(t, (pending.get(t) ?? 0) + dmg);
            }
          }
        }
      }
    }
    // The fleets under fire this hour (PLAN 7.31): one with no weapon breaks off only once hit.
    const hit = new Set<number>();
    for (const t of pending.keys()) hit.add(ec.formation[t]!);
    for (const t of [...pending.keys()].sort((p, q) => p - q)) applyLoss(world, t, pending.get(t)!);
    for (const id of battle.fleets) {
      settleFormation(world, id);
      const lost = before.get(id)! - shipsOf(world, id);
      if (world.wars.atWar(first, nationOf.get(id)!)) rec.lostB += lost;
      else rec.lostA += lost;
    }
    // Who breaks off, away from its port (PLAN 7.31, ADR-526): a fleet under half the ships it came
    // in with, or with no weapon against an enemy that has one once it is under fire. Until then
    // one with no weapon broke off at once, in the battle's first hour, before any enemy could
    // close, and either at its port: it sailed for the port it stood at, sat out its BREAK_HOURS
    // there and was found again, a battle a day that sank nothing.
    const reachOf = (id: number): number => (world.formations.has(id) ? (factsOf(world, id, idx.get(id) ?? [], air)?.reach ?? 0) : 0);
    const out = new Set<number>();
    rec.fleets.forEach((id, k) => {
      if (!world.formations.has(id)) return void out.add(id);
      const theirs = world.wars.atWar(first, f.nation[id]!) ? reachA : reachB;
      if ((2 * shipsOf(world, id) < rec.ships[k]! || (reachOf(id) === 0 && theirs > 0 && hit.has(id))) && !atOwnPort(world, id)) {
        breakOff(world, id);
        out.add(id);
      }
    });
    rec.ships = rec.ships.filter((_, k) => !out.has(rec.fleets[k]!));
    rec.fleets = rec.fleets.filter((id) => !out.has(id));
    // With no fleet of one side left in it, it is over now.
    const sideA = rec.fleets.some((id) => !world.wars.atWar(first, f.nation[id]!));
    const sideB = rec.fleets.some((id) => world.wars.atWar(first, f.nation[id]!));
    if (!sideA || !sideB) {
      for (const id of rec.fleets) f.engaged[id] = 0;
      endBattle(world, rec);
      seen.delete(rec);
    }
  }
  // A battle with no contact this hour is over.
  for (const rec of [...records]) if (!seen.has(rec)) endBattle(world, rec);
}

/**
 * The flights of the carriers' strikes (PLAN 4.12b), for the page: derived from the state, never
 * stored, as `sortieAt` is. A carrier's wing in reach of its battle's range strikes once in
 * CARRIER_CYCLE hours (`navalCombatSystem`), at once; its flight is drawn as a sortie that is over
 * its target at that hour: from its fleet to the nearest enemy fleet of the battle with a ship on
 * the surface, at its template's speed, and back. The strikes of the cycle's hour just gone (the
 * flight home) and of the next (the flight out). A battle's first strike may come after the hour
 * just gone: its flight home is drawn all the same (the record keeps no first hour). Reads only.
 */
export function carrierStrikes(world: World): { wing: number; nation: number; sortie: Sortie }[] {
  const out: { wing: number; nation: number; sortie: Sortie }[] = [];
  if (world.seaBattles.length === 0 || !world.rules) return out;
  const rules = world.rules;
  const air = carrierWings(world);
  const c = world.formations.cols;
  const ec = world.elements.cols;
  const idx = elementIndex(world);
  const afloat = (id: number): boolean => (idx.get(id) ?? []).some((e) => ec.strength[e]! > 0 && rules.units[ec.unit[e]!]!.cls !== 'ss');
  const last = world.tick - (world.tick % CARRIER_CYCLE);
  for (const rec of world.seaBattles) {
    for (const sf of rec.fleets) {
      const wings = air.get(sf);
      if (!wings || !world.formations.has(sf)) continue;
      let target = -1;
      let km = Infinity;
      for (const o of rec.fleets) {
        if (!world.formations.has(o) || !world.wars.atWar(c.nation[sf]!, c.nation[o]!) || !afloat(o)) continue;
        const d = seaKm(world, c.x[sf]!, c.y[sf]!, c.x[o]!, c.y[o]!);
        if (d < km) [target, km] = [o, d];
      }
      if (target < 0) continue;
      for (const wing of wings) {
        const kmh = rules.templates[c.template[wing]!]?.speedKmh ?? 0;
        if (kmh <= 0 || CARRIER_SPOT_SHARE * wingRange(world, wing) < km) continue;
        const hours = km / kmh;
        for (const strike of [last, last + CARRIER_CYCLE]) {
          if (strike - hours > world.tick || strike + hours < world.tick - 1) continue;
          out.push({ wing, nation: c.nation[wing]!, sortie: { bx: c.x[sf]!, by: c.y[sf]!, tx: c.x[target]!, ty: c.y[target]!, launch: strike - hours, kmh, km, over: 0 } });
        }
      }
    }
  }
  return out;
}
