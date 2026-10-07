/**
 * Strategic AI v1 (SPEC §7, PLAN 1.24). Daily at 00:00; each nation acts every STAGGER days
 * (day + id ≡ 0 mod STAGGER). Draws are hash32(seed, day, nation, salt), so runs are replayable.
 *
 * Neighbours: owners of adjacent provinces (province graph, centre cells).
 * Strength(n): men in the formations of n and its puppets. Both sides of a prospective war add
 * ALLY_WEIGHT of their partners: the attacker its alliance, the target its alliance and
 * guarantors (they join, PLAN 1.17). Partners count for less than their numbers because they
 * fight on their own fronts. (Critic B1, 2026-10-03: the target used to count its partners in
 * full and the attacker none, so after a few years of alliance-building nobody could attack.)
 *
 * Declare war (aggression ≥ PACIFIST_BELOW, not a puppet, not broke, in < MAX_WARS wars):
 *   utility(t) = aggression/100 × (min(RATIO_CAP, attack(n)/defence(t)) − 1) + OPPORTUNITY (t already at war)
 *              + CLAIM (n has a core on land t holds) − exhaustion/100 − WARS_PENALTY × wars
 * over neighbours t that are valid targets; the best t with utility > DECLARE_AT is attacked
 * with probability DECLARE_P × aggression/100.
 * Stalemate peace: a war older than STALEMATE_DAYS with |score| < STALEMATE_SCORE and both
 * sides' exhaustion > STALEMATE_EXHAUSTION ends in peace on its score.
 * Alliances: an unaligned nation bordering an aggressive (≥ THREAT_AGGRESSION) neighbour more
 * than THREAT_RATIO × stronger joins the strongest alliance among its other neighbours, or
 * forms one with an unaligned neighbour of that threat (probability ALLY_P).
 * Coalition (monthly): against a nation earning > HEGEMON_SHARE of world gross income, its
 * unaligned neighbours (not its puppets) form or join a coalition alliance.
 * God Mode can switch the AI off globally (setting `aiEnabled`) or per nation (`setAi`).
 */
import { isDayStart, isMonthStart } from '../../shared/calendar';
import { Refusal } from '../../shared/commands';
import { EventKind } from '../../shared/events';
import { hash32, hashToUnit } from '../core/hash';
import { makePeace, declareWar, whyNotWar } from '../systems/war';
import { canJoin, noWarAmong } from '../systems/alliances';
import { navOf, type World } from '../world';

export const STAGGER = 7;
/** Nations below this aggression never start wars (they still defend, ally and make peace). */
export const PACIFIST_BELOW = 15;
/** Cap on the strength ratio term (a target without an army is not infinitely attractive). */
export const RATIO_CAP = 3;
/** Weight of alliance partners and guarantors in the strength comparison. */
export const ALLY_WEIGHT = 0.4;
export const MAX_WARS = 2;
export const OPPORTUNITY = 0.3;
export const CLAIM = 0.3;
export const WARS_PENALTY = 0.4;
export const DECLARE_AT = 0.5;
export const DECLARE_P = 0.25;
export const STALEMATE_DAYS = 720;
export const STALEMATE_SCORE = 15;
export const STALEMATE_EXHAUSTION = 40;
export const THREAT_AGGRESSION = 50;
export const THREAT_RATIO = 1.5;
export const ALLY_P = 0.3;
export const HEGEMON_SHARE = 0.25;
const SALT_WAR = 0xa101;
const SALT_ALLY = 0xa102;

/** Neighbour sets of living nations (owners of adjacent provinces). */
export function neighbourMap(world: World): Map<number, Set<number>> {
  const g = navOf(world).graph;
  const owner = world.cells.owner;
  const out = new Map<number, Set<number>>();
  const ownerOf = (node: number): number => {
    const c = g.centre[node] ?? -1;
    return c >= 0 ? owner[c]! : 0;
  };
  for (let a = 1; a < g.nodeCount; a++) {
    const oa = ownerOf(a);
    if (oa === 0) continue;
    for (const b of g.adj[a] ?? []) {
      const ob = ownerOf(b);
      if (ob === 0 || ob === oa) continue;
      if (!out.has(oa)) out.set(oa, new Set());
      out.get(oa)!.add(ob);
    }
  }
  return out;
}

function strengths(world: World): Float64Array {
  const s = new Float64Array(world.nations.highWater + 1);
  const f = world.formations.cols;
  const nc = world.nations.cols;
  world.formations.forEach((id) => {
    const n = f.nation[id]!;
    const o = nc.overlord[n]!;
    s[o !== 0 ? o : n]! += f.strength[id]!;
  });
  return s;
}

function warsOf(world: World, n: number): number {
  return world.wars.list.filter((w) => w.sides[0].includes(n) || w.sides[1].includes(n)).length;
}

function exhaustionOf(world: World, n: number): number {
  let e = 0;
  for (const w of world.wars.list) {
    if (w.sides[0].includes(n)) e = Math.max(e, w.exhaustion[0]);
    if (w.sides[1].includes(n)) e = Math.max(e, w.exhaustion[1]);
  }
  return e;
}

/** Whether n holds a core (or claim) on a province whose centre t owns. */
function claimsOn(world: World, n: number, t: number): boolean {
  const g = navOf(world).graph;
  for (const p of world.provinces.provincesOf(n)) {
    const c = g.centre[p] ?? -1;
    if (c >= 0 && world.cells.owner[c] === t) return true;
  }
  return false;
}

export function strategicAi(world: World): void {
  if (!world.settings.aiEnabled || !isDayStart(world.tick)) return;
  const day = world.tick / 24;
  const nc = world.nations.cols;
  // Stalemates end (all wars, daily).
  for (const w of [...world.wars.list]) {
    if (w.fightToDeath[0] || w.fightToDeath[1]) continue;
    if ((world.tick - w.startTick) / 24 < STALEMATE_DAYS || Math.abs(w.score) >= STALEMATE_SCORE) continue;
    if (w.exhaustion[0] > STALEMATE_EXHAUSTION && w.exhaustion[1] > STALEMATE_EXHAUSTION) makePeace(world, w);
  }
  const actors: number[] = [];
  world.nations.forEach((n) => {
    if (nc.living[n] === 1 && nc.aiOff[n] !== 1 && nc.overlord[n] === 0 && (day + n) % STAGGER === 0) actors.push(n);
  });
  if (actors.length === 0 && !isMonthStart(world.startDay, world.tick)) return;
  const nb = neighbourMap(world);
  const str = strengths(world);
  const al = world.alliances;
  const withAllies = (n: number): number => {
    let s = str[n]!;
    for (const m of al.allianceOf(n)?.members ?? []) if (m !== n) s += ALLY_WEIGHT * str[m]!;
    return s;
  };
  const defence = (t: number): number => {
    let s = withAllies(t);
    for (const g of al.guarantorsOf(t)) s += ALLY_WEIGHT * str[g]!;
    return Math.max(1, s);
  };
  for (const n of actors) {
    const neighbours = [...(nb.get(n) ?? [])].sort((a, b) => a - b);
    // War.
    const wars = warsOf(world, n);
    if (wars < MAX_WARS && nc.aggression[n]! >= PACIFIST_BELOW && nc.gold[n]! >= 0 && nc.bankrupt[n] !== 1) {
      const attack = withAllies(n);
      let best = 0;
      let bestU = DECLARE_AT;
      for (const t of neighbours) {
        // Whom it may declare on (PLAN 3.8: not a puppet of its ally either, which it used to pick).
        if (whyNotWar(world, n, t) !== Refusal.None) continue;
        const u = (nc.aggression[n]! / 100) * (Math.min(RATIO_CAP, attack / defence(t)) - 1) + (warsOf(world, t) > 0 ? OPPORTUNITY : 0) + (claimsOn(world, n, t) ? CLAIM : 0) - exhaustionOf(world, n) / 100 - WARS_PENALTY * wars;
        if (u > bestU) {
          bestU = u;
          best = t;
        }
      }
      if (best !== 0 && hashToUnit(hash32(world.seed, day, n, SALT_WAR)) < (DECLARE_P * nc.aggression[n]!) / 100) declareWar(world, n, best);
    }
    // Alliances against a threat.
    if (!al.allianceOf(n)) {
      const threat = neighbours.find((t) => nc.aggression[t]! >= THREAT_AGGRESSION && str[t]! > THREAT_RATIO * Math.max(1, str[n]!) && !world.wars.atWar(n, t));
      if (threat !== undefined && hashToUnit(hash32(world.seed, day, n, SALT_ALLY)) < ALLY_P) {
        const options = neighbours.map((m) => al.allianceOf(m)).filter((a) => a && !a.members.includes(threat) && canJoin(world, n, a));
        const join = options.sort((a, b) => b!.members.reduce((s, m) => s + str[m]!, 0) - a!.members.reduce((s, m) => s + str[m]!, 0) || a!.id - b!.id)[0];
        if (join && al.join(n, join)) world.out.emit(world.tick, EventKind.AllianceJoined, n, join.id, NaN, NaN);
        else {
          const partner = [...(nb.get(threat) ?? [])].sort((a, b) => a - b).find((m) => m !== n && nc.living[m] === 1 && !al.allianceOf(m) && nc.overlord[m] === 0 && !world.wars.atWar(n, m));
          const a = partner !== undefined ? al.create(n, [partner], 'alliance.defensive', 40) : null;
          if (a) for (const m of a.members) world.out.emit(world.tick, EventKind.AllianceJoined, m, a.id, NaN, NaN);
        }
      }
    }
  }
  if (isMonthStart(world.startDay, world.tick)) coalition(world, nb, str);
}

/** Monthly: unaligned neighbours of a hegemon (> HEGEMON_SHARE of world income) ally. */
function coalition(world: World, nb: Map<number, Set<number>>, str: Float64Array): void {
  const nc = world.nations.cols;
  let total = 0;
  let top = 0;
  world.nations.forEach((n) => {
    if (nc.living[n] !== 1) return;
    total += Math.max(0, nc.income[n]!);
    if (top === 0 || nc.income[n]! > nc.income[top]!) top = n;
  });
  if (top === 0 || total <= 0 || nc.income[top]! / total <= HEGEMON_SHARE) return;
  const al = world.alliances;
  const members = [...(nb.get(top) ?? [])]
    .filter((m) => nc.living[m] === 1 && nc.overlord[m] !== top && nc.overlord[m] === 0 && !al.allied(m, top))
    .sort((a, b) => str[b]! - str[a]! || a - b);
  const existing = al.list.find((a) => a.nameKey === 'alliance.coalition');
  for (const m of members) {
    if (al.allianceOf(m)) continue;
    if (existing) {
      if (canJoin(world, m, existing) && al.join(m, existing)) world.out.emit(world.tick, EventKind.AllianceJoined, m, existing.id, NaN, NaN);
    }
  }
  if (!existing) {
    const free = members.filter((m) => !al.allianceOf(m));
    if (free.length >= 2 && noWarAmong(world, free)) {
      const a = al.create(free[0]!, free.slice(1), 'alliance.coalition', 50);
      if (a) for (const m of a.members) world.out.emit(world.tick, EventKind.AllianceJoined, m, a.id, NaN, NaN);
    }
  }
}
