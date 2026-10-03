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
/**
 * Player alliance proposal (PLAN 1.33b): `to` accepts when it is in no alliance, is no puppet and
 * is not at war with `from`. It then joins `from`'s alliance, or both found a defensive pact.
 * Otherwise `AllianceRejected`.
 */
/**
 * Whether nations `ids` may share an alliance: no two of them at war (review in PLAN 1.34a: the
 * AI joined the alliance of a neighbour it was fighting, so allies were at war with each other).
 */
export function noWarAmong(world: World, ids: readonly number[]): boolean {
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (world.wars.atWar(ids[i]!, ids[j]!)) return false;
  return true;
}

/** Whether `n` may join alliance `a`: in none yet and at war with none of its members. */
export function canJoin(world: World, n: number, a: Alliance): boolean {
  return world.alliances.allianceOf(n) === undefined && !a.members.some((m) => world.wars.atWar(n, m));
}

export function proposeAlliance(world: World, from: number, to: number): boolean {
  const nc = world.nations.cols;
  const al = world.alliances;
  const ok =
    from !== to &&
    world.nations.has(from) &&
    world.nations.has(to) &&
    nc.living[from] === 1 &&
    nc.living[to] === 1 &&
    al.allianceOf(to) === undefined &&
    nc.overlord[to] === 0 &&
    !world.wars.atWar(from, to);
  const own = ok ? al.allianceOf(from) : undefined;
  const joined = !ok ? null : own ? (canJoin(world, to, own) && al.join(to, own) ? own : null) : al.create(from, [to], 'alliance.defensive', 50);
  if (!joined) {
    world.out.emit(world.tick, EventKind.AllianceRejected, from, to, NaN, NaN);
    return false;
  }
  for (const m of own ? [to] : joined.members) world.out.emit(world.tick, EventKind.AllianceJoined, m, joined.id, NaN, NaN);
  return true;
}

export function leaveAlliance(world: World, n: number): void {
  const r = world.alliances.leave(n);
  if (!r) return;
  world.out.emit(world.tick, EventKind.AllianceLeft, n, r.alliance.id, NaN, NaN);
  if (r.dissolved) world.out.emit(world.tick, EventKind.AllianceDissolved, r.alliance.id, r.alliance.leader, NaN, NaN);
}
