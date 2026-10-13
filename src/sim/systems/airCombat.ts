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
import type { World } from '../world';
import { applyLoss, elementIndex, settleFormation } from './elements';
import { seaKm } from './navalCombat';
import { Leg, sortieAt } from './sorties';

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
