/**
 * Air combat (PLAN 5.3a, SPEC §6.3): each hour, the sorties of nations at war in one air zone fire
 * on each other, at element level: a squadron's fire is its aircraft × its air attack (`aa`) ×
 * `AIR_FIRE`, over the target's defence (`defense`), in hit points; the target's squadrons lose
 * that ÷ their `hpPerUnit` in aircraft, carried as on the land (`applyLoss`). All fire of the
 * hour is reckoned before any loss. A wing with no aircraft left is lost; a sortie that lost a
 * quarter of its aircraft in the hour turns home from where it is. Then AA (PLAN 5.3b,
 * `antiAir`): what is below a sortie of an enemy's fires on it.
 */
import { EventKind } from '../../shared/events';
import { Domain, type UnitRule, type World } from '../world';
import { applyLoss, elementIndex, settleFormation } from './elements';
import { seaKm } from './navalCombat';
import { bombIndustry } from './bombing';
import { ARMOR_PEN, effectiveness } from './combat';
import { Leg, legHours, sortieAt } from './sorties';

/** The share of an aircraft's air attack that is hit points on a target of defence 1 in an hour. */
export const AIR_FIRE = 0.25;
/** The share of its aircraft a sortie loses in an hour's fight that turns it home. */
export const BREAK_OFF = 0.25;

/** The aircraft of wing `id` (its squadrons' strength). */
export function aircraftOf(world: World, id: number): number {
  const ec = world.elements.cols;
  return (elementIndex(world).get(id) ?? []).reduce((s, e) => s + ec.strength[e]!, 0);
}

/**
 * The hour's air fights, over the sorties in the air by zone (`airborne`). Each zone's wings of
 * nations at war with one another fight; a wing's fire is spread over the enemy wings there by
 * their aircraft, and within a wing over its squadrons by theirs. Emits `AirBattle` per zone
 * fought in.
 */
export function airCombat(world: World, byZone: Map<number, number[]>): void {
  const rules = world.rules!;
  const ec = world.elements.cols;
  const fc = world.formations.cols;
  const index = elementIndex(world);
  const loss = new Map<number, number>(); // element → aircraft lost this hour
  const before = new Map<number, number>();
  const fought: { zone: number; wings: number[] }[] = [];
  for (const [zone, wings] of [...byZone].sort((a, b) => a[0] - b[0])) {
    if (wings.length < 2) continue;
    let any = false;
    for (const a of wings) {
      const foes = wings.filter((b) => world.wars.atWar(fc.nation[a]!, fc.nation[b]!));
      if (foes.length === 0) continue;
      any = true;
      const foeAircraft = foes.map((b) => aircraftOf(world, b));
      const total = foeAircraft.reduce((s, n) => s + n, 0);
      if (total === 0) continue;
      for (const e of index.get(a) ?? []) {
        const fire = ec.strength[e]! * rules.units[ec.unit[e]!]!.aa * AIR_FIRE;
        if (fire === 0) continue;
        foes.forEach((b, k) => {
          const share = (fire * foeAircraft[k]!) / total;
          for (const t of index.get(b) ?? []) {
            if (ec.strength[t] === 0) continue;
            const u = rules.units[ec.unit[t]!]!;
            const hp = (share * ec.strength[t]!) / foeAircraft[k]! / Math.max(1, u.defense);
            loss.set(t, (loss.get(t) ?? 0) + hp / u.hpPerUnit);
          }
        });
      }
    }
    if (!any) continue;
    for (const id of wings) before.set(id, aircraftOf(world, id));
    fought.push({ zone, wings });
  }
  if (loss.size === 0) return;
  for (const [e, units] of [...loss].sort((a, b) => a[0] - b[0])) applyLoss(world, e, units);
  for (const { zone, wings } of fought) {
    let lost = 0;
    let x = 0;
    let y = 0;
    for (const id of wings) {
      const was = before.get(id)!;
      const now = aircraftOf(world, id);
      lost += was - now;
      const s = world.sorties.get(id);
      const p = s && sortieAt(s, world.tick, world.cells.w);
      if (p) [x, y] = [p.x, p.y];
      settleFormation(world, id);
      if (!world.formations.has(id) || now === 0) continue;
      if (p && p.leg !== Leg.Back && was - now >= BREAK_OFF * was) turnHome(world, id);
    }
    world.out.emit(world.tick, EventKind.AirBattle, zone, lost, x, y);
  }
}

/**
 * Sortie of wing `id` turns home from where it is now: a sortie of its own to here, with no time
 * over it, launched so that now is its turn (its flight stays a function of its launch).
 */
function turnHome(world: World, id: number): void {
  const s = world.sorties.get(id)!;
  const p = sortieAt(s, world.tick, world.cells.w);
  const km = seaKm(world, s.bx, s.by, p.x, p.y);
  world.sorties.set(id, { bx: s.bx, by: s.by, tx: p.x, ty: p.y, launch: world.tick - (s.kmh > 0 ? km / s.kmh : 0), kmh: s.kmh, km, over: 0 });
}

/**
 * AA hit points an hour of a full land or sea element per point of its `aa` (PLAN 5.3b), on a
 * target of defence 1. Its fire is `aa` × its strength ÷ its size × this, as a land element's
 * fire is (combat.ts): per full element, where an aircraft's is per aircraft.
 */
export const AA_FIRE = 2;
/** How far, cells, the AA of a formation reaches a sortie overhead (each way, a square). */
export const AA_CELLS = 1;

/**
 * The hour's AA (PLAN 5.3b): each sortie in the air (out, over its target or back) is fired on by
 * the elements of the formations of nations at war with its own within `AA_CELLS` of its place,
 * land and fleets alike (not other wings, not what is aboard a fleet). A formation's fire is
 * spread over the sorties it reaches by their aircraft, and within a wing over its squadrons, as
 * in the air. Losses carried; a wing with none left is lost.
 */
export function antiAir(world: World): void {
  if (world.sorties.size === 0) return;
  const rules = world.rules!;
  const ec = world.elements.cols;
  const fc = world.formations.cols;
  const w = world.cells.w;
  const h = world.cells.h;
  const index = elementIndex(world);
  // The sorties overhead by cell.
  const above = new Map<number, number[]>();
  for (const [id, s] of [...world.sorties].sort((a, b) => a[0] - b[0])) {
    if (!world.formations.has(id)) continue;
    const p = sortieAt(s, world.tick, w);
    if (p.leg === Leg.Home) continue;
    const cell = Math.min(h - 1, Math.floor(p.y)) * w + Math.floor(p.x);
    const list = above.get(cell);
    if (list) list.push(id);
    else above.set(cell, [id]);
  }
  if (above.size === 0) return;
  const loss = new Map<number, number>();
  world.formations.forEach((g) => {
    if (world.isWing(g) || world.embarked.has(g)) return;
    const gx = Math.floor(fc.x[g]!);
    const gy = Math.floor(fc.y[g]!);
    const targets: number[] = [];
    for (let dy = -AA_CELLS; dy <= AA_CELLS; dy++) {
      const y = gy + dy;
      if (y < 0 || y >= h) continue;
      for (let dx = -AA_CELLS; dx <= AA_CELLS; dx++) {
        const x = (((gx + dx) % w) + w) % w;
        for (const id of above.get(y * w + x) ?? []) if (world.wars.atWar(fc.nation[g]!, fc.nation[id]!)) targets.push(id);
      }
    }
    if (targets.length === 0) return;
    let fire = 0;
    for (const e of index.get(g) ?? []) {
      const u = rules.units[ec.unit[e]!]!;
      fire += (u.aa * ec.strength[e]! * AA_FIRE) / u.size;
    }
    if (fire === 0) return;
    targets.sort((a, b) => a - b);
    const total = targets.reduce((s, id) => s + aircraftOf(world, id), 0);
    if (total === 0) return;
    targets.forEach((id) => {
      for (const t of index.get(id) ?? []) {
        if (ec.strength[t] === 0) continue;
        const u = rules.units[ec.unit[t]!]!;
        const hp = (fire * ec.strength[t]!) / total / Math.max(1, u.defense);
        loss.set(t, (loss.get(t) ?? 0) + hp / u.hpPerUnit);
      }
    });
  });
  if (loss.size === 0) return;
  const hit = new Set<number>();
  for (const [e, units] of [...loss].sort((a, b) => a[0] - b[0])) {
    applyLoss(world, e, units);
    hit.add(ec.formation[e]!);
  }
  for (const id of [...hit].sort((a, b) => a - b)) settleFormation(world, id);
}

/**
 * Target units an hour of an aircraft per point of its soft or hard attack, a strike's fire
 * (PLAN 5.4b), before the target's `hpPerUnit`: per aircraft, as its air attack is.
 */
export const STRIKE_FIRE = 0.2;
/**
 * Hit points an hour of an aircraft per point of its hard attack on a ship, a naval strike's
 * fire (PLAN 5.4c): a bomb or torpedo on a ship counts in full, where on the land the fire is
 * spread over men in cover (`STRIKE_FIRE`).
 */
export const NAVAL_STRIKE_FIRE = 1;

/** An aircraft's fire on a ship, per point of `NAVAL_STRIKE_FIRE`: its hard attack, halved where the ship's armour beats its piercing. */
export function shipEffectiveness(us: UnitRule, ut: UnitRule): number {
  return ut.armor > us.piercing ? us.hard * ARMOR_PEN : us.hard;
}

/**
 * The hour's strikes (PLAN 5.4b, CAS and tactical bombing): a wing on a strike mission whose
 * sortie reaches its target in this hour (it is there in (tick − 1, tick]) fires once on the
 * elements of the formations of nations at war with its own within `AA_CELLS` of the target:
 * the land's and fleets' (PLAN 5.4c), not wings, nor what is aboard. Each squadron's fire is its aircraft × its
 * `effectiveness` on the target (soft, or hard on armour, halved where armour beats piercing)
 * × `STRIKE_FIRE`, on a ship its `shipEffectiveness` × `NAVAL_STRIKE_FIRE`, spread over the
 * elements by their health (strength × hp, as a land element
 * picks its targets), in units lost: ÷ the target's `hpPerUnit`; carried as on the land. Run
 * before the hour's air fights, so a sortie turned home in them strikes nothing. Emits
 * `AirStrike` per strike that found a target.
 */
export function strikes(world: World): void {
  if (world.sorties.size === 0) return;
  const rules = world.rules!;
  const ec = world.elements.cols;
  const fc = world.formations.cols;
  const w = world.cells.w;
  const h = world.cells.h;
  const index = elementIndex(world);
  for (const [id, s] of [...world.sorties].sort((a, b) => a[0] - b[0])) {
    const m = world.wingMission.get(id);
    if (!m || m.kind !== 'strike' || s.tx !== m.x || s.ty !== m.y || !world.formations.has(id)) continue;
    const arrive = s.launch + legHours(s);
    if (!(arrive > world.tick - 1 && arrive <= world.tick)) continue;
    const tx = Math.floor(s.tx);
    const ty = Math.floor(s.ty);
    const targets: number[] = [];
    world.formations.forEach((g) => {
      // The land's formations, and fleets (PLAN 5.4c); not wings, nor what is aboard a fleet.
      if (world.isWing(g) || world.embarked.has(g) || !world.wars.atWar(fc.nation[id]!, fc.nation[g]!)) return;
      let dx = Math.abs(Math.floor(fc.x[g]!) - tx);
      if (dx > w / 2) dx = w - dx;
      const dy = Math.abs(Math.min(h - 1, Math.floor(fc.y[g]!)) - ty);
      if (dx > AA_CELLS || dy > AA_CELLS) return;
      // A submarine is under water: no strike's target, as no gun's (PLAN 5.6 found it sunk from the air).
      for (const e of index.get(g) ?? []) if (ec.strength[e]! > 0 && rules.units[ec.unit[e]!]!.cls !== 'ss') targets.push(e);
    });
    // Its bombs on the industry there (PLAN 5.5a), whether or not an enemy's formation is.
    const tons = bombIndustry(world, id, s.tx, s.ty);
    if (targets.length === 0) {
      if (tons > 0) world.out.emit(world.tick, EventKind.AirStrike, id, 0, s.tx, s.ty);
      continue;
    }
    targets.sort((a, b) => a - b);
    const health = targets.map((t) => ec.strength[t]! * rules.units[ec.unit[t]!]!.hpPerUnit);
    const total = health.reduce((a, b) => a + b, 0);
    const loss = new Map<number, number>();
    for (const e of index.get(id) ?? []) {
      const us = rules.units[ec.unit[e]!]!;
      targets.forEach((t, k) => {
        const ut = rules.units[ec.unit[t]!]!;
        const fire = ut.domain === Domain.sea ? shipEffectiveness(us, ut) * NAVAL_STRIKE_FIRE : effectiveness(us, ut) * STRIKE_FIRE;
        const units = (ec.strength[e]! * fire * health[k]!) / total / ut.hpPerUnit;
        if (units > 0) loss.set(t, (loss.get(t) ?? 0) + units);
      });
    }
    let took = 0;
    const hit = new Set<number>();
    for (const [t, units] of loss) {
      took += applyLoss(world, t, units);
      hit.add(ec.formation[t]!);
    }
    for (const g of [...hit].sort((a, b) => a - b)) settleFormation(world, g);
    world.out.emit(world.tick, EventKind.AirStrike, id, took, s.tx, s.ty);
  }
}
