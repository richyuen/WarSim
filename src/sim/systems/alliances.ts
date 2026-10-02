/**
 * Alliance dynamics (SPEC §3.5, PLAN 1.17), monthly (00:00 of day 1):
 *   unity += SHARED_WAR_UNITY × (wars with ≥ 2 members on one side) + MEMBER_UNITY × (members − 1)
 *            − UNITY_DECAY, clamped to 0..100
 *   loyalty += LOYALTY_PULL × (unity − loyalty) for every member
 * A member (not the leader) whose loyalty is below LEAVE_LOYALTY leaves; an alliance left with
 * fewer than two members dissolves. Unity ≥ UNION_AT makes it a union; below UNION_LOST it is
 * an alliance again. Events: AllianceLeft, AllianceDissolved, UnionFormed.
 */
import { isMonthStart } from '../../shared/calendar';
import { EventKind } from '../../shared/events';
import type { Alliance } from '../alliances';
import type { World } from '../world';

export const SHARED_WAR_UNITY = 3;
export const MEMBER_UNITY = 0.25;
export const UNITY_DECAY = 1;
export const LOYALTY_PULL = 0.25;
export const LEAVE_LOYALTY = 25;
export const UNION_AT = 80;
export const UNION_LOST = 70;

function sharedWars(world: World, a: Alliance): number {
  let n = 0;
  for (const war of world.wars.list) for (const side of war.sides) if (side.filter((m) => a.members.includes(m)).length >= 2) n++;
  return n;
}

export function allianceSystem(world: World): void {
  if (!isMonthStart(world.startDay, world.tick)) return;
  const al = world.alliances;
  for (const a of [...al.list]) {
    a.unity = Math.max(0, Math.min(100, a.unity + SHARED_WAR_UNITY * sharedWars(world, a) + MEMBER_UNITY * (a.members.length - 1) - UNITY_DECAY));
    for (let i = 0; i < a.members.length; i++) a.loyalty[i] = a.loyalty[i]! + LOYALTY_PULL * (a.unity - a.loyalty[i]!);
    if (!a.union && a.unity >= UNION_AT) {
      a.union = true;
      world.out.emit(world.tick, EventKind.UnionFormed, a.id, a.leader, NaN, NaN);
    } else if (a.union && a.unity < UNION_LOST) {
      a.union = false;
    }
    const leaving = a.members.filter((m, i) => m !== a.leader && a.loyalty[i]! < LEAVE_LOYALTY);
    for (const m of leaving) leaveAlliance(world, m);
  }
}

/** Removes `n` from its alliance with events (also the command path). */
export function leaveAlliance(world: World, n: number): void {
  const r = world.alliances.leave(n);
  if (!r) return;
  world.out.emit(world.tick, EventKind.AllianceLeft, n, r.alliance.id, NaN, NaN);
  if (r.dissolved) world.out.emit(world.tick, EventKind.AllianceDissolved, r.alliance.id, r.alliance.leader, NaN, NaN);
}
