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
 * debt), up to WARHEAD_MAX in its stockpile (`world.warheads`, state), and only while the
 * stockpile's upkeep with it stays under STOCKPILE_SHARE of its income (PLAN 7.3g; the economic AI
 * scraps the warheads over that share when short). A stockpile costs
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
 * destroys city industry and population"; `blast`): a radius of BLAST_KM × the yield's cube root
 * (the yield `yieldOf` the warhead's class: THERMO_YIELD fission ones a thermonuclear warhead's,
 * PLAN 7.20); at distance d within it the share BLAST_KILL × (1 − d / radius) is destroyed
 * (`blastShare`): of each element of every formation there (land, fleets in port, wings at their
 * base: by its formation's place), `peopleShare` of it of each cell's population (`cells.pop`, its
 * people: they do not come back): BLAST_PEOPLE of it for a fission bomb, × the yield's ⅔ power (the
 * area where people die, PLAN 7.20), to all of it; and of its industry, as bombs put it out of work
 * (`world.bombDamage`, at least that share, repaired as bombing's is). Its toll is told with its
 * consequences (`aftermath`, PLAN 6.5a).
 *
 * Fallout (PLAN 6.3b, SPEC §6.4 "FALLOUT (attrition, income loss, movement penalty) that drifts
 * with a deterministic seasonal wind field and decays over years"): `world.fallout`, by cell, 0 to 1.
 * - The wind (`windAt`): a function of the latitude and the day of the year, no chance in it:
 *   easterlies under 30° and over 60° of latitude, westerlies between; swinging WIND_SWING to
 *   the pole in its summer and to the equator in its winter.
 * - A burst lays a plume downwind (`layFallout`): FALLOUT_KM × the yield's cube root long, its
 *   half-width FALLOUT_WIDTH_KM × the yield's cube root (PLAN 7.20) and FALLOUT_SPREAD of the way
 *   along more; at a cell the level (1 − along / length) × (1 − across / half-width), added to what
 *   lies there, to 1; and that half-width about the burst upwind. The plume is laid where it falls and stays there.
 * - It decays by half in FALLOUT_HALF_LIFE days, daily; a cell under FALLOUT_FLOOR is clean.
 * - Where it lies, at level f: a formation on the cell loses FALLOUT_ATTRITION × f of each
 *   element a day; the cell's output is (1 − FALLOUT_INCOME × f) of itself (`monthlyAccounts`);
 *   a march across it takes 1 ÷ (1 − FALLOUT_SLOW × f) as long (`movementSystem`).
 *
 * The use decision's utility (PLAN 6.4a, SPEC §6.4; `nuclearUtility`, its inputs `nukeInputs`):
 *   U = targetValue × desperation × doctrine + through × (− RETALIATION_WEIGHT × retaliationRisk
 *       − allianceCost − outrage − TABOO_WEIGHT × taboo)  (+ through × RETALIATION_BONUS, and no
 *       retaliationRisk, when striking back)
 * that is, through × the strike's utility if the warhead gets there: the costs fall only on a burst
 * (the taboo, the grievance and the enemy's answer in `detonate`, outrage and unity in `aftermath`),
 * and a launch stopped short spends its warhead and nothing more (PLAN 7.18i, ADR-491: weighed whole
 * against a gain × the chance through, the costs kept the critic's Poland, 10 warheads, from every
 * place under German air cover, through 0.2);
 * and, when both sides have an assured second strike (MAD), first use is at most 0 unless the
 * striker's desperation is extreme. A strike back at who struck it is not first use. The taboo
 * weighs EXTREME_TABOO of itself for a nation in extreme desperation (PLAN 6.7: France fighting to
 * the death, the Germans before Paris, was at most 0 against its best target with the taboo whole).
 * - targetValue (`targetValue`), 0 to 1: TARGET_SCALE × the share of the enemy side's output
 *   (the cells it holds, as bombs and fallout leave them) and of its men within the blast, less
 *   the striker's side's men there (the men each as a share of the side's within FRONT_KM of the
 *   place, its theatre; PLAN 7.18c; the enemy's theatre at least THEATRE_FLOOR of all the side's
 *   men, PLAN 7.18j); + TARGET_CAPITAL with an enemy capital in it, of a nation that
 *   holds CAPITAL_WEIGHT of the side's output (PLAN 7.18d); × the chance the
 *   warhead gets there (PLAN 6.7, SPEC's "expected damage": 1 by missile, 1 − the bomber's
 *   interception chance there by bomber).
 * - desperation (`desperationOf`), 0 to 2: how far its side is losing the war (−score / 100), the
 *   share of its land held by others, DESPERATION_MEN × the share of its side's men lost in the war
 *   (`menLost`, the exhaustion's; PLAN 7.6a: France's army fell from 555k to 163k men in 40 days at
 *   0.5), DESPERATION_CAPITAL with enemy land forces within
 *   CAPITAL_THREAT_KM of its capital, DESPERATION_FTD when its side fights to the death.
 *   Extreme: at least 1, fighting to the death, its capital threatened, or its capital taken in
 *   this war (PLAN 7.18a: the capital moves after the fall, and no enemy is near the new one).
 * - doctrine, 0.5 to 1.5: 0.5 + aggression / 100 (no trait of its own: aggression read as one).
 * - retaliationRisk (`retaliationRisk`): the most of any enemy and any ally of an enemy that can
 *   deliver a warhead (`canDeliver`): its warheads / RETALIATION_FULL, to 1, × its doctrine.
 * - MAD (`assured`): a side has an assured second strike when a nation of it (with its allies)
 *   has MAD_WARHEADS and a means of delivery.
 * - allianceCost: ALLIANCE_COST for each ally not at its side in that war, to ALLIANCE_COST_MAX.
 * - outrage (PLAN 6.5b): OUTRAGE_COST, the world's outrage at any strike, + OUTRAGE_WEIGHT × the
 *   outrage at the striker already (to 1 at 100): a pariah is nearer the world turning on it.
 * - taboo (`world.nukeTaboo`): 1, TABOO_AFTER after any burst, back by TABOO_RECOVERY a day.
 *
 * The decision (PLAN 6.4b; `nukeDecisions`), daily, with the AI on: each nation with a warhead,
 * living, not switched off nor a puppet, nukes allowed, in each of its wars weighs each enemy
 * capital and the NUKE_TARGETS places where enemy land formations are most massed (`nukeTargets`;
 * PLAN 6.11a: on land the enemy side holds, within FRONT_KM of its own side, from any distance in
 * its extreme desperation (PLAN 7.6c); PLAN 6.12a: of an
 * enemy that can threaten it, `threatens`: a warhead, THREAT_SHARE of its income (PLAN 6.12f), or
 * land forces near its capital),
 * and strikes the one of most utility above NUKE_FLOOR (PLAN 7.25a; above 0 before) (by missile when it knows them and one reaches, else
 * by bomber, a free one or one retasked from a sortie; one out of reach, the next), once a day at
 * most. The decision is told (`NukeDecided`).
 * Retaliation: a burst on a nation's land (its owner's, not the striker's) gives it a grievance
 * against the striker for RETALIATION_DAYS (`world.nukeGrievance`). While it holds one against an
 * enemy, it weighs that nation's land alone, from any distance, and strikes no one else (PLAN
 * 6.12b). Of retaliation doctrine (aggression at least RETALIATION_AGGRESSION: 0, every nuclear
 * power, since PLAN 7.6e) it is retaliating:
 * RETALIATION_BONUS, no MAD bar, and no retaliation risk weighed (PLAN 6.12d: struck at London, a
 * winning United Kingdom weighed 1 − 0.96 for the Soviet second strike and never struck back). Its
 * strike back spends the grievance (one for one), and its burst gives the nation it falls on none
 * (PLAN 6.12e, `world.nukeAnswers`: with 6.12d, the Soviet Union and the United Kingdom struck each
 * other daily, each answer a new grievance).
 *
 * A burst's consequences (PLAN 6.5a, SPEC §6.4 "a stability shock and a war-exhaustion jump ...
 * economic shocks follow"; `aftermath`), on the nation whose land it burst on (none at sea or on
 * the striker's own):
 * - its war exhaustion: NUKE_SHOCK more in each of its wars (`world.nukeShock`, to NUKE_SHOCK_MAX,
 *   less NUKE_SHOCK_DECAY a day): at EXHAUSTED a side sues for peace (war.ts), the peace response;
 * - its treasury: NUKE_GOLD of what it has (AoC's God Mode nuke takes 10 % of its target's gold);
 * - stability: NUKE_UNREST more unrest in each province with land within twice the blast radius;
 * - and the striker's alliance: NUKE_UNITY less unity.
 * The strike's history entry is `NukeCasualties`: the nation struck, the yield, the dead.
 *
 * Outrage (PLAN 6.5b, SPEC §6.4 "relations hit with every nation (scaled by distance and
 * alliance) ... global outrage persists"): a burst on another nation's land raises the world's
 * outrage at its striker by OUTRAGE_STRIKE, to 100 (`world.nukeOutrage`), less OUTRAGE_DECAY a
 * day (four years and more for one strike). A nation's relations with a striker are hit by
 * `relationHit`: the outrage / 100 × by distance (1 with capitals within RELATION_NEAR_KM, down to
 * RELATION_FAR_SHARE beyond RELATION_FAR_KM) × ALLY_SHARE for its ally, its overlord or its puppet.
 * The strategic AI reads it: in its war utility against a neighbour, and the monthly coalition,
 * formed about a hegemon until then, forms about the worst pariah too (outrage PARIAH_COALITION).
 */
import { isDayStart } from '../../shared/calendar';
import { Refusal } from '../../shared/commands';
import { packNukeStrike } from '../../shared/history';
import { BLAST_KM, yieldOf } from '../../shared/nuclear';
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
import { menLost } from './war';

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
/**
 * The share of its income a nation keeps its stockpile's upkeep under (PLAN 7.3g, ADR-439): it
 * builds a warhead only while the stockpile with it stays under, and the economic AI scraps the
 * warheads over it when its books do not balance, before the army is sent home. (Seeds 501 and
 * 506: the Soviet Union's 66–77 warheads and France's 68 cost 660–770 a month against a gross of
 * 155–814; each was bankrupt with no army left and collapsed, France five times in four years.)
 * A nation of NUKE_PROGRAMME_INCOME keeps 10, twice RETALIATION_FULL.
 */
export const STOCKPILE_SHARE = 0.1;

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
  return l.missile === 1 ? 0 : bomberIntercept(world, l.nation, l.tx, l.ty);
}

/** The chance `n`'s bomber is stopped short of (x, y) (PLAN 6.2): BOMBER_INTERCEPT × (1 − its superiority there). */
export function bomberIntercept(world: World, n: number, x: number, y: number): number {
  const cell = Math.min(world.cells.h - 1, Math.max(0, Math.floor(y))) * world.cells.w + Math.floor(x);
  const zone = airOf(world).zoneOf[cell] ?? 0;
  return BOMBER_INTERCEPT * (1 - (zone === 0 ? 0.5 : airSuperiority(world, n, zone)));
}

/**
 * The strategic bomber of `n`'s that flies a warhead to (x, y) (PLAN 6.2), from its base, within
 * its range: the nearest free one, else the nearest out on a conventional sortie, retasked (PLAN
 * 6.7: at war the air AI keeps a nation's bombers out nearly every hour, and France, desperate,
 * never had one free at its day's decision). Null for none.
 */
export function nukeBomber(world: World, n: number, x: number, y: number): { wing: number; from: [number, number]; km: number } | null {
  const c = world.formations.cols;
  const rules = world.rules!;
  let best: { wing: number; from: [number, number]; km: number; busy: boolean } | null = null;
  for (const [id, base] of [...world.wingBase].sort((a, b) => a[0] - b[0])) {
    if (base <= 0 || c.nation[id] !== n || carriesNuke(world, id) || !world.formations.has(id)) continue;
    const first = rules.templates[c.template[id]!]?.elements[0];
    if (!first || rules.units[first.unit]!.cls !== STRATEGIC) continue;
    const at = basePlace(world, base);
    if (!at) continue;
    const d = seaKm(world, at[0], at[1], x, y);
    if (d > wingRange(world, id)) continue;
    // A free bomber before one out on a sortie, then the nearest (PLAN 6.7: one on a sortie is retasked).
    const busy = world.sorties.has(id);
    if (!best || (best.busy && !busy) || (best.busy === busy && d < best.km)) best = { wing: id, from: at, km: d, busy };
  }
  return best && { wing: best.wing, from: best.from, km: best.km };
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

/** Whether `n` can put a warhead on (x, y) now (PLAN 7.6): a missile from its capital within MISSILE_KM, or a bomber within range (`nukeBomber`). */
export function reaches(world: World, n: number, x: number, y: number): boolean {
  const nc = world.nations.cols;
  if (knows(world, n, 'ballistic_missiles') && seaKm(world, nc.capitalX[n]!, nc.capitalY[n]!, x, y) <= MISSILE_KM) return true;
  return nukeBomber(world, n, x, y) !== null;
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

/** A yield's blast radius at yield 1, km (shared with the page's effects), and the share destroyed at its centre (PLAN 6.3a). */
export { BLAST_KM };
export const BLAST_KILL = 0.9;
/**
 * The share of a cell's people a fission blast kills, of its share (PLAN 6.3a): 4.5 % at the centre.
 * PLAN 7.20: 0.15 until then, 554,827 dead at Paris and 1,025,202 at Berlin (Hiroshima's bomb killed
 * about 140,000); now 192,827 and 350,202, and a thermonuclear one's 13.6 times its share.
 */
export const BLAST_PEOPLE = 0.05;
/** The most of a cell's industry a blast puts out of work. */
const BLAST_DAMAGE_MAX = 0.95;

/** The blast radius, km, of a warhead of class `yieldN` (1 fission, 2 thermonuclear; `yieldOf`). */
export function blastRadius(yieldN: number): number {
  return BLAST_KM * pow(yieldOf(yieldN), 1 / 3);
}

/** The share of a cell's people a blast of class `yieldN` kills, of its share (PLAN 7.20): BLAST_PEOPLE × the yield's ⅔ power, to 1. */
export function peopleShare(yieldN: number): number {
  return Math.min(1, BLAST_PEOPLE * pow(yieldOf(yieldN), 2 / 3));
}

/** The share a blast destroys at `km` from its centre, of radius `radius` (PLAN 6.3a): BLAST_KILL × (1 − km / radius), 0 beyond. */
export function blastShare(km: number, radius: number): number {
  return km >= radius ? 0 : BLAST_KILL * (1 - km / radius);
}

/**
 * A warhead of `yieldN` bursts at (x, y) (PLAN 6.3a): see the head of the file. Returns its toll:
 * men of formations lost, people killed (told by `aftermath`, PLAN 6.5a).
 */
export function blast(world: World, yieldN: number, x: number, y: number): { men: number; people: number } {
  const radius = blastRadius(yieldN);
  const people = peopleShare(yieldN);
  const { w, h, pop, econ } = world.cells;
  // The cells within reach: a cell is 20 km down and at least about 5 km across (far north).
  const ry = Math.ceil(radius / 10) + 1;
  const rx = Math.ceil(radius / 4) + 1;
  const cy = Math.floor(y);
  const cx = Math.floor(x);
  let dead = 0;
  for (let dy = -ry; dy <= ry; dy++) {
    const yy = cy + dy;
    if (yy < 0 || yy >= h) continue;
    for (let dx = -rx; dx <= rx; dx++) {
      const xx = cellX(world, cx + dx);
      if (xx === null) continue;
      const f = blastShare(seaKm(world, x, y, xx + 0.5, yy + 0.5), radius);
      if (f <= 0) continue;
      const c = yy * w + xx;
      const killed = Math.round(pop[c]! * f * people);
      pop[c] = pop[c]! - killed;
      dead += killed * 1000;
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
  return { men, people: dead };
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

/** Lays a burst's fallout at (x, y) of class `yieldN`, downwind (PLAN 6.3b): see the head of the file. */
export function layFallout(world: World, yieldN: number, x: number, y: number): void {
  const scale = pow(yieldOf(yieldN), 1 / 3);
  const length = FALLOUT_KM * scale;
  const width = FALLOUT_WIDTH_KM * scale;
  const a = windAt(world, y, dayOfYear(world));
  const [ux, uy] = [cos(a), sin(a)];
  const { w, h } = world.cells;
  const g = navOf(world).grid;
  const reach = length + width + FALLOUT_SPREAD * length;
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
      const half = width + FALLOUT_SPREAD * Math.max(0, along);
      if (along < -width || along >= length || across >= half) continue;
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
/** The share of its side's output a nation holds for its capital to be worth TARGET_CAPITAL (PLAN 7.18d). */
export const CAPITAL_WEIGHT = 0.1;
export const DESPERATION_CAPITAL = 0.5;
export const DESPERATION_FTD = 0.5;
/** The weight of the share of its side's men lost in the war (PLAN 7.6a). */
export const DESPERATION_MEN = 1;
export const CAPITAL_THREAT_KM = 150;
/**
 * A strike is decided only above this utility (PLAN 7.25a, the critic's run 8: strikes went ahead at
 * utilities of 0.001 to 0.01, a close call taken as a case). Under the critic's set-ups' (Poland's
 * and France's, 0.035 to 0.12); 9 of 172 decisions of seeds 1 to 10 x 30 years at or under it.
 */
export const NUKE_FLOOR = 0.025;
export const RETALIATION_WEIGHT = 0.8;
export const RETALIATION_FULL = 5;
export const RETALIATION_BONUS = 1;
export const MAD_WARHEADS = 2;
export const ALLIANCE_COST = 0.05;
export const ALLIANCE_COST_MAX = 0.3;
export const TABOO_WEIGHT = 0.6;
/** The taboo's weight for a nation in extreme desperation (PLAN 6.7): it fights for its life. */
export const EXTREME_TABOO = 0.5;
export const TABOO_AFTER = 0.3;
export const TABOO_RECOVERY = 0.0005;

/** What a strike's utility is made of (PLAN 6.4a). */
export interface NukeInputs {
  /** The place's value, × the chance the warhead gets there (`through`). */
  targetValue: number;
  /** The chance the warhead gets there (PLAN 7.18i): the costs and the strike back's bonus are × it. */
  through: number;
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
  // A strike back does not weigh the enemy's second strike (PLAN 6.12d): deterrence failed when it was struck.
  // The costs and the bonus fall only on a burst (PLAN 7.18i): × the chance the warhead gets there.
  const onBurst = (i.retaliating ? RETALIATION_BONUS : 0) - (i.retaliating ? 0 : RETALIATION_WEIGHT * i.retaliation) - i.allianceCost - i.outrage - TABOO_WEIGHT * i.taboo * (i.extreme ? EXTREME_TABOO : 1);
  const u = i.targetValue * i.desperation * i.doctrine + i.through * onBurst;
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

/** Whether `war` is between two sides that each, with their allies, have an assured second strike (PLAN 6.8: MAD). */
export function madWar(world: World, war: War): boolean {
  return world.warheads.size > 1 && assured(world, ownCoalition(world, war, 0)) && assured(world, ownCoalition(world, war, 1));
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
  const desperation = Math.min(2, losing + lost + DESPERATION_MEN * menLost(world, war, side) + (threatened ? DESPERATION_CAPITAL : 0) + (ftd ? DESPERATION_FTD : 0));
  // Extreme with its capital taken in this war too (PLAN 7.18a, critic R8-B1): a capital that has
  // moved after the fall has no enemy near it, and France overrun counted as less desperate than
  // with the Germans before Paris.
  const fallen = war.capitalsLost?.includes(n) ?? false;
  return { desperation, extreme: desperation >= 1 && (ftd || threatened || fallen) };
}

/** The industry (`cells.econ`) each nation controls, by nation id: one pass over the cells. */
export function industryHeld(world: World): Float64Array {
  const { econ, controller } = world.cells;
  const out = new Float64Array(world.nations.highWater);
  for (let c = 0; c < econ.length; c++) if (econ[c] !== 0) out[controller[c]!]! += econ[c]!;
  return out;
}

/** How many times `industryHeld` has been summed for the decisions (PLAN 6.10: once a day at most). */
let industrySums = 0;

/** How many times the decisions have summed the industry by nation, in this process (PLAN 6.10's test). */
export function industrySumCount(): number {
  return industrySums;
}

/**
 * What `n`'s places in `war` on `side` are weighed against that is the same at every place (PLAN
 * 6.10): the enemy side, the radius, the two sides' formations (in the formations' order) and
 * their men, and the enemy side's whole output, summed from `industry` when first needed. Before,
 * each place weighed summed the whole map's industry again, and the daily call took 170 to 240 ms.
 */
interface StrikeView {
  enemy: Set<number>;
  radius: number;
  fx: number[];
  fy: number[];
  fs: number[];
  fEnemy: boolean[];
  /** The enemy side's men, everywhere. */
  enemyMen: number;
  econAll: () => number;
  /** The day's industry by nation (`industryHeld`). */
  held: () => Float64Array;
}

function strikeView(world: World, n: number, war: War, side: number, industry: () => Float64Array): StrikeView {
  const enemy = new Set(war.sides[1 - side]!);
  const own = new Set(ownCoalition(world, war, side));
  const c = world.formations.cols;
  const v: StrikeView = { enemy, radius: blastRadius(knows(world, n, 'thermonuclear') ? 2 : 1), fx: [], fy: [], fs: [], fEnemy: [], enemyMen: 0, econAll: () => 0, held: industry };
  world.formations.forEach((id) => {
    const m = c.nation[id]!;
    const isEnemy = enemy.has(m);
    if (!isEnemy && !own.has(m)) return;
    const s = c.strength[id]!;
    v.fx.push(c.x[id]!);
    v.fy.push(c.y[id]!);
    v.fs.push(s);
    v.fEnemy.push(isEnemy);
    if (isEnemy) v.enemyMen += s;
  });
  let all: number | null = null;
  v.econAll = () => {
    if (all === null) {
      const held = industry();
      all = 0;
      for (const m of enemy) all += held[m] ?? 0;
    }
    return all;
  };
  return v;
}

/** A day's industry by nation, summed when first asked for (PLAN 6.10). */
function industryOnce(world: World): () => Float64Array {
  let held: Float64Array | null = null;
  return () => {
    if (!held) {
      held = industryHeld(world);
      industrySums++;
    }
    return held;
  };
}

/** What a burst of `n`'s at (x, y) is worth against the other side of `war` from `side` (PLAN 6.4a), 0 to 1. */
export function targetValue(world: World, n: number, war: War, side: number, x: number, y: number): number {
  return valueIn(world, n, strikeView(world, n, war, side, () => industryHeld(world)), x, y);
}

function valueIn(world: World, n: number, v: StrikeView, x: number, y: number): number {
  return partsIn(world, n, v, x, y).value;
}

/** What a place's value is made of (`valueIn`; a diagnostic's too). */
export interface PlaceParts {
  /** The enemy side's output in the blast, as a share of its whole. */
  econShare: number;
  /** The enemy side's men in the blast, as a share of `theatreMen`. */
  menShare: number;
  /** The striker's side's men in the blast, as a share of its men in the theatre. */
  ownShare: number;
  /** The enemy side's men in the theatre (within FRONT_KM of the place). */
  menAll: number;
  /** What the place's men are weighed against: `menAll`, at least THEATRE_FLOOR × `sideMen` (PLAN 7.18j). */
  theatreMen: number;
  /** The enemy side's men, everywhere (PLAN 7.18h's measure of a theatre's weight). */
  sideMen: number;
  capital: number;
  /** The chance the warhead gets there. */
  through: number;
  value: number;
}

/** The parts of a burst's value at (x, y) for `n` in `war` on `side` (a diagnostic's). */
export function placeParts(world: World, n: number, war: War, side: number, x: number, y: number): PlaceParts {
  return partsIn(world, n, strikeView(world, n, war, side, () => industryHeld(world)), x, y);
}

function partsIn(world: World, n: number, v: StrikeView, x: number, y: number): PlaceParts {
  const { radius, enemy } = v;
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
  // Men: the enemy side's within it, the striker's side's there taken off; each a share of that
  // side's men in the theatre, within FRONT_KM of the place (PLAN 7.18c, critic R8-B1: of the whole
  // side, Japan's and Manchukuo's armies counted against a German army before Paris, 18,000 men
  // in a blast 1 % of 1.55 million).
  let menAll = 0;
  let ownAll = 0;
  let menHit = 0;
  let ownHit = 0;
  for (let k = 0; k < v.fs.length; k++) {
    const km = seaKm(world, x, y, v.fx[k]!, v.fy[k]!);
    if (km > FRONT_KM) continue;
    const s = v.fs[k]!;
    const f = blastShare(km, radius) * s;
    if (v.fEnemy[k]) {
      menAll += s;
      menHit += f;
    } else {
      ownAll += s;
      ownHit += f;
    }
  }
  // As a share of all the enemy side's output (summed only when the blast reaches some).
  const econAll = hit > 0 ? v.econAll() : 0;
  const econShare = econAll > 0 ? hit / econAll : 0;
  // The theatre counts for at least THEATRE_FLOOR of the enemy side's men (PLAN 7.18j, ADR-492). The
  // striker's own men are left a share of its theatre alone: what keeps it off them stays whole.
  const theatreMen = Math.max(menAll, THEATRE_FLOOR * v.enemyMen);
  const menShare = theatreMen > 0 ? menHit / theatreMen : 0;
  const ownShare = ownAll > 0 ? ownHit / ownAll : 0;
  const share = econShare + menShare - ownShare;
  const nc = world.nations.cols;
  let capital = 0;
  // A capital of weight to the enemy side (PLAN 7.18d, critic R8-B1: the Soviet Union struck Nepal's,
  // 1,000 dead, at war with China): its nation holds CAPITAL_WEIGHT of the side's output.
  for (const m of enemy) {
    if (nc.living[m] !== 1 || blastShare(seaKm(world, x, y, nc.capitalX[m]!, nc.capitalY[m]!), radius) === 0) continue;
    const all = v.econAll();
    if (all > 0 && (v.held()[m] ?? 0) >= CAPITAL_WEIGHT * all) capital = TARGET_CAPITAL;
  }
  // Expected damage (SPEC): as likely as the warhead gets there, by missile when `n` knows them.
  const through = knows(world, n, 'ballistic_missiles') ? 1 : 1 - bomberIntercept(world, n, x, y);
  return { econShare, menShare, ownShare, menAll, theatreMen, sideMen: v.enemyMen, capital, through, value: Math.max(0, Math.min(1, TARGET_SCALE * share + capital)) * through };
}

/**
 * The inputs of `n`'s strike at (x, y) in `war` (PLAN 6.4a): `n` on `side`; `retaliating` when the
 * target's side struck it (PLAN 6.4b).
 */
export function nukeInputs(world: World, n: number, war: War, side: number, x: number, y: number, retaliating = false): NukeInputs {
  const p = placeParts(world, n, war, side, x, y);
  return { targetValue: p.value, through: p.through, ...warInputs(world, n, war, side, retaliating) };
}

/**
 * The resolve to end a long war (PLAN 7.18e, critic R8-B1: bursts in 4 of seeds 1 to 10 × 30 years,
 * none in a war a holder was winning). A holder of warheads winning or holding its own in a war of
 * RESOLVE_DAYS or more, against enemies none of which (nor their allies) can strike back, weighs its
 * strikes as at a desperation of RESOLVE × the war's days / RESOLVE_FULL_DAYS (at most RESOLVE): a
 * strike to end the war, as in August 1945. Measured (`docs/evidence/7.18/measure-e.md`): on such
 * days the best place was worth 0.6 to 0.9, often the enemy's capital, its gain 0.05 to 0.09 at
 * the desperation of a winner against costs of 0.7. Its doctrine still weighs it: a nation of low
 * aggression does not use first. One such strike a side every RESOLVE_GAP_DAYS of a war
 * (`War.lastStrike`): it waits for the answer, peace or not, before the next.
 */
export const RESOLVE_DAYS = 365;
export const RESOLVE_FULL_DAYS = 730;
export const RESOLVE = 2;
export const RESOLVE_GAP_DAYS = 90;
/**
 * How many strikes a side decides by its resolve in one war (PLAN 7.18h): a few to end it, not one
 * each RESOLVE_GAP_DAYS to its end (seed 1's Italy struck ten times in 2.5 years in one war,
 * 11,751 to 339,247 dead). After them the war is weighed as before 7.18e: by desperation alone.
 */
export const RESOLVE_STRIKES = 3;

/**
 * The least share of the enemy side's output a nation holds for a strike of the resolve to fall on
 * its land (PLAN 7.18h): as a capital's weight (CAPITAL_WEIGHT).
 */
export const RESOLVE_WEIGHT = CAPITAL_WEIGHT;

/** `side`'s resolve in `war` (PLAN 7.18e): 0 unless the war is long, it is not losing, and the enemy cannot strike back. */
export function resolveOf(world: World, war: War, side: number, retaliation: number, mad: boolean): number {
  if (retaliation > 0 || mad) return 0;
  const days = (world.tick - war.startTick) / 24;
  if (days < RESOLVE_DAYS || (side === 0 ? war.score : -war.score) < 0) return 0;
  const last = war.lastStrike?.[side];
  if (last !== undefined && world.tick - last < RESOLVE_GAP_DAYS * 24) return 0;
  if ((war.resolveStrikes?.[side] ?? 0) >= RESOLVE_STRIKES) return 0;
  return RESOLVE * Math.min(1, days / RESOLVE_FULL_DAYS);
}

/** The inputs of `n`'s strikes in `war` on `side` but the target's value: the same at every place (PLAN 6.10). */
function warInputs(world: World, n: number, war: War, side: number, retaliating: boolean): Omit<NukeInputs, 'targetValue' | 'through'> {
  const { desperation, extreme } = desperationOf(world, n, war, side);
  const ally = world.alliances.allianceOf(n);
  const apart = (ally?.members ?? []).filter((m) => m !== n && !war.sides[side]!.includes(m)).length;
  const retaliation = retaliationRisk(world, war, side);
  const mad = assured(world, ownCoalition(world, war, side)) && assured(world, enemyCoalition(world, war, side));
  return {
    desperation: Math.max(desperation, resolveOf(world, war, side, retaliation, mad)),
    doctrine: doctrineOf(world, n),
    retaliation,
    allianceCost: Math.min(ALLIANCE_COST_MAX, ALLIANCE_COST * apart),
    outrage: OUTRAGE_COST + OUTRAGE_WEIGHT * Math.min(1, (world.nukeOutrage.get(n) ?? 0) / 100),
    taboo: world.nukeTaboo,
    mad,
    extreme,
    retaliating,
  };
}

/** The decision's targets (PLAN 6.4b): the strongest enemy land formations weighed, and the grievance's days and doctrine. */
export const NUKE_TARGETS = 6;
export const RETALIATION_DAYS = 90;
/**
 * The least aggression of a nation whose strike back is retaliation (RETALIATION_BONUS, no MAD bar,
 * no strike back weighed): 0 since PLAN 7.6e, every nuclear power. At 20 (PLAN 6.4b) the United
 * States (15), the Netherlands (10) and Switzerland (5), struck, weighed the striker's second strike
 * and the MAD bar as for a first use, and the critic saw no strike answered (R7-B1). SPEC §6.4's
 * doctrines run from none through retaliation to first use: striking back is the least of them.
 * The grievance's one for one (PLAN 6.12e) keeps the answers from going on.
 */
export const RETALIATION_AGGRESSION = 0;

/** The nation that struck `n`, when `n` holds a grievance against it and it is on `war`'s other side from `side` (PLAN 6.12b); else 0. */
function grievanceIn(world: World, n: number, war: War, side: number): number {
  const g = world.nukeGrievance.get(n);
  return g && g.until > world.tick && war.sides[1 - side]!.includes(g.by) ? g.by : 0;
}

/** Whether `n`, struck, strikes back at `war`'s other side from `side` (PLAN 6.4b): a grievance there, and the doctrine. */
function retaliates(world: World, n: number, war: War, side: number): boolean {
  return grievanceIn(world, n, war, side) !== 0 && world.nations.cols.aggression[n]! >= RETALIATION_AGGRESSION;
}

/**
 * How large a nation must be, against the striker, to threaten it (PLAN 6.12a): a share of the
 * striker's monthly income, a puppet's read as its overlord's (PLAN 6.12f: not the army's men, which
 * a war can take from a great power in two years; seed 6619's Soviet Union fell from 649,000 men to
 * 22,000, and statelets of 6,000 to 38,000 men, incomes of tens, passed a quarter of that).
 */
export const THREAT_SHARE = 0.25;

/**
 * Whether nation `m` can threaten `n` (PLAN 6.12a, critic R6-B2: the Soviet Union's first strikes in
 * history fell on a revolt statelet of its own land): `m` or its overlord has a warhead, or its
 * realm's income is THREAT_SHARE of `n`'s realm's (PLAN 6.12f), or its land forces stand within
 * CAPITAL_THREAT_KM of `n`'s capital. A nation that cannot is not struck first.
 */
export function threatens(world: World, m: number, n: number): boolean {
  const nc = world.nations.cols;
  const realm = (k: number): number => (nc.overlord[k]! !== 0 ? nc.overlord[k]! : k);
  const rm = realm(m);
  if (warheadsOf(world, m) > 0 || warheadsOf(world, rm) > 0) return true;
  if (nc.income[rm]! >= THREAT_SHARE * nc.income[realm(n)]!) return true;
  const cx = nc.capitalX[n]!;
  const cy = nc.capitalY[n]!;
  const c = world.formations.cols;
  let near = false;
  world.formations.forEach((id) => {
    if (near || c.nation[id] !== m || world.isFleet(id) || world.isWing(id) || world.offLand(id)) return;
    if (seaKm(world, cx, cy, c.x[id]!, c.y[id]!) <= CAPITAL_THREAT_KM) near = true;
  });
  return near;
}

/** Whose land a nation may strike in a war (PLAN 6.12): the nations, and whether from any distance. */
export interface Aim {
  at: ReadonlySet<number>;
  /** Not only within FRONT_KM of the striker's side: a strike back at who struck it, or in extreme desperation (PLAN 7.6c). */
  anywhere: boolean;
}

/**
 * Whose land `n`, on `side` of `war`, may strike: while it holds a grievance against a nation of
 * the other side, that nation's alone, from any distance (PLAN 6.12b, critic R6-B2: struck at
 * London, the United Kingdom's one bomb went to Chungking, and no Soviet place was within FRONT_KM
 * of it); else the enemies that can threaten it (PLAN 6.12a), from any distance in its extreme
 * desperation (PLAN 7.6c: seed 4's Soviet Union, its army gone and its capital moved east, had
 * China's capital 2,043 km off and the Chinese armies near it on its own land, and nothing to weigh
 * for a year at desperation 2; a nation fighting for its life strikes the enemy's heartland).
 */
export function aimOf(world: World, n: number, war: War, side: number, industry: () => Float64Array = industryOnce(world)): Aim {
  const by = grievanceIn(world, n, war, side);
  if (by !== 0) return { at: new Set([by]), anywhere: true };
  const nc = world.nations.cols;
  const at = new Set<number>();
  for (const m of war.sides[1 - side]!) if (nc.living[m] === 1 && threatens(world, m, n)) at.add(m);
  if (at.size === 0) return { at, anywhere: false };
  const { desperation, extreme } = desperationOf(world, n, war, side);
  const resolve = resolveOf(world, war, side, retaliationRisk(world, war, side), madWar(world, war));
  // A strike of the resolve falls on a nation of weight to the enemy side (PLAN 7.18h): seed 1's
  // Italy struck Mongolia and #114, of 0 and 0.4 % of the side's output; seed 2's Netherlands
  // Manchukuo, of 0.5 %.
  if (!extreme && resolve > desperation && at.size > 0) {
    const held = industry();
    let all = 0;
    for (const m of war.sides[1 - side]!) all += held[m] ?? 0;
    for (const m of [...at]) if ((held[m] ?? 0) < RESOLVE_WEIGHT * all) at.delete(m);
  }
  // From any distance too with the resolve to end a long war (PLAN 7.18e: seed 4's France, Britain
  // and Switzerland a year into a war on Japan, every Japanese place beyond FRONT_KM of them).
  return { at, anywhere: at.size > 0 && (extreme || resolve > 0) };
}

/** How far from the striker's side a place may be to be weighed (PLAN 6.11a), km: from its land formations or its capitals. */
export const FRONT_KM = 1000;
/**
 * The least a theatre's enemy men count for, as a share of all the enemy side's men (PLAN 7.18j,
 * ADR-492): a place's men are weighed against at least THEATRE_FLOOR of the side, so a lone garrison
 * is not the whole of its theatre (seed 4's Britain on Japanese garrisons of 2,267 to 5,229 men, 935
 * to 2,305 dead; seed 1's on #114's of 456 to 1,380, 168 to 2,875 dead).
 */
export const THEATRE_FLOOR = 0.25;
/** How long a burst keeps another warhead off its place (PLAN 6.11b), days. */
export const RESTRIKE_DAYS = 7;
/**
 * How far a burst of the last RESTRIKE_DAYS keeps other warheads off, in blast radii (PLAN 7.18d,
 * critic R8-B1: seed 7919's China struck four points of one Xinjiang town 40 to 100 km apart in
 * 4 days, each just past the radius of the one before: 641,568, then 18,088, 1,554 and 566 dead).
 */
export const RESTRIKE_RADII = 4;
/**
 * How long a burst keeps another warhead off an enemy capital it fell on, and off every place within a
 * blast radius of it (PLAN 7.6e), days, and how long a burst is remembered (`world.nukeBursts`).
 * Elsewhere a place of massed enemy men is weighed again after RESTRIKE_DAYS: men massed there again. Seed 5's Soviet Union struck one capital three times
 * and another four times in 40 days, and seed 4's one point 400 days apart (critic R7-B1: one Dutch
 * point a year apart).
 */
export const CAPITAL_RESTRIKE_DAYS = 365;

/**
 * The places `n` weighs in `war` on `side` (PLAN 6.4b): enemy capitals, then the NUKE_TARGETS
 * enemy land formations with the most enemy men within a blast radius of them, each at least a
 * radius from those taken before (PLAN 6.7: massed formations; the strongest formations alone
 * passed over twelve divisions massed before Paris for older ones of the same strength).
 * Each on land the enemy side owns and controls (PLAN 6.11a: not the striker's own land, a
 * neutral's nor the sea), within FRONT_KM of a land formation or a capital of `side`: a colony
 * or a capital-in-exile far from every front is not weighed (critic R6-B2: Paramaribo, Aden).
 * None within RESTRIKE_RADII blast radii of a burst of the last RESTRIKE_DAYS or of a warhead in
 * flight (PLAN 6.11b: the critic saw three in a row on one spot, its formations gone after the
 * first; PLAN 7.18d: four radii, not one), and
 * no capital within a blast radius of a burst of the last CAPITAL_RESTRIKE_DAYS, nor any place
 * within one of a burst on a capital (PLAN 7.6e); elsewhere a place of massed men is weighed after
 * RESTRIKE_DAYS, men massed again.
 * Only on land of the enemies `aim` names (by default `aimOf`: those that can threaten `n`, PLAN
 * 6.12a; the nation that struck it, from any distance, PLAN 6.12b); the massed men weighed are the
 * whole enemy side's.
 */
export function nukeTargets(world: World, n: number, war: War, side: number, aim: Aim = aimOf(world, n, war, side)): [number, number][] {
  const { at, anywhere } = aim;
  const nc = world.nations.cols;
  const out: [number, number][] = [];
  if (at.size === 0) return out;
  const c = world.formations.cols;
  const enemy = new Set(war.sides[1 - side]!);
  const own = new Set(war.sides[side]!);
  const land: number[] = [];
  const anchors: number[] = [];
  for (const m of war.sides[side]!) if (nc.living[m] === 1) anchors.push(nc.capitalX[m]!, nc.capitalY[m]!);
  world.formations.forEach((id) => {
    if (world.isFleet(id) || world.isWing(id) || world.offLand(id)) return;
    if (enemy.has(c.nation[id]!)) land.push(id);
    else if (own.has(c.nation[id]!)) anchors.push(c.x[id]!, c.y[id]!);
  });
  const { w, h, owner, controller } = world.cells;
  const radius = blastRadius(knows(world, n, 'thermonuclear') ? 2 : 1);
  // Bursts of the last RESTRIKE_DAYS and warheads in flight keep any place off. A burst of the last
  // CAPITAL_RESTRIKE_DAYS keeps off an enemy capital within a blast radius of it, and every place
  // within a blast radius of a burst on such a capital (PLAN 7.6e: seed 5's Soviet Union struck Tokyo
  // three times in 32 days, at the formations Japan raised there, each a place of massed men).
  const capitals: number[] = [];
  for (const m of war.sides[1 - side]!) if (nc.living[m] === 1) capitals.push(nc.capitalX[m]!, nc.capitalY[m]!);
  const within = (x: number, y: number, pts: readonly number[]): boolean => {
    for (let k = 0; k < pts.length; k += 2) if (seaKm(world, x, y, pts[k]!, pts[k + 1]!) <= radius) return true;
    return false;
  };
  const struck: number[] = [];
  const struckYear: number[] = [];
  const struckCapital: number[] = [];
  for (const b of world.nukeBursts) {
    if (b.tick > world.tick - CAPITAL_RESTRIKE_DAYS * 24) {
      struckYear.push(b.x, b.y);
      if (within(b.x, b.y, capitals)) struckCapital.push(b.x, b.y);
    }
    if (b.tick > world.tick - RESTRIKE_DAYS * 24) struck.push(b.x, b.y);
  }
  for (const l of world.nukeLaunches) struck.push(l.tx, l.ty);
  const nearStruck = (x: number, y: number): boolean => {
    for (let k = 0; k < struck.length; k += 2) if (seaKm(world, x, y, struck[k]!, struck[k + 1]!) <= RESTRIKE_RADII * radius) return true;
    return false;
  };
  const struckThisYear = (x: number, y: number): boolean => within(x, y, struckYear);
  const fair = (x: number, y: number): boolean => {
    const xx = cellX(world, Math.floor(x));
    const yy = Math.floor(y);
    if (xx === null || yy < 0 || yy >= h) return false;
    const cell = yy * w + xx;
    if (!at.has(owner[cell]!) || !enemy.has(controller[cell]!)) return false;
    if (nearStruck(x, y) || within(x, y, struckCapital)) return false;
    if (anywhere) return true;
    for (let k = 0; k < anchors.length; k += 2) if (seaKm(world, x, y, anchors[k]!, anchors[k + 1]!) <= FRONT_KM) return true;
    return false;
  };
  for (const m of war.sides[1 - side]!) if (nc.living[m] === 1 && at.has(m) && fair(nc.capitalX[m]!, nc.capitalY[m]!) && !struckThisYear(nc.capitalX[m]!, nc.capitalY[m]!)) out.push([nc.capitalX[m]!, nc.capitalY[m]!]);
  const near = (a: number, b: number): boolean => Math.abs(c.y[a]! - c.y[b]!) <= radius / 10 && seaKm(world, c.x[a]!, c.y[a]!, c.x[b]!, c.y[b]!) <= radius;
  const mass = new Map<number, number>();
  for (const a of land) {
    let m = 0;
    for (const b of land) if (near(a, b)) m += c.strength[b]!;
    mass.set(a, m);
  }
  land.sort((a, b) => mass.get(b)! - mass.get(a)! || a - b);
  const taken: number[] = [];
  for (const id of land) {
    if (taken.length >= NUKE_TARGETS) break;
    if (taken.some((t) => near(t, id)) || !fair(c.x[id]!, c.y[id]!)) continue;
    taken.push(id);
    out.push([c.x[id]!, c.y[id]!]);
  }
  return out;
}

/** How `n` weighs one of its wars on a day (PLAN 7.6: the decision's parts, read by a diagnostic too). */
export interface WarWeighing {
  /** The enemies it may strike (`aimOf`). */
  aim: Aim;
  /** The inputs shared by its places (none when `aim` is empty). */
  shared: Omit<NukeInputs, 'targetValue' | 'through'> | null;
  /** The places weighed, each one's value and the chance a warhead gets there (PLAN 7.18i). */
  places: { x: number; y: number; value: number; through: number }[];
}

/** `n`'s weighing of `war` on `side` (PLAN 6.4b), `industry` the day's (`industryOnce`). */
export function weighWar(world: World, n: number, war: War, side: number, industry: () => Float64Array): WarWeighing {
  const aim = aimOf(world, n, war, side, industry);
  if (aim.at.size === 0) return { aim, shared: null, places: [] };
  const shared = warInputs(world, n, war, side, retaliates(world, n, war, side));
  const view = strikeView(world, n, war, side, industry);
  return {
    aim,
    shared,
    places: nukeTargets(world, n, war, side, aim).map(([x, y]) => {
      const p = partsIn(world, n, view, x, y);
      return { x, y, value: p.value, through: p.through };
    }),
  };
}

/** Whether `n` holds a grievance against an enemy in one of its wars (PLAN 6.12b): it then weighs that war alone. */
export function avengingOf(world: World, n: number): boolean {
  return world.wars.list.some((war) => {
    const side = war.sides[0].includes(n) ? 0 : war.sides[1].includes(n) ? 1 : -1;
    return side >= 0 && grievanceIn(world, n, war, side) !== 0;
  });
}

/** Whether nation `n` weighs strikes today (PLAN 6.4b): a warhead, living, its AI on, no overlord, nukes allowed. */
export function weighsStrikes(world: World, n: number): boolean {
  const nc = world.nations.cols;
  return warheadsOf(world, n) >= 1 && nc.living[n] === 1 && nc.aiOff[n] !== 1 && nc.overlord[n] === 0 && nukesAllowed(world, n);
}

/** Whether `n` on `side` of `war`, avenging or not, weighs it today (PLAN 6.12b). */
export function weighsWar(world: World, n: number, war: War, side: number, avenging: boolean): boolean {
  return side >= 0 && !(avenging && grievanceIn(world, n, war, side) === 0);
}

/** The day's industry by nation, summed when first asked for (PLAN 6.10; a diagnostic's too). */
export function dayIndustry(world: World): () => Float64Array {
  return industryOnce(world);
}

/**
 * The days a side waits after its launch in a war before a first use again (PLAN 7.25b, the critic's
 * run 8: a world's whole nuclear history one side's strikes day after day, seed 7's Germany four on
 * four days running, 6271's Soviet Union three on three): it waits for the answer, the shock of the
 * burst (NUKE_SHOCK) on the enemy's exhaustion, a peace. Of the launch, not the burst: a warhead shot
 * down is a launch seen. A strike back is not held (one for one, its burst gives none: PLAN 6.12b, e).
 */
export const STRIKE_GAP_DAYS = 7;

/** Whether `side` of `war` launched within STRIKE_GAP_DAYS (PLAN 7.25b): no first use of it today. */
export function strikePaused(world: World, war: War, side: number): boolean {
  const last = war.lastStrike?.[side];
  return last !== undefined && last >= 0 && world.tick - last < STRIKE_GAP_DAYS * 24;
}

/** The day's decisions to strike (PLAN 6.4b): see the head of the file. */
function nukeDecisions(world: World): void {
  if (!world.settings.aiEnabled || world.warheads.size === 0) return;
  const industry = industryOnce(world);
  for (const n of [...world.warheads.keys()].sort((a, b) => a - b)) {
    if (!weighsStrikes(world, n)) continue;
    const options: { u: number; x: number; y: number; back: boolean; war: War; side: number; resolved: boolean }[] = [];
    // While it holds a grievance against an enemy, it strikes no one else (PLAN 6.12b).
    const avenging = avengingOf(world, n);
    for (const war of world.wars.list) {
      const side = war.sides[0].includes(n) ? 0 : war.sides[1].includes(n) ? 1 : -1;
      if (!weighsWar(world, n, war, side, avenging)) continue;
      // A first use waits for the answer to its side's last launch (PLAN 7.25b); a strike back does not.
      if (!avenging && strikePaused(world, war, side)) continue;
      const { shared, places } = weighWar(world, n, war, side, industry);
      if (!shared) continue;
      // Whether the resolve, not the side's own desperation, weighs this war's strikes (PLAN 7.18h).
      let resolved: boolean | null = null;
      for (const { x, y, value, through } of places) {
        const u = nuclearUtility({ targetValue: value, through, ...shared });
        if (u <= NUKE_FLOOR) continue;
        if (resolved === null) {
          const own = desperationOf(world, n, war, side);
          resolved = !own.extreme && shared.desperation > own.desperation;
        }
        options.push({ u, x, y, back: avenging, war, side, resolved });
      }
    }
    options.sort((a, b) => b.u - a.u);
    const missiles = knows(world, n, 'ballistic_missiles');
    for (const o of options) {
      const ok = (missiles && launchNuke(world, n, o.x, o.y, true) === Refusal.None) || launchNuke(world, n, o.x, o.y, false) === Refusal.None;
      if (!ok) continue;
      world.out.emit(world.tick, EventKind.NukeDecided, n, Math.round(o.u * 1000), o.x, o.y);
      // The war remembers its side's strike (PLAN 7.18e: the resolve's gap).
      const last: [number, number] = o.war.lastStrike ? [...o.war.lastStrike] : [-1, -1];
      last[o.side] = world.tick;
      o.war.lastStrike = last;
      // And counts the strikes of its resolve (PLAN 7.18h: a few a war).
      if (o.resolved) {
        const count: [number, number] = o.war.resolveStrikes ? [...o.war.resolveStrikes] : [0, 0];
        count[o.side] = count[o.side]! + 1;
        o.war.resolveStrikes = count;
      }
      // A strike back spends the grievance: one for one (of retaliation doctrine or not, PLAN 6.12b),
      // and its burst gives none (PLAN 6.12e).
      if (o.back) {
        world.nukeGrievance.delete(n);
        world.nukeAnswers.add(world.nextLaunchId - 1);
      }
      break;
    }
  }
  for (const [n, g] of [...world.nukeGrievance]) if (g.until <= world.tick) world.nukeGrievance.delete(n);
}

/** A burst's consequences (PLAN 6.5a): see the head of the file. */
export const NUKE_SHOCK = 30;
export const NUKE_SHOCK_MAX = 60;
export const NUKE_SHOCK_DECAY = 0.5;
export const NUKE_GOLD = 0.1;
export const NUKE_UNREST = 40;
export const NUKE_UNITY = 20;

/** The nation whose land is at (x, y), 0 for none. */
function ownerAt(world: World, x: number, y: number): number {
  const xx = cellX(world, Math.floor(x));
  return xx === null ? 0 : (world.cells.owner[Math.min(world.cells.h - 1, Math.max(0, Math.floor(y))) * world.cells.w + xx] ?? 0);
}

/** `striker`'s burst of `yieldN` at (x, y), `dead` killed: its consequences and its history entry (PLAN 6.5a). */
export function aftermath(world: World, striker: number, yieldN: number, x: number, y: number, dead: number): void {
  const struck = ownerAt(world, x, y);
  world.out.emit(world.tick, EventKind.NukeCasualties, striker, packNukeStrike(struck === striker ? 0 : struck, yieldN, dead), x, y);
  const ally = striker === 0 ? undefined : world.alliances.allianceOf(striker);
  if (ally) {
    ally.unity = Math.max(0, ally.unity - NUKE_UNITY);
    world.alliances.changed();
  }
  // The dead on its land, all told (PLAN 7.12: the statistics' nuclear dead), whoever struck.
  if (struck !== 0 && dead > 0) world.nukeDead.set(struck, (world.nukeDead.get(struck) ?? 0) + dead);
  if (struck === 0 || struck === striker) return;
  // No outrage at God (striker 0, PLAN 6.6a).
  if (striker !== 0) world.nukeOutrage.set(striker, Math.min(100, (world.nukeOutrage.get(striker) ?? 0) + OUTRAGE_STRIKE));
  world.nukeShock.set(struck, Math.min(NUKE_SHOCK_MAX, (world.nukeShock.get(struck) ?? 0) + NUKE_SHOCK));
  const nc = world.nations.cols;
  nc.gold[struck] = nc.gold[struck]! - Math.max(0, nc.gold[struck]!) * NUKE_GOLD;
  // Unrest: each province with land within twice the radius, once.
  const reach = 2 * blastRadius(yieldN);
  const { w, h, province } = world.cells;
  const ry = Math.ceil(reach / 10) + 1;
  const rx = Math.ceil(reach / 4) + 1;
  const seen = new Set<number>();
  for (let yy = Math.max(0, Math.floor(y) - ry); yy <= Math.min(h - 1, Math.floor(y) + ry); yy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const xx = cellX(world, Math.floor(x) + dx);
      if (xx === null) continue;
      const p = province[yy * w + xx]!;
      if (p === 0 || seen.has(p) || seaKm(world, x, y, xx + 0.5, yy + 0.5) > reach) continue;
      seen.add(p);
    }
  }
  const pv = world.provinces;
  for (const p of [...seen].sort((a, b) => a - b)) if (p < pv.unrest.length) pv.unrest[p] = Math.min(100, pv.unrest[p]! + NUKE_UNREST);
  if (seen.size > 0) pv.version++;
}

/** The shock's and outrage's day (PLAN 6.5a, 6.5b): each less by its decay, gone at 0. */
function shockDay(world: World): void {
  for (const [n, v] of [...world.nukeShock]) {
    if (v <= NUKE_SHOCK_DECAY) world.nukeShock.delete(n);
    else world.nukeShock.set(n, v - NUKE_SHOCK_DECAY);
  }
  for (const [n, v] of [...world.nukeOutrage]) {
    if (v <= OUTRAGE_DECAY) world.nukeOutrage.delete(n);
    else world.nukeOutrage.set(n, v - OUTRAGE_DECAY);
  }
}

/** Outrage (PLAN 6.5b): see the head of the file. */
export const OUTRAGE_STRIKE = 40;
export const OUTRAGE_DECAY = 0.025;
export const OUTRAGE_COST = 0.1;
export const OUTRAGE_WEIGHT = 0.3;
export const RELATION_NEAR_KM = 2000;
export const RELATION_FAR_KM = 8000;
export const RELATION_FAR_SHARE = 0.25;
export const ALLY_SHARE = 0.25;
export const PARIAH_COALITION = 40;

/** How far `observer`'s relations with `striker` are hit by the world's outrage at it (PLAN 6.5b), 0 to 1. */
export function relationHit(world: World, observer: number, striker: number): number {
  const o = world.nukeOutrage.size === 0 || observer === striker ? 0 : (world.nukeOutrage.get(striker) ?? 0);
  if (o <= 0) return 0;
  const nc = world.nations.cols;
  const km = seaKm(world, nc.capitalX[observer]!, nc.capitalY[observer]!, nc.capitalX[striker]!, nc.capitalY[striker]!);
  const far = km <= RELATION_NEAR_KM ? 1 : km >= RELATION_FAR_KM ? RELATION_FAR_SHARE : 1 - ((1 - RELATION_FAR_SHARE) * (km - RELATION_NEAR_KM)) / (RELATION_FAR_KM - RELATION_NEAR_KM);
  const close = world.alliances.allied(observer, striker) || nc.overlord[observer] === striker || nc.overlord[striker] === observer;
  return (Math.min(100, o) / 100) * far * (close ? ALLY_SHARE : 1);
}

/** The nation the world is most outraged at, PARIAH_COALITION or more, living; 0 for none (PLAN 6.5b). */
export function worstPariah(world: World): number {
  let worst = 0;
  for (const [n, v] of [...world.nukeOutrage].sort((a, b) => a[0] - b[0])) {
    if (v >= PARIAH_COALITION && world.nations.has(n) && world.nations.cols.living[n] === 1 && (worst === 0 || v > world.nukeOutrage.get(worst)!)) worst = n;
  }
  return worst;
}

/** The taboo's day (PLAN 6.4a): back towards 1. Nothing while it is 1. */
function tabooDay(world: World): void {
  if (world.nukeTaboo >= 1) return;
  world.nukeTaboo = Math.min(1, world.nukeTaboo + TABOO_RECOVERY);
}

/**
 * A warhead of `nation`'s (0: God Mode's, PLAN 6.6a) of `yieldN` bursts at (x, y): told,
 * remembered for CAPITAL_RESTRIKE_DAYS (PLAN 6.11b, 7.6e), the taboo broken (PLAN 6.4a), the
 * grievance of the land's owner's realm (PLAN 6.4b, not against God: a puppet's is its overlord's,
 * PLAN 7.6e, which decides for it; seed 3's United Kingdom, a Soviet puppet with 21 warheads, was
 * struck by Germany and nobody answered), the blast, the fallout and the consequences.
 */
export function detonate(world: World, nation: number, yieldN: number, x: number, y: number, answer = false): void {
  world.out.emit(world.tick, EventKind.NukeDetonated, nation, yieldN, x, y);
  world.nukeTaboo = Math.min(world.nukeTaboo, TABOO_AFTER);
  world.nukeBursts.push({ x, y, tick: world.tick, yieldN });
  const owner = ownerAt(world, x, y);
  const struck = owner !== 0 && world.nations.cols.overlord[owner]! !== 0 ? world.nations.cols.overlord[owner]! : owner;
  // A strike back settles the score (PLAN 6.12e): its burst gives no grievance.
  if (nation !== 0 && struck !== 0 && struck !== nation && !answer) world.nukeGrievance.set(struck, { by: nation, until: world.tick + RETALIATION_DAYS * 24 });
  const toll = blast(world, yieldN, x, y);
  layFallout(world, yieldN, x, y);
  aftermath(world, nation, yieldN, x, y, toll.men + toll.people);
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
    const answer = world.nukeAnswers.delete(l.id);
    if (lost || hashToUnit(hash32(world.seed, l.id, SALT_INTERCEPT)) < interceptChance(world, l)) world.out.emit(world.tick, EventKind.NukeIntercepted, l.nation, l.id, l.tx, l.ty);
    else detonate(world, l.nation, knows(world, l.nation, 'thermonuclear') ? 2 : 1, l.tx, l.ty, answer);
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
  // The bursts older than CAPITAL_RESTRIKE_DAYS forgotten (PLAN 6.11b, 7.6e).
  if (world.nukeBursts.length > 0) world.nukeBursts = world.nukeBursts.filter((b) => b.tick > world.tick - CAPITAL_RESTRIKE_DAYS * 24);
  tabooDay(world);
  shockDay(world);
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
    if (w.stock >= WARHEAD_MAX || nc.gold[n]! < pay || WARHEAD_UPKEEP * (w.stock + 1) > STOCKPILE_SHARE * nc.income[n]!) return;
    nc.gold[n] = nc.gold[n]! - pay;
    w.paid += pay;
    if (w.paid >= WARHEAD_GOLD - 1e-9) {
      w.stock++;
      w.paid = 0;
    }
    world.warheads.set(n, w);
  });
}
