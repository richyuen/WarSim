/**
 * Wars v1 (SPEC §3.5, §7 Peace; PLAN 1.16): declaration, war score, exhaustion, peace.
 *
 * Declaration (`declareWar`): rejected for dead nations, self, an existing war, a truce, an
 * overlord–puppet pair, allies, two puppets of one overlord, or a nation and the puppet of its
 * ally (`bond`, PLAN 3.8). Each leader brings its puppets and its alliance (PLAN 1.17);
 * the defender also gains its guarantors (each with its puppets). Of those, a nation with a bond
 * to a nation of the other side stays out, with its puppets (PLAN 3.8c). A side fights to the death when any
 * member's nation flag is set (God Mode can change it per war with `setWarFightToDeath`).
 *
 * Daily (00:00), when any war exists, the day's land tallies (`LandCounts`) give the land owned
 * per nation and the land occupied per (owner, controller) pair. Land is km², not cells (ADR-57):
 * a Miller cell in the far north covers a quarter of the ground of one at the equator, and by
 * cells Siberia weighed twice its land in every share below. Per war, with side A = attackers,
 * D = defenders:
 *   held(X→Y)  = km² owned by Y's side and controlled by X's side
 *   occ(X→Y)   = held(X→Y) ÷ min(land(Y), REL_CAP × land(X)), at most 1
 *   share(X→Y) = held(X→Y) ÷ land(Y), the true share
 *   score = clamp(200 × (occ(A→D) − occ(D→A)) + capitalBonus, −100, 100)
 *   exhaustion(X) = min(100, 0.1·days + 80·(1 − men/startMen) + 60·share(other→X))
 * The score is relative to the smaller party (critic B1, 2026-10-03): against a victim much
 * larger than the occupiers, a conquest the size of the occupiers' own land counts like half of
 * an equal's. With the true share alone, no war against a large nation scored above a white
 * peace, so the largest nations never lost land.
 * A side sues for peace when its leader is broke (gold < 0 or bankrupt), its exhaustion is
 * ≥ EXHAUSTED, or its score is ≤ −CRUSHED, unless either side fights to the death. The side
 * with the higher score (the attackers on a tie) wins and the terms follow |score|:
 *   < WHITE_PEACE: white peace, every occupation between the sides reverts;
 *   otherwise the winner annexes every cell of the losers that it occupies (critic B1, ADR-51:
 *   until 2026-10-03 only round(|score|/100 × occupied), so a war worth score 20 kept a fifth of
 *   a conquest that was small to begin with, and the map hardly changed at a peace); the losers'
 *   occupations of the winners revert;
 *   ≥ PUPPET_SCORE: when the annexed land is at least PUPPET_SHARE of the losers' land, the
 *   loser's leader also becomes a puppet of the winner's leader;
 *   a losing leader left with less than SMALL_STATE_KM2 is annexed whole instead.
 * Capitulation: a side with share(other→side) ≥ CAPITULATE, or whose leader has lost that share
 * of its own land to occupiers of any war, has lost, fight to the death or not: peace at ±100 on
 * the spot. (An overrun fight-to-the-death nation used to stay at war for good and kept its
 * occupiers' war slots and exhaustion pinned.)
 * Deadlock: a war older than MAX_WAR_DAYS ends on its score, fight to the death or not. Other
 * wars end long before (exhaustion grows 0.1 a day); a fight to the death is five years of
 * total war at most (ADR-47).
 * A peace starts a TRUCE_TICKS truce between the leaders. Capital captures add ±CAPITAL_SCORE,
 * at most ±CAPITAL_BONUS_MAX per war (field capitals fall again and again).
 */
import { isDayStart } from '../../shared/calendar';
import { Refusal } from '../../shared/commands';
import { EventKind } from '../../shared/events';
import { annexNation, makePuppet } from './puppets';
import { ATTACKERS, DEFENDERS, type War } from '../wars';
import type { LandCounts } from '../landCounts';
import type { World } from '../world';

export const WHITE_PEACE = 10;
export const PUPPET_SCORE = 90;
export const EXHAUSTED = 80;
export const CRUSHED = 90;
export const CAPITAL_SCORE = 25;
export const CAPITAL_BONUS_MAX = 2 * CAPITAL_SCORE;
/** A victim side's land counts as at most REL_CAP × the occupiers' own land in the score. */
export const REL_CAP = 2;
/** True share of the losers' land the winners must hold to make the loser's leader a puppet. */
export const PUPPET_SHARE = 0.3;
/** True share of a side's land under enemy occupation at which it capitulates. */
export const CAPITULATE = 0.75;
export const MAX_WAR_DAYS = 5 * 365;
export const TRUCE_TICKS = 24 * 730;
/** Autonomy of a puppet created by peace terms (a satellite-to-puppet border case). */
export const PEACE_PUPPET_AUTONOMY = 30;
/**
 * A losing leader smaller than this (km² owned after the terms) is annexed by a decisive winner.
 * Until ADR-57 it was 40 cells: 40 cells of the mean area of an owned cell in 1938 (212 km²).
 */
export const SMALL_STATE_KM2 = 8500;
/** Player peace offers (PLAN 1.33b) are accepted when the offering side leads by this score… */
export const PEACE_ACCEPT_SCORE = 25;
/** …or the other side's exhaustion exceeds this (the AI's stalemate threshold). */
export const PEACE_ACCEPT_EXHAUSTION = 40;

/** Leaders' puppets join their side. */
function withPuppets(world: World, leader: number): number[] {
  const out = [leader];
  world.nations.forEach((n) => {
    if (n !== leader && world.nations.cols.overlord[n] === leader && world.nations.cols.living[n] === 1) out.push(n);
  });
  return out;
}

/** Why `attacker` may not declare war on `defender`; `Refusal.None` when it may (PLAN 2.17a). */
export function whyNotWar(world: World, attacker: number, defender: number): Refusal {
  const nc = world.nations.cols;
  if (!world.nations.has(attacker) || !world.nations.has(defender)) return Refusal.NoNation;
  if (attacker === defender) return Refusal.SameNation;
  if (nc.living[attacker] !== 1 || nc.living[defender] !== 1) return Refusal.DeadNation;
  if (world.wars.atWar(attacker, defender)) return Refusal.AtWar;
  if (world.wars.inTruce(attacker, defender, world.tick)) return Refusal.Truce;
  return bond(world, attacker, defender);
}

/**
 * What ties a and b so that they do not go to war (PLAN 3.8, the critic's R3-B4), or
 * `Refusal.None`: one is the other's puppet, they are allies, both are puppets of one overlord,
 * or one of them or its overlord is the ally of the other or of its overlord. (Until then only
 * the first two: the United Kingdom declared war on a puppet of its ally France, and France's
 * other puppets came with it.) An overlord's own overlord is not looked at.
 */
export function bond(world: World, a: number, b: number): Refusal {
  const nc = world.nations.cols;
  const al = world.alliances;
  if (nc.overlord[a] === b || nc.overlord[b] === a) return Refusal.Subject;
  if (al.allied(a, b)) return Refusal.Allied;
  const ra = nc.overlord[a] || a;
  const rb = nc.overlord[b] || b;
  if (ra === rb) return Refusal.SameOverlord;
  return al.allied(ra, rb) || al.allied(a, rb) || al.allied(ra, b) ? Refusal.AlliedRealm : Refusal.None;
}

/** Applies a declaration; returns the war or null (with a `WarRejected` event). */
export function declareWar(world: World, attacker: number, defender: number): War | null {
  const nc = world.nations.cols;
  if (whyNotWar(world, attacker, defender) !== Refusal.None) {
    world.out.emit(world.tick, EventKind.WarRejected, attacker, defender, NaN, NaN);
    return null;
  }
  // Each side: leader + puppets, then its alliance (+ their puppets); defenders also gain their
  // guarantors. Nobody joins against a truce partner or twice.
  const al = world.alliances;
  const allies = (n: number): number[] => al.allianceOf(n)?.members.filter((m) => m !== n) ?? [];
  const live = (m: number): boolean => world.nations.has(m) && nc.living[m] === 1;
  const called: [number[], number[]] = [[], []];
  const order: number[] = [];
  const add = (s: number, enemyLeader: number, m: number): void => {
    for (const x of withPuppets(world, m)) {
      if (!live(x) || called[0].includes(x) || called[1].includes(x)) continue;
      if (x !== attacker && x !== defender && world.wars.inTruce(x, enemyLeader, world.tick)) continue;
      called[s]!.push(x);
      order.push(x);
    }
  };
  add(ATTACKERS, defender, attacker);
  add(DEFENDERS, attacker, defender);
  for (const m of allies(defender)) add(DEFENDERS, attacker, m);
  for (const g of al.guarantorsOf(defender)) add(DEFENDERS, attacker, g);
  for (const m of allies(attacker)) add(ATTACKERS, defender, m);
  // Nobody but the two leaders stands against a nation it has a bond with (PLAN 3.8c): a nation
  // torn between the sides stays out, with its puppets. In three steps, each on what the one
  // before left: who has a bond with the enemy's leader (a guarantor of the defender that is the
  // attacker's ally); then, of the puppets, each that has one with a nation of the other side
  // (a puppet in another alliance than its overlord does not fight its overlord's side, and does
  // not keep its overlord out of the war); then the same of the nations that are no puppets.
  // Within a step the nations are asked in the order of the call, each against those of the
  // other side that the step has let stand: of two that are torn by each other alone, the one
  // called first fights.
  const leader = (x: number): boolean => x === attacker || x === defender;
  const bound = (x: number, enemies: number[]): boolean => enemies.some((o) => bond(world, x, o) !== Refusal.None);
  const without = (sides: [number[], number[]], asked: (x: number) => boolean, enemiesOf: (s: number, stand: Set<number>) => number[]): [number[], number[]] => {
    const out = new Set<number>();
    const stand = new Set<number>();
    for (const side of sides) for (const x of side) if (leader(x) || !asked(x)) stand.add(x);
    for (const x of order) {
      const s = sides[ATTACKERS].includes(x) ? ATTACKERS : sides[DEFENDERS].includes(x) ? DEFENDERS : -1;
      if (s < 0 || stand.has(x)) continue;
      if (bound(x, enemiesOf(1 - s, stand))) out.add(x);
      else stand.add(x);
    }
    const keep = (x: number): boolean => leader(x) || (!out.has(x) && !out.has(nc.overlord[x]!));
    return [sides[0].filter(keep), sides[1].filter(keep)];
  };
  const step1 = without(called, () => true, (s) => [s === ATTACKERS ? attacker : defender]);
  const step2 = without(step1, (x) => nc.overlord[x] !== 0, (s, stand) => step1[s]!.filter((o) => stand.has(o)));
  const [a, d] = without(step2, (x) => nc.overlord[x] === 0, (s, stand) => step2[s]!.filter((o) => stand.has(o)));
  // A side fights to the death when its leader does (PLAN 1.40 tuning: any member used to pass it
  // on, so whole alliance blocs fought every later war forever and fronts froze).
  const ftd = (side: number[]): boolean => nc.fightToDeath[side[0]!] === 1;
  const war = world.wars.start(a, d, world.tick, [ftd(a), ftd(d)]);
  world.out.emit(world.tick, EventKind.WarDeclared, attacker, defender, NaN, NaN);
  return war;
}

/** Records a capital capture in the war between capturer and loser (score swing). */
export function noteCapitalCaptured(world: World, capturer: number, loser: number): void {
  const w = world.wars.between(capturer, loser);
  if (w) w.war.capitalBonus = Math.max(-CAPITAL_BONUS_MAX, Math.min(CAPITAL_BONUS_MAX, w.war.capitalBonus + (w.side === ATTACKERS ? CAPITAL_SCORE : -CAPITAL_SCORE)));
}

function landOf(land: LandCounts, side: number[]): number {
  let own = 0;
  for (const n of side) own += land.owned[n] ?? 0;
  return own;
}

/** `victims`' land held by `occupiers`: the true share, and the share relative to the smaller party. */
function occShare(land: LandCounts, occupiers: number[], victims: number[]): { share: number; rel: number } {
  const own = landOf(land, victims);
  let occ = 0;
  for (const v of victims) for (const o of occupiers) occ += land.occupied.get(v * 65536 + o) ?? 0;
  if (own <= 0) return { share: 0, rel: 0 };
  return { share: occ / own, rel: Math.min(1, occ / Math.max(1, Math.min(own, REL_CAP * landOf(land, occupiers)))) };
}

function menOf(world: World): Map<number, number> {
  const m = new Map<number, number>();
  const f = world.formations.cols;
  world.formations.forEach((id) => m.set(f.nation[id]!, (m.get(f.nation[id]!) ?? 0) + f.strength[id]!));
  return m;
}

export function warSystem(world: World): void {
  if (!isDayStart(world.tick)) return;
  if (world.wars.truces.some((t) => t.untilTick <= world.tick)) world.wars.truces = world.wars.truces.filter((t) => t.untilTick > world.tick);
  if (world.wars.list.length === 0) return;
  // The day's tallies as of its start: peace terms below change the map, and every war of the
  // day is judged on the same counts (as the daily scan did before PLAN 1.42f).
  const land = world.landCounts().snapshot();
  const men = menOf(world);
  const nc = world.nations.cols;
  const sideMen = (side: number[]): number => side.reduce((s, n) => s + (men.get(n) ?? 0), 0);
  for (const war of [...world.wars.list]) {
    // A peace earlier in the day may have ended this one: its terms annexed the last member of a
    // side (`Wars.endAllOf`). It has no leader to sue or to sign (PLAN 3.5f).
    if (!world.wars.list.includes(war)) continue;
    const [A, D] = war.sides;
    const oAD = occShare(land, A, D);
    const oDA = occShare(land, D, A);
    war.score = Math.max(-100, Math.min(100, Math.round(200 * (oAD.rel - oDA.rel) + war.capitalBonus)));
    const days = (world.tick - war.startTick) / 24;
    for (const s of [ATTACKERS, DEFENDERS]) {
      const m = sideMen(war.sides[s]!);
      if (war.startMen[s] === 0) war.startMen[s] = m;
      const lost = war.startMen[s]! > 0 ? Math.max(0, 1 - m / war.startMen[s]!) : 0;
      const occ = s === ATTACKERS ? oDA.share : oAD.share;
      war.exhaustion[s] = Math.min(100, 0.1 * days + 80 * lost + 60 * occ);
    }
    // Capitulation: an overrun side has lost, whatever its stance.
    const overrun = (leader: number): boolean => (land.owned[leader] ?? 0) > 0 && land.lost[leader]! >= CAPITULATE * land.owned[leader]!;
    const dDown = oAD.share >= CAPITULATE || overrun(D[0]!);
    const aDown = oDA.share >= CAPITULATE || overrun(A[0]!);
    if (dDown || aDown) {
      war.score = dDown && aDown ? (oAD.share >= oDA.share ? 100 : -100) : dDown ? 100 : -100;
      makePeace(world, war);
      continue;
    }
    if (days >= MAX_WAR_DAYS) {
      makePeace(world, war);
      continue;
    }
    if (war.fightToDeath[0] || war.fightToDeath[1]) continue;
    const sues = [ATTACKERS, DEFENDERS].map((s) => {
      const leader = war.sides[s]![0]!;
      const broke = nc.gold[leader]! < 0 || nc.bankrupt[leader] === 1;
      const own = s === ATTACKERS ? war.score : -war.score;
      return broke || war.exhaustion[s]! >= EXHAUSTED || own <= -CRUSHED;
    });
    if (sues[0] || sues[1]) makePeace(world, war);
  }
}

/** Concludes `war` on its current score (see the module comment for the terms). */
/**
 * A peace offer by `from` in war `warId` (player diplomacy, PLAN 1.33b). The other side accepts
 * when the offering side leads the score by PEACE_ACCEPT_SCORE or its own exhaustion exceeds
 * PEACE_ACCEPT_EXHAUSTION, and never while it fights to the death; peace follows `makePeace` on
 * the current score. Otherwise `PeaceRejected`.
 */
export function offerPeace(world: World, warId: number, from: number): boolean {
  const war = world.wars.list.find((w) => w.id === warId);
  if (!war) return false;
  const side = war.sides[ATTACKERS]!.includes(from) ? ATTACKERS : war.sides[DEFENDERS]!.includes(from) ? DEFENDERS : -1;
  if (side < 0) return false;
  const other = 1 - side;
  const lead = side === ATTACKERS ? war.score : -war.score;
  if (war.fightToDeath[other] || (lead < PEACE_ACCEPT_SCORE && war.exhaustion[other]! <= PEACE_ACCEPT_EXHAUSTION)) {
    world.out.emit(world.tick, EventKind.PeaceRejected, war.id, from, NaN, NaN);
    return false;
  }
  makePeace(world, war);
  return true;
}

export function makePeace(world: World, war: War): void {
  const winner = war.score >= 0 ? ATTACKERS : DEFENDERS;
  const W = war.sides[winner]!;
  const L = war.sides[1 - winner]!;
  const s = Math.abs(war.score);
  const { owner, controller, w, h } = world.cells;
  const inW = new Set(W);
  const inL = new Set(L);
  const rowKm2 = world.landCounts().rowKm2;
  // One pass: the winner's occupation of the loser (candidates) and the reverse (reverts), with
  // the losers' land and the occupied part of it in km².
  const candidates: number[] = [];
  let loserLand = 0;
  let occupied = 0;
  for (let y = 0, c = 0; y < h; y++) {
    const km2 = rowKm2[y]!;
    for (let x = 0; x < w; x++, c++) {
      const o = owner[c]!;
      const k = controller[c]!;
      if (inL.has(o)) {
        loserLand += km2;
        if (inW.has(k)) {
          candidates.push(c);
          occupied += km2;
        }
      } else if (inW.has(o) && inL.has(k)) world.setController(c, o);
    }
  }
  for (const c of candidates) {
    if (s >= WHITE_PEACE) world.setOwner(c, controller[c]!);
    else world.setController(c, owner[c]!);
  }
  const wl = W[0]!;
  const ll = L[0]!;
  const nc = world.nations.cols;
  world.wars.end(war);
  // A small losing leader is annexed outright by a decisive winner (PLAN 1.40 tuning: losing
  // rebels otherwise survived as rump states or puppets, and 50 years ended with 300–600 nations).
  if (s >= WHITE_PEACE && nc.living[ll] === 1 && nc.living[wl] === 1 && world.landCounts().owned[ll]! < SMALL_STATE_KM2) annexNation(world, wl, ll);
  else if (s >= PUPPET_SCORE && nc.living[ll] === 1 && occupied >= PUPPET_SHARE * loserLand) makePuppet(world, wl, ll, PEACE_PUPPET_AUTONOMY);
  world.wars.truces.push({ a: wl, b: ll, untilTick: world.tick + TRUCE_TICKS });
  world.out.emit(world.tick, EventKind.PeaceSigned, wl, ll, NaN, NaN);
}
