/**
 * Wars v1 (SPEC §3.5, §7 Peace; PLAN 1.16): declaration, war score, exhaustion, peace.
 *
 * Declaration (`declareWar`): rejected for dead nations, self, an existing war, a truce, an
 * overlord–puppet pair or allies. Each leader brings its puppets and its alliance (PLAN 1.17);
 * the defender also gains its guarantors (each with its puppets). A side fights to the death when any
 * member's nation flag is set (God Mode can change it per war with `setWarFightToDeath`).
 *
 * Daily (00:00), when any war exists, one grid pass counts land owned per nation and land
 * occupied per (owner, controller) pair. Per war, with side A = attackers, D = defenders:
 *   occ(X→Y) = cells owned by Y's side and controlled by X's side ÷ cells owned by Y's side
 *   score = clamp(200 × (occ(A→D) − occ(D→A)) + capitalBonus, −100, 100)
 *   exhaustion(X) = min(100, 0.1·days + 80·(1 − men/startMen) + 60·occ(other→X))
 * A side sues for peace when its leader is broke (gold < 0 or bankrupt), its exhaustion is
 * ≥ EXHAUSTED, or its score is ≤ −CRUSHED, unless either side fights to the death. The side
 * with the higher score (the attackers on a tie) wins and the terms follow |score|:
 *   < WHITE_PEACE: white peace, every occupation between the sides reverts;
 *   otherwise the winner annexes round(|score|/100 × occupied) of the loser's cells it occupies,
 *   nearest its own pre-peace land first (BFS layers, then cell id); the rest reverts;
 *   ≥ PUPPET_SCORE: everything occupied is annexed and the loser's leader becomes a puppet
 *   of the winner's leader.
 * A peace starts a TRUCE_TICKS truce between the leaders. Capital captures add ±CAPITAL_SCORE.
 */
import { isDayStart } from '../../shared/calendar';
import { EventKind } from '../../shared/events';
import { neighbours4 } from '../nav/grid';
import { annexNation, makePuppet } from './puppets';
import { ATTACKERS, DEFENDERS, type War } from '../wars';
import type { World } from '../world';

export const WHITE_PEACE = 10;
export const PUPPET_SCORE = 90;
export const EXHAUSTED = 80;
export const CRUSHED = 90;
export const CAPITAL_SCORE = 25;
export const TRUCE_TICKS = 24 * 730;
/** Autonomy of a puppet created by peace terms (a satellite-to-puppet border case). */
export const PEACE_PUPPET_AUTONOMY = 30;
/** A losing leader smaller than this (owned cells, ≈ 15,000 km² at M) is annexed by a decisive winner. */
export const SMALL_STATE_CELLS = 40;
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

/** Applies a declaration; returns the war or null (with a `WarRejected` event). */
export function declareWar(world: World, attacker: number, defender: number): War | null {
  const nc = world.nations.cols;
  const ok =
    attacker !== defender &&
    world.nations.has(attacker) &&
    world.nations.has(defender) &&
    nc.living[attacker] === 1 &&
    nc.living[defender] === 1 &&
    !world.wars.atWar(attacker, defender) &&
    !world.wars.inTruce(attacker, defender, world.tick) &&
    nc.overlord[attacker] !== defender &&
    nc.overlord[defender] !== attacker &&
    !world.alliances.allied(attacker, defender);
  if (!ok) {
    world.out.emit(world.tick, EventKind.WarRejected, attacker, defender, NaN, NaN);
    return null;
  }
  // Each side: leader + puppets, then its alliance (+ their puppets); defenders also gain their
  // guarantors. Nobody joins against its own ally, a truce partner, or twice.
  const al = world.alliances;
  const allies = (n: number): number[] => al.allianceOf(n)?.members.filter((m) => m !== n) ?? [];
  const live = (m: number): boolean => world.nations.has(m) && nc.living[m] === 1;
  const a: number[] = [];
  const d: number[] = [];
  const add = (side: number[], other: number[], enemyLeader: number, m: number): void => {
    for (const x of withPuppets(world, m)) {
      if (!live(x) || side.includes(x) || other.includes(x)) continue;
      if (x !== attacker && x !== defender && (al.allied(x, enemyLeader) || world.wars.inTruce(x, enemyLeader, world.tick) || nc.overlord[enemyLeader] === x)) continue;
      side.push(x);
    }
  };
  add(a, d, defender, attacker);
  add(d, a, attacker, defender);
  for (const m of allies(defender)) add(d, a, attacker, m);
  for (const g of al.guarantorsOf(defender)) add(d, a, attacker, g);
  for (const m of allies(attacker)) add(a, d, defender, m);
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
  if (w) w.war.capitalBonus += w.side === ATTACKERS ? CAPITAL_SCORE : -CAPITAL_SCORE;
}

interface LandCounts {
  /** Cells owned, by nation id. */
  owned: Uint32Array;
  /** key owner·65536 + controller → cells. */
  occupied: Map<number, number>;
}

function countLand(world: World): LandCounts {
  const { owner, controller } = world.cells;
  const owned = new Uint32Array(world.nations.highWater + 1);
  const occupied = new Map<number, number>();
  for (let c = 0; c < owner.length; c++) {
    const o = owner[c]!;
    if (o === 0) continue;
    owned[o]!++;
    const k = controller[c]!;
    if (k !== o && k !== 0) occupied.set(o * 65536 + k, (occupied.get(o * 65536 + k) ?? 0) + 1);
  }
  return { owned, occupied };
}

/** Share of `victims`' land held by `occupiers`. */
function occShare(land: LandCounts, occupiers: number[], victims: number[]): number {
  let own = 0;
  let occ = 0;
  for (const v of victims) {
    own += land.owned[v] ?? 0;
    for (const o of occupiers) occ += land.occupied.get(v * 65536 + o) ?? 0;
  }
  return own > 0 ? occ / own : 0;
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
  const land = countLand(world);
  const men = menOf(world);
  const nc = world.nations.cols;
  const sideMen = (side: number[]): number => side.reduce((s, n) => s + (men.get(n) ?? 0), 0);
  for (const war of [...world.wars.list]) {
    const [A, D] = war.sides;
    const oAD = occShare(land, A, D);
    const oDA = occShare(land, D, A);
    war.score = Math.max(-100, Math.min(100, Math.round(200 * (oAD - oDA) + war.capitalBonus)));
    const days = (world.tick - war.startTick) / 24;
    for (const s of [ATTACKERS, DEFENDERS]) {
      const m = sideMen(war.sides[s]!);
      if (war.startMen[s] === 0) war.startMen[s] = m;
      const lost = war.startMen[s]! > 0 ? Math.max(0, 1 - m / war.startMen[s]!) : 0;
      const occ = s === ATTACKERS ? oDA : oAD;
      war.exhaustion[s] = Math.min(100, 0.1 * days + 80 * lost + 60 * occ);
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
  const { owner, controller } = world.cells;
  const inW = new Set(W);
  const inL = new Set(L);
  // One pass: the winner's occupation of the loser (candidates) and the reverse (reverts).
  const candidates: number[] = [];
  for (let c = 0; c < owner.length; c++) {
    const o = owner[c]!;
    const k = controller[c]!;
    if (inL.has(o) && inW.has(k)) candidates.push(c);
    else if (inW.has(o) && inL.has(k)) world.setController(c, o);
  }
  const quota = s < WHITE_PEACE ? 0 : s >= PUPPET_SCORE ? candidates.length : Math.round((s / 100) * candidates.length);
  const annex = new Set(nearestFirst(world, candidates, inW).slice(0, quota));
  for (const c of candidates) {
    if (annex.has(c)) world.setOwner(c, controller[c]!);
    else world.setController(c, owner[c]!);
  }
  const wl = W[0]!;
  const ll = L[0]!;
  const nc = world.nations.cols;
  world.wars.end(war);
  // A small losing leader is annexed outright by a decisive winner (PLAN 1.40 tuning: losing
  // rebels otherwise survived as rump states or puppets, and 50 years ended with 300–600 nations).
  if (s >= WHITE_PEACE && nc.living[ll] === 1 && nc.living[wl] === 1 && nc.cells[ll]! < SMALL_STATE_CELLS) annexNation(world, wl, ll);
  else if (s >= PUPPET_SCORE && nc.living[ll] === 1) makePuppet(world, wl, ll, PEACE_PUPPET_AUTONOMY);
  world.wars.truces.push({ a: wl, b: ll, untilTick: world.tick + TRUCE_TICKS });
  world.out.emit(world.tick, EventKind.PeaceSigned, wl, ll, NaN, NaN);
}

/** Candidate cells ordered by 4-step distance from the winner's own land, then by cell id. */
function nearestFirst(world: World, candidates: number[], inW: Set<number>): number[] {
  const { w, h, owner } = world.cells;
  const isCand = new Set(candidates);
  const dist = new Map<number, number>();
  const nb: number[] = [];
  let frontier = candidates.filter((c) => neighbours4(c, w, h, world.settings.loopingMap, nb).some((n) => inW.has(owner[n]!)));
  for (const c of frontier) dist.set(c, 0);
  for (let d = 1; frontier.length > 0; d++) {
    const next: number[] = [];
    for (const c of frontier) {
      for (const n of neighbours4(c, w, h, world.settings.loopingMap, nb)) {
        if (!isCand.has(n) || dist.has(n)) continue;
        dist.set(n, d);
        next.push(n);
      }
    }
    frontier = next;
  }
  const far = Number.MAX_SAFE_INTEGER;
  return [...candidates].sort((a, b) => (dist.get(a) ?? far) - (dist.get(b) ?? far) || a - b);
}
