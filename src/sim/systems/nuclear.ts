/**
 * Nuclear weapons (SPEC §6.4, PLAN 6): the programme and its toggles (PLAN 6.1a).
 *
 * Nukes are allowed to a nation where the world allows them (`settings.nukesEnabled`, from the
 * scenario's `nukesEnabled`, God Mode's `setSetting`) and the nation is not barred
 * (`world.nukesBanned`, God Mode's `setNukes`).
 *
 * Who goes for the bomb (SPEC §3.7's "decided in Phase 6"): a nation allowed nukes whose monthly
 * income is NUKE_PROGRAMME_INCOME or more: a great power, the programme being dear (on 1 February
 * 1938 of seed 1: the United States, the United Kingdom, Germany, the Soviet Union and France).
 * For it the `nuclear` category is no longer held back from research (`nextTech`): it takes the
 * chain by year and prerequisites as any other tech. A nation that loses the right keeps what it
 * knows, and its nuclear lines are not paid.
 *
 * Warheads (PLAN 6.1b, `nuclearSystem`, daily at 00:00): a nation that goes for the bomb and
 * knows it (`atomic_bomb`) builds one warhead at a time: WARHEAD_GOLD paid by the day over
 * WARHEAD_DAYS out of its treasury, the day's share only where the treasury holds it (never into
 * debt), up to WARHEAD_MAX in its stockpile (`world.warheads`, state). A stockpile costs
 * WARHEAD_UPKEEP a warhead a month, with the rest of its expenses (`monthlyAccounts`). God Mode
 * grants warheads (`grantWarheads`). A nation that dies loses its stockpile.
 *
 * Delivery (PLAN 6.2, SPEC §6.4; `launchNuke`, the command `launchNuke`): a warhead goes
 * - by bomber: the nation's strategic bomber wing at its airbase, not in the air nor carrying a
 *   warhead, with the place within its range, the nearest; it flies a sortie there, with no
 *   mission (so it drops no bombs of its own), met by the enemy's fighters and AA as any sortie.
 *   At its arrival it is stopped short with the chance BOMBER_INTERCEPT × (1 − s), s its nation's
 *   air superiority in the target's air zone (`airSuperiority`): none where it holds the air, 0.4
 *   where neither side does, 0.8 where the enemy holds it; and a wing lost on the way loses it.
 * - by missile (`ballistic_missiles` known): from its capital, MISSILE_KM at most, at MISSILE_KMH;
 *   nothing stops it.
 * A launch takes a warhead from the stockpile, needs nukes allowed, and is state in flight
 * (`world.nukeLaunches`); its arrival, hourly, is `NukeDetonated` or `NukeIntercepted` (the
 * burst's effects: PLAN 6.3). A wing carrying a warhead is left alone by the air AI.
 *
 * The blast (PLAN 6.3a, SPEC §6.4 "blast radius by yield, kills elements by distance falloff and
 * destroys city industry and population"; `blast`): a radius of BLAST_KM × the yield's cube root;
 * at distance d within it the share BLAST_KILL × (1 − d / radius) is destroyed (`blastShare`):
 * of each element of every formation there (land, fleets in port, wings at their base: by its
 * formation's place), BLAST_PEOPLE of it of each cell's population (`cells.pop`, its people: they
 * do not come back; a cell is 20 km across, and its whole share would have killed more than
 * Berlin's people at Berlin), and of its industry, as bombs put it out of work (`world.bombDamage`, at least that share,
 * repaired as bombing's is). Its toll: `NukeCasualties`.
 *
 * Fallout (PLAN 6.3b, SPEC §6.4 "FALLOUT (attrition, income loss, movement penalty) that drifts
 * with a deterministic seasonal wind field and decays over years"): `world.fallout`, by cell, 0 to 1.
 * - The wind (`windAt`): a function of the latitude and the day of the year, no chance in it:
 *   easterlies under 30° and over 60° of latitude, westerlies between; swinging WIND_SWING to
 *   the pole in its summer and to the equator in its winter.
 * - A burst lays a plume downwind (`layFallout`): FALLOUT_KM × the yield's cube root long, its
 *   half-width FALLOUT_WIDTH_KM and FALLOUT_SPREAD of the way along more; at a cell the level
 *   (1 − along / length) × (1 − across / half-width), added to what lies there, to 1; and
 *   FALLOUT_WIDTH_KM about the burst upwind. The plume is laid where it falls and stays there.
 * - It decays by half in FALLOUT_HALF_LIFE days, daily; a cell under FALLOUT_FLOOR is clean.
 * - Where it lies, at level f: a formation on the cell loses FALLOUT_ATTRITION × f of each
 *   element a day; the cell's output is (1 − FALLOUT_INCOME × f) of itself (`monthlyAccounts`);
 *   a march across it takes 1 ÷ (1 − FALLOUT_SLOW × f) as long (`movementSystem`).
 *
 * The use decision's utility (PLAN 6.4a, SPEC §6.4; `nuclearUtility`, its inputs `nukeInputs`):
 *   U = targetValue × desperation × doctrine − RETALIATION_WEIGHT × retaliationRisk
 *       − allianceCost − outrage − TABOO_WEIGHT × taboo  (+ RETALIATION_BONUS when striking back)
 * and, when both sides have an assured second strike (MAD), first use is at most 0 unless the
 * striker's desperation is extreme. A strike back at who struck it is not first use.
 * - targetValue (`targetValue`), 0 to 1: TARGET_SCALE × the share of the enemy side's output
 *   (the cells it holds, as bombs and fallout leave them) and of its men within the blast, less
 *   the striker's side's men there; + TARGET_CAPITAL with an enemy capital in it.
 * - desperation (`desperationOf`), 0 to 2: how far its side is losing the war (−score / 100), the
 *   share of its land held by others, DESPERATION_CAPITAL with enemy land forces within
 *   CAPITAL_THREAT_KM of its capital, DESPERATION_FTD when its side fights to the death.
 *   Extreme: at least 1, fighting to the death or its capital threatened.
 * - doctrine, 0.5 to 1.5: 0.5 + aggression / 100 (no trait of its own: aggression read as one).
 * - retaliationRisk (`retaliationRisk`): the most of any enemy and any ally of an enemy that can
 *   deliver a warhead (`canDeliver`): its warheads / RETALIATION_FULL, to 1, × its doctrine.
 * - MAD (`assured`): a side has an assured second strike when a nation of it (with its allies)
 *   has MAD_WARHEADS and a means of delivery.
 * - allianceCost: ALLIANCE_COST for each ally not at its side in that war, to ALLIANCE_COST_MAX.
 * - outrage: 0 until PLAN 6.5.
 * - taboo (`world.nukeTaboo`): 1, TABOO_AFTER after any burst, back by TABOO_RECOVERY a day.
 *
 * The decision (PLAN 6.4b; `nukeDecisions`), daily, with the AI on: each nation with a warhead,
 * living, not switched off nor a puppet, nukes allowed, in each of its wars weighs each enemy
 * capital and the NUKE_TARGETS strongest enemy land formations, and strikes the one of most
 * utility above 0 (by missile when it knows them and one reaches, else by bomber; one out of reach,
 * the next), once a day at most. The decision is told (`NukeDecided`).
 * Retaliation: a burst on a nation's land (its owner's, not the striker's) gives it a grievance
 * against the striker for RETALIATION_DAYS (`world.nukeGrievance`). A nation of retaliation
 * doctrine (aggression at least RETALIATION_AGGRESSION) striking at the side of who struck it is
 * retaliating: RETALIATION_BONUS, and no MAD bar; its strike back spends the grievance (one for one).
 */
import { isDayStart } from '../../shared/calendar';
import { Refusal } from '../../shared/commands';
import { EventKind } from '../../shared/events';
import { hash32, hashToUnit } from '../core/hash';
import { pow, sin, cos } from '../core/dmath';
import { unproject } from '../data/projection';
import { knowsTechs, techMask } from '../tech';
import type { War } from '../wars';
import { airOf, navOf, type NukeLaunch, type World } from '../world';
import { basePlace, wingRange } from './air';
import { applyLoss, cellX, elementIndex, settleFormation, wrapDx } from './elements';
import { airSuperiority } from './airSuperiority';
import { seaKm } from './navalCombat';

/** Monthly income, gold, from which a nation allowed nukes runs a programme. */
export const NUKE_PROGRAMME_INCOME = 1000;

/** Whether nation `n` may have nuclear weapons: the world's toggle and its own. */
export function nukesAllowed(world: World, n: number): boolean {
  return world.settings.nukesEnabled && !world.nukesBanned.has(n);
}

/** Whether nation `n` runs a nuclear programme: allowed, and the income of a great power. */
export function goesForBomb(world: World, n: number): boolean {
  return nukesAllowed(world, n) && world.nations.cols.income[n]! >= NUKE_PROGRAMME_INCOME;
}

/** A warhead's gold, paid by the day over WARHEAD_DAYS (about 6 % of Germany's income of 1938). */
export const WARHEAD_GOLD = 400;
export const WARHEAD_DAYS = 90;
/** The most warheads a stockpile holds. */
export const WARHEAD_MAX = 100;
/** Gold a warhead costs a month, kept. */
export const WARHEAD_UPKEEP = 10;

/** Nation `n`'s warheads (0 for none). */
export function warheadsOf(world: World, n: number): number {
  return world.warheads.get(n)?.stock ?? 0;
}

/** A bomber's warhead stopped short at most (PLAN 6.2): × (1 − its side's superiority over the target). */
export const BOMBER_INTERCEPT = 0.8;
/** A missile's reach, km, and speed, km/h. */
export const MISSILE_KM = 10000;
export const MISSILE_KMH = 20000;
/** The class of a strategic bomber's squadrons. */
const STRATEGIC = 'bomber_str';
const SALT_INTERCEPT = 0x6e756b65;

/** Whether nation `n` knows tech `id`. */
function knows(world: World, n: number, id: string): boolean {
  const i = world.rules?.techs.findIndex((t) => t.id === id) ?? -1;
  return i >= 0 && knowsTechs(world, n, techMask([i]));
}

/** Whether wing `id` carries a warhead in flight (PLAN 6.2): the air AI leaves it alone. */
export function carriesNuke(world: World, id: number): boolean {
  return world.nukeLaunches.some((l) => l.missile === 0 && l.wing === id);
}

/** The chance a launch is stopped short (PLAN 6.2): a bomber's by the air over its target, a missile's none. */
export function interceptChance(world: World, l: NukeLaunch): number {
  if (l.missile === 1) return 0;
  const cell = Math.min(world.cells.h - 1, Math.max(0, Math.floor(l.ty))) * world.cells.w + Math.floor(l.tx);
  const zone = airOf(world).zoneOf[cell] ?? 0;
  return BOMBER_INTERCEPT * (1 - (zone === 0 ? 0.5 : airSuperiority(world, l.nation, zone)));
}

/** The nearest strategic bomber of `n`'s at its base, free, that reaches (x, y) (PLAN 6.2); null for none. */
export function nukeBomber(world: World, n: number, x: number, y: number): { wing: number; from: [number, number]; km: number } | null {
  const c = world.formations.cols;
  const rules = world.rules!;
  let best: { wing: number; from: [number, number]; km: number } | null = null;
  for (const [id, base] of [...world.wingBase].sort((a, b) => a[0] - b[0])) {
    if (base <= 0 || c.nation[id] !== n || world.sorties.has(id) || carriesNuke(world, id) || !world.formations.has(id)) continue;
    const first = rules.templates[c.template[id]!]?.elements[0];
    if (!first || rules.units[first.unit]!.cls !== STRATEGIC) continue;
    const at = basePlace(world, base);
    if (!at) continue;
    const d = seaKm(world, at[0], at[1], x, y);
    if (d <= wingRange(world, id) && d < (best?.km ?? Infinity)) best = { wing: id, from: at, km: d };
  }
  return best;
}

/**
 * Whether `n` can deliver a warhead (PLAN 6.4a): it has one, and missiles or a strategic bomber of
 * its own with a base, flying or not (a second strike's capacity: at war its bombers are out on
 * sorties most hours, and back at their bases soon after).
 */
export function canDeliver(world: World, n: number): boolean {
  if (!nukesAllowed(world, n) || warheadsOf(world, n) < 1) return false;
  if (knows(world, n, 'ballistic_missiles')) return true;
  const c = world.formations.cols;
  const rules = world.rules!;
  for (const [id, base] of world.wingBase) {
    if (base <= 0 || c.nation[id] !== n || !world.formations.has(id)) continue;
    const first = rules.templates[c.template[id]!]?.elements[0];
    if (first && rules.units[first.unit]!.cls === STRATEGIC) return true;
  }
  return false;
}

/** Nation `n` launches a warhead at (x, y) by bomber or missile (PLAN 6.2): see the head of the file; why not, else None. */
export function launchNuke(world: World, n: number, x: number, y: number, missile: boolean): Refusal {
  if (!nukesAllowed(world, n)) return Refusal.NoNukes;
  if (warheadsOf(world, n) < 1) return Refusal.NoWarhead;
  let from: [number, number];
  let wing = 0;
  let kmh = MISSILE_KMH;
  let km: number;
  if (missile) {
    const nc = world.nations.cols;
    if (!knows(world, n, 'ballistic_missiles')) return Refusal.NoDelivery;
    from = [nc.capitalX[n]!, nc.capitalY[n]!];
    km = seaKm(world, from[0], from[1], x, y);
    if (km > MISSILE_KM) return Refusal.NoDelivery;
  } else {
    const b = nukeBomber(world, n, x, y);
    if (!b) return Refusal.NoDelivery;
    ({ wing, from, km } = b);
    kmh = world.rules!.templates[world.formations.cols.template[wing]!]!.speedKmh;
    world.wingMission.delete(wing);
    world.sorties.set(wing, { bx: from[0], by: from[1], tx: x, ty: y, launch: world.tick, kmh, km, over: 0 });
  }
  const h = world.warheads.get(n)!;
  h.stock--;
  world.nukeLaunches.push({ id: world.nextLaunchId++, nation: n, missile: missile ? 1 : 0, wing, bx: from[0], by: from[1], tx: x, ty: y, launch: world.tick, arrive: world.tick + km / Math.max(1, kmh) });
  world.out.emit(world.tick, EventKind.NukeLaunched, n, missile ? 1 : 0, x, y);
  return Refusal.None;
}

/** A yield's blast radius, km (PLAN 6.3a), at yield 1; the share destroyed at its centre. */
export const BLAST_KM = 25;
export const BLAST_KILL = 0.9;
/** The share of a cell's people a blast kills, of its share (PLAN 6.3a): 13.5 % at the centre. */
export const BLAST_PEOPLE = 0.15;
/** The most of a cell's industry a blast puts out of work. */
const BLAST_DAMAGE_MAX = 0.95;

/** The blast radius, km, of a warhead of `yieldN`. */
export function blastRadius(yieldN: number): number {
  return BLAST_KM * pow(Math.max(1, yieldN), 1 / 3);
}

/** The share a blast destroys at `km` from its centre, of radius `radius` (PLAN 6.3a): BLAST_KILL × (1 − km / radius), 0 beyond. */
export function blastShare(km: number, radius: number): number {
  return km >= radius ? 0 : BLAST_KILL * (1 - km / radius);
}

/**
 * A warhead of `yieldN` bursts at (x, y), `nation`'s (PLAN 6.3a): see the head of the file.
 * Returns its toll: men of formations lost, people killed.
 */
export function blast(world: World, nation: number, yieldN: number, x: number, y: number): { men: number; people: number } {
  const radius = blastRadius(yieldN);
  const { w, h, pop, econ } = world.cells;
  // The cells within reach: a cell is 20 km down and at least about 5 km across (far north).
  const ry = Math.ceil(radius / 10) + 1;
  const rx = Math.ceil(radius / 4) + 1;
  const cy = Math.floor(y);
  const cx = Math.floor(x);
  let people = 0;
  for (let dy = -ry; dy <= ry; dy++) {
    const yy = cy + dy;
    if (yy < 0 || yy >= h) continue;
    for (let dx = -rx; dx <= rx; dx++) {
      const xx = cellX(world, cx + dx);
      if (xx === null) continue;
      const f = blastShare(seaKm(world, x, y, xx + 0.5, yy + 0.5), radius);
      if (f <= 0) continue;
      const c = yy * w + xx;
      const killed = Math.round(pop[c]! * f * BLAST_PEOPLE);
      pop[c] = pop[c]! - killed;
      people += killed * 1000;
      if (econ[c]! > 0) world.bombDamage.set(c, Math.max(world.bombDamage.get(c) ?? 0, Math.min(BLAST_DAMAGE_MAX, f)));
    }
  }
  // The formations within it, by their place.
  const c = world.formations.cols;
  const ec = world.elements.cols;
  const idx = elementIndex(world);
  const hit: number[] = [];
  world.formations.forEach((id) => {
    if (Math.abs(c.y[id]! - y) > ry || Math.abs(wrapDx(world, x, c.x[id]!)) > rx) return;
    const f = blastShare(seaKm(world, x, y, c.x[id]!, c.y[id]!), radius);
    if (f > 0) hit.push(id);
  });
  let men = 0;
  for (const id of hit.sort((a, b) => a - b)) {
    const f = blastShare(seaKm(world, x, y, c.x[id]!, c.y[id]!), radius);
    const before = c.strength[id]!;
    for (const e of idx.get(id) ?? []) applyLoss(world, e, ec.strength[e]! * f);
    settleFormation(world, id);
    men += before - (world.formations.has(id) ? c.strength[id]! : 0);
  }
  world.out.emit(world.tick, EventKind.NukeCasualties, nation, men + people, x, y);
  return { men, people };
}

/** A plume's length at yield 1, km; its half-width at the burst, and how much more it widens per km along (PLAN 6.3b). */
export const FALLOUT_KM = 200;
export const FALLOUT_WIDTH_KM = 20;
export const FALLOUT_SPREAD = 0.3;
/** Days in which fallout decays by half (SPEC: over years); under FALLOUT_FLOOR a cell is clean. */
export const FALLOUT_HALF_LIFE = 365;
export const FALLOUT_FLOOR = 0.005;
/** A day's decay: fallout × this. */
export const FALLOUT_DECAY = pow(0.5, 1 / FALLOUT_HALF_LIFE);
/** At level 1: the share of each element a formation loses a day, of a cell's output lost, of a march's pace lost. */
export const FALLOUT_ATTRITION = 0.02;
export const FALLOUT_INCOME = 0.8;
export const FALLOUT_SLOW = 0.5;
/** The wind's swing with the season, radians (30°). */
export const WIND_SWING = Math.PI / 6;

/**
 * The way the wind blows at row `y` on day `day` of the year (PLAN 6.3b): an angle, radians, on the
 * map (0 east, π/2 south: rows grow southward). Easterlies under 30° and over 60° of latitude,
 * westerlies between; turned WIND_SWING × sin(2π day / 365) poleward (the northern summer's).
 */
export function windAt(world: World, y: number, day: number): number {
  const lat = unproject(0.5, Math.min(world.cells.h - 1, Math.max(0, y)) / world.cells.h)[1];
  const abs = Math.abs(lat);
  const base = abs < 30 || abs >= 60 ? Math.PI : 0;
  // Poleward is north (−y) in the north, south (+y) in the south; westerlies turn one way, easterlies the other.
  const pole = lat >= 0 ? -1 : 1;
  const swing = WIND_SWING * sin((2 * Math.PI * day) / 365) * (lat >= 0 ? 1 : -1);
  return base + (base === 0 ? 1 : -1) * pole * swing;
}

/** The day of the year of tick `tick` (0 to 364). */
function dayOfYear(world: World): number {
  return Math.floor((world.startDay + world.tick / 24) % 365);
}

/** Lays a burst's fallout at (x, y) of `yieldN`, downwind (PLAN 6.3b): see the head of the file. */
export function layFallout(world: World, yieldN: number, x: number, y: number): void {
  const length = FALLOUT_KM * pow(Math.max(1, yieldN), 1 / 3);
  const a = windAt(world, y, dayOfYear(world));
  const [ux, uy] = [cos(a), sin(a)];
  const { w, h } = world.cells;
  const g = navOf(world).grid;
  const reach = length + FALLOUT_WIDTH_KM + FALLOUT_SPREAD * length;
  const ry = Math.ceil(reach / 15) + 1;
  const cy = Math.floor(y);
  const cx = Math.floor(x);
  for (let dy = -ry; dy <= ry; dy++) {
    const yy = cy + dy;
    if (yy < 0 || yy >= h) continue;
    const row = Math.min(g.h - 1, Math.max(0, Math.floor((y + yy + 0.5) / 2)));
    const kx = g.kx[row]!;
    const ky = g.ky[row]!;
    const rx = Math.ceil(reach / Math.max(1, kx)) + 1;
    for (let dx = -rx; dx <= rx; dx++) {
      const xx = cellX(world, cx + dx);
      if (xx === null) continue;
      const ex = wrapDx(world, x, xx + 0.5) * kx;
      const ey = (yy + 0.5 - y) * ky;
      const along = ex * ux + ey * uy;
      const across = Math.abs(-ex * uy + ey * ux);
      const half = FALLOUT_WIDTH_KM + FALLOUT_SPREAD * Math.max(0, along);
      if (along < -FALLOUT_WIDTH_KM || along >= length || across >= half) continue;
      const f = (1 - Math.max(0, along) / length) * (1 - across / half);
      if (f <= 0) continue;
      const c = yy * w + xx;
      world.fallout.set(c, Math.min(1, (world.fallout.get(c) ?? 0) + f));
    }
  }
}

/** The fallout at cell `c` (0 where clean). */
export function falloutAt(world: World, c: number): number {
  return world.fallout.size === 0 ? 0 : (world.fallout.get(c) ?? 0);
}

/** A day's fallout (PLAN 6.3b): its attrition on the formations on it, then its decay. */
function falloutDay(world: World): void {
  if (world.fallout.size === 0) return;
  const c = world.formations.cols;
  const ec = world.elements.cols;
  const w = world.cells.w;
  const idx = elementIndex(world);
  const hit: [number, number][] = [];
  world.formations.forEach((id) => {
    if (world.isWing(id)) return;
    const f = falloutAt(world, Math.floor(c.y[id]!) * w + Math.floor(c.x[id]!));
    if (f > 0) hit.push([id, f]);
  });
  for (const [id, f] of hit.sort((a, b) => a[0] - b[0])) {
    for (const e of idx.get(id) ?? []) applyLoss(world, e, ec.strength[e]! * FALLOUT_ATTRITION * f);
    settleFormation(world, id);
  }
  for (const [cell, f] of [...world.fallout]) {
    const left = f * FALLOUT_DECAY;
    if (left < FALLOUT_FLOOR) world.fallout.delete(cell);
    else world.fallout.set(cell, left);
  }
}

/** The use decision's weights (PLAN 6.4a): see the head of the file. */
export const TARGET_SCALE = 10;
export const TARGET_CAPITAL = 0.3;
export const DESPERATION_CAPITAL = 0.5;
export const DESPERATION_FTD = 0.5;
export const CAPITAL_THREAT_KM = 150;
export const RETALIATION_WEIGHT = 0.8;
export const RETALIATION_FULL = 5;
export const RETALIATION_BONUS = 1;
export const MAD_WARHEADS = 2;
export const ALLIANCE_COST = 0.05;
export const ALLIANCE_COST_MAX = 0.3;
export const TABOO_WEIGHT = 0.6;
export const TABOO_AFTER = 0.3;
export const TABOO_RECOVERY = 0.0005;

/** What a strike's utility is made of (PLAN 6.4a). */
export interface NukeInputs {
  targetValue: number;
  desperation: number;
  doctrine: number;
  retaliation: number;
  allianceCost: number;
  outrage: number;
  taboo: number;
  /** Both sides have an assured second strike. */
  mad: boolean;
  /** The striker's desperation is extreme. */
  extreme: boolean;
  /** A strike back at a nation that struck it: not first use. */
  retaliating: boolean;
}

/** A strike's utility (PLAN 6.4a): see the head of the file. */
export function nuclearUtility(i: NukeInputs): number {
  const u = i.targetValue * i.desperation * i.doctrine + (i.retaliating ? RETALIATION_BONUS : 0) - RETALIATION_WEIGHT * i.retaliation - i.allianceCost - i.outrage - TABOO_WEIGHT * i.taboo;
  return i.mad && !i.extreme && !i.retaliating ? Math.min(0, u) : u;
}

/** `n`'s doctrine (PLAN 6.4a): 0.5 + aggression / 100. */
export function doctrineOf(world: World, n: number): number {
  return 0.5 + world.nations.cols.aggression[n]! / 100;
}

/** The nations of the other side of `war` from `side`, and the allies of each. */
function enemyCoalition(world: World, war: War, side: number): number[] {
  const out = new Set<number>(war.sides[1 - side]!);
  for (const m of war.sides[1 - side]!) for (const a of world.alliances.allianceOf(m)?.members ?? []) if (!war.sides[side]!.includes(a)) out.add(a);
  return [...out].sort((a, b) => a - b);
}

/** The nations of `side` of `war` and their allies not on the other side. */
function ownCoalition(world: World, war: War, side: number): number[] {
  const out = new Set<number>(war.sides[side]!);
  for (const m of war.sides[side]!) for (const a of world.alliances.allianceOf(m)?.members ?? []) if (!war.sides[1 - side]!.includes(a)) out.add(a);
  return [...out].sort((a, b) => a - b);
}

/** Whether one of `nations` has an assured second strike (PLAN 6.4a): MAD_WARHEADS and a means of delivery. */
function assured(world: World, nations: readonly number[]): boolean {
  return nations.some((m) => warheadsOf(world, m) >= MAD_WARHEADS && canDeliver(world, m));
}

/** The risk of a strike back from the enemy side of `war` and its allies (PLAN 6.4a). */
export function retaliationRisk(world: World, war: War, side: number): number {
  let r = 0;
  for (const m of enemyCoalition(world, war, side)) if (canDeliver(world, m)) r = Math.max(r, Math.min(1, warheadsOf(world, m) / RETALIATION_FULL) * doctrineOf(world, m));
  return r;
}

/** `n`'s desperation in `war` on `side` (PLAN 6.4a), 0 to 2, and whether it is extreme. */
export function desperationOf(world: World, n: number, war: War, side: number): { desperation: number; extreme: boolean } {
  const nc = world.nations.cols;
  const losing = Math.max(0, side === 0 ? -war.score : war.score) / 100;
  const land = world.landCounts();
  const owned = land.owned[n] ?? 0;
  const lost = owned > 0 ? (land.lost[n] ?? 0) / owned : 0;
  const cx = nc.capitalX[n]!;
  const cy = nc.capitalY[n]!;
  const c = world.formations.cols;
  let threatened = false;
  world.formations.forEach((id) => {
    if (threatened || world.isFleet(id) || world.isWing(id) || world.offLand(id)) return;
    if (!war.sides[1 - side]!.includes(c.nation[id]!)) return;
    if (seaKm(world, cx, cy, c.x[id]!, c.y[id]!) <= CAPITAL_THREAT_KM) threatened = true;
  });
  const ftd = war.fightToDeath[side]!;
  const desperation = Math.min(2, losing + lost + (threatened ? DESPERATION_CAPITAL : 0) + (ftd ? DESPERATION_FTD : 0));
  return { desperation, extreme: desperation >= 1 && (ftd || threatened) };
}

/** What a burst of `n`'s at (x, y) is worth against the other side of `war` from `side` (PLAN 6.4a), 0 to 1. */
export function targetValue(world: World, n: number, war: War, side: number, x: number, y: number): number {
  const radius = blastRadius(knows(world, n, 'thermonuclear') ? 2 : 1);
  const enemy = new Set(war.sides[1 - side]!);
  const own = new Set(ownCoalition(world, war, side));
  const { w, h, econ, controller } = world.cells;
  // The enemy side's output within the blast.
  let hit = 0;
  const ry = Math.ceil(radius / 10) + 1;
  const rx = Math.ceil(radius / 4) + 1;
  for (let yy = Math.max(0, Math.floor(y) - ry); yy <= Math.min(h - 1, Math.floor(y) + ry); yy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const xx = cellX(world, Math.floor(x) + dx);
      if (xx === null) continue;
      const cell = yy * w + xx;
      if (econ[cell] === 0 || !enemy.has(controller[cell]!)) continue;
      const f = blastShare(seaKm(world, x, y, xx + 0.5, yy + 0.5), radius);
      if (f > 0) hit += econ[cell]! * (1 - (world.bombDamage.get(cell) ?? 0)) * (1 - FALLOUT_INCOME * falloutAt(world, cell)) * f;
    }
  }
  // Men: the enemy side's within it, the striker's side's there taken off.
  const c = world.formations.cols;
  let menAll = 0;
  let menHit = 0;
  let ownHit = 0;
  let ownAll = 0;
  world.formations.forEach((id) => {
    const m = c.nation[id]!;
    const isEnemy = enemy.has(m);
    if (!isEnemy && !own.has(m)) return;
    const s = c.strength[id]!;
    const f = blastShare(seaKm(world, x, y, c.x[id]!, c.y[id]!), radius) * s;
    if (isEnemy) [menAll, menHit] = [menAll + s, menHit + f];
    else [ownAll, ownHit] = [ownAll + s, ownHit + f];
  });
  // As a share of all the enemy side's output (summed only when the blast reaches some).
  let econAll = 0;
  if (hit > 0) for (let cell = 0; cell < econ.length; cell++) if (econ[cell] !== 0 && enemy.has(controller[cell]!)) econAll += econ[cell]!;
  const share = (econAll > 0 ? hit / econAll : 0) + (menAll > 0 ? menHit / menAll : 0) - (ownAll > 0 ? ownHit / ownAll : 0);
  const nc = world.nations.cols;
  let capital = 0;
  for (const m of enemy) if (nc.living[m] === 1 && blastShare(seaKm(world, x, y, nc.capitalX[m]!, nc.capitalY[m]!), radius) > 0) capital = TARGET_CAPITAL;
  return Math.max(0, Math.min(1, TARGET_SCALE * share + capital));
}

/**
 * The inputs of `n`'s strike at (x, y) in `war` (PLAN 6.4a): `n` on `side`; `retaliating` when the
 * target's side struck it (PLAN 6.4b).
 */
export function nukeInputs(world: World, n: number, war: War, side: number, x: number, y: number, retaliating = false): NukeInputs {
  const { desperation, extreme } = desperationOf(world, n, war, side);
  const ally = world.alliances.allianceOf(n);
  const apart = (ally?.members ?? []).filter((m) => m !== n && !war.sides[side]!.includes(m)).length;
  return {
    targetValue: targetValue(world, n, war, side, x, y),
    desperation,
    doctrine: doctrineOf(world, n),
    retaliation: retaliationRisk(world, war, side),
    allianceCost: Math.min(ALLIANCE_COST_MAX, ALLIANCE_COST * apart),
    outrage: 0,
    taboo: world.nukeTaboo,
    mad: assured(world, ownCoalition(world, war, side)) && assured(world, enemyCoalition(world, war, side)),
    extreme,
    retaliating,
  };
}

/** The decision's targets (PLAN 6.4b): the strongest enemy land formations weighed, and the grievance's days and doctrine. */
export const NUKE_TARGETS = 6;
export const RETALIATION_DAYS = 90;
export const RETALIATION_AGGRESSION = 20;

/** Whether `n`, struck, strikes back at `war`'s other side from `side` (PLAN 6.4b). */
function retaliates(world: World, n: number, war: War, side: number): boolean {
  const g = world.nukeGrievance.get(n);
  return !!g && g.until > world.tick && world.nations.cols.aggression[n]! >= RETALIATION_AGGRESSION && war.sides[1 - side]!.includes(g.by);
}

/** The places `n` weighs in `war` on `side` (PLAN 6.4b): enemy capitals, then the strongest enemy land formations. */
function nukeTargets(world: World, war: War, side: number): [number, number][] {
  const nc = world.nations.cols;
  const out: [number, number][] = [];
  for (const m of war.sides[1 - side]!) if (nc.living[m] === 1) out.push([nc.capitalX[m]!, nc.capitalY[m]!]);
  const c = world.formations.cols;
  const enemy = new Set(war.sides[1 - side]!);
  const land: number[] = [];
  world.formations.forEach((id) => {
    if (enemy.has(c.nation[id]!) && !world.isFleet(id) && !world.isWing(id) && !world.offLand(id)) land.push(id);
  });
  land.sort((a, b) => c.strength[b]! - c.strength[a]! || a - b);
  for (const id of land.slice(0, NUKE_TARGETS)) out.push([c.x[id]!, c.y[id]!]);
  return out;
}

/** The day's decisions to strike (PLAN 6.4b): see the head of the file. */
function nukeDecisions(world: World): void {
  if (!world.settings.aiEnabled || world.warheads.size === 0) return;
  const nc = world.nations.cols;
  for (const n of [...world.warheads.keys()].sort((a, b) => a - b)) {
    if (warheadsOf(world, n) < 1 || nc.living[n] !== 1 || nc.aiOff[n] === 1 || nc.overlord[n] !== 0 || !nukesAllowed(world, n)) continue;
    const options: { u: number; x: number; y: number; back: boolean }[] = [];
    for (const war of world.wars.list) {
      const side = war.sides[0].includes(n) ? 0 : war.sides[1].includes(n) ? 1 : -1;
      if (side < 0) continue;
      const back = retaliates(world, n, war, side);
      for (const [x, y] of nukeTargets(world, war, side)) {
        const u = nuclearUtility(nukeInputs(world, n, war, side, x, y, back));
        if (u > 0) options.push({ u, x, y, back });
      }
    }
    options.sort((a, b) => b.u - a.u);
    const missiles = knows(world, n, 'ballistic_missiles');
    for (const o of options) {
      const ok = (missiles && launchNuke(world, n, o.x, o.y, true) === Refusal.None) || launchNuke(world, n, o.x, o.y, false) === Refusal.None;
      if (!ok) continue;
      world.out.emit(world.tick, EventKind.NukeDecided, n, Math.round(o.u * 1000), o.x, o.y);
      // A strike back spends the grievance: one for one.
      if (o.back) world.nukeGrievance.delete(n);
      break;
    }
  }
  for (const [n, g] of [...world.nukeGrievance]) if (g.until <= world.tick) world.nukeGrievance.delete(n);
}

/** The taboo's day (PLAN 6.4a): back towards 1. Nothing while it is 1. */
function tabooDay(world: World): void {
  if (world.nukeTaboo >= 1) return;
  world.nukeTaboo = Math.min(1, world.nukeTaboo + TABOO_RECOVERY);
}

/** The hour's arrivals (PLAN 6.2): each launch there by now bursts or is stopped short. */
function arrivals(world: World): void {
  if (world.nukeLaunches.length === 0) return;
  const left: NukeLaunch[] = [];
  for (const l of world.nukeLaunches) {
    if (l.arrive > world.tick) {
      left.push(l);
      continue;
    }
    // A bomber lost on the way, or stopped short by the air over its target.
    const lost = l.missile === 0 && (!world.formations.has(l.wing) || world.formations.cols.nation[l.wing] !== l.nation);
    if (lost || hashToUnit(hash32(world.seed, l.id, SALT_INTERCEPT)) < interceptChance(world, l)) world.out.emit(world.tick, EventKind.NukeIntercepted, l.nation, l.id, l.tx, l.ty);
    else {
      const yieldN = knows(world, l.nation, 'thermonuclear') ? 2 : 1;
      world.out.emit(world.tick, EventKind.NukeDetonated, l.nation, yieldN, l.tx, l.ty);
      // The taboo broken (PLAN 6.4a); the owner of the land struck has a grievance (PLAN 6.4b).
      world.nukeTaboo = Math.min(world.nukeTaboo, TABOO_AFTER);
      const struck = world.cells.owner[Math.min(world.cells.h - 1, Math.max(0, Math.floor(l.ty))) * world.cells.w + Math.floor(l.tx)] ?? 0;
      if (struck !== 0 && struck !== l.nation) world.nukeGrievance.set(struck, { by: l.nation, until: world.tick + RETALIATION_DAYS * 24 });
      blast(world, l.nation, yieldN, l.tx, l.ty);
      layFallout(world, yieldN, l.tx, l.ty);
    }
  }
  world.nukeLaunches = left;
}

/** The hour's nuclear work (PLAN 6.1b, 6.2): see the head of the file. */
export function nuclearSystem(world: World): void {
  const rules = world.rules;
  if (!rules) return;
  arrivals(world);
  if (!isDayStart(world.tick)) return;
  falloutDay(world);
  tabooDay(world);
  nukeDecisions(world);
  const bomb = rules.techs.findIndex((t) => t.id === 'atomic_bomb');
  const nc = world.nations.cols;
  // A dead nation's stockpile goes with it.
  for (const n of [...world.warheads.keys()]) if (!world.nations.has(n) || nc.living[n] !== 1) world.warheads.delete(n);
  if (bomb < 0) return;
  const mask = techMask([bomb]);
  const pay = WARHEAD_GOLD / WARHEAD_DAYS;
  world.nations.forEach((n) => {
    if (nc.living[n] !== 1 || nc.bankrupt[n] === 1 || !goesForBomb(world, n) || !knowsTechs(world, n, mask)) return;
    const w = world.warheads.get(n) ?? { stock: 0, paid: 0 };
    if (w.stock >= WARHEAD_MAX || nc.gold[n]! < pay) return;
    nc.gold[n] = nc.gold[n]! - pay;
    w.paid += pay;
    if (w.paid >= WARHEAD_GOLD - 1e-9) {
      w.stock++;
      w.paid = 0;
    }
    world.warheads.set(n, w);
  });
}
