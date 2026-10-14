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
 */
import { isDayStart } from '../../shared/calendar';
import { Refusal } from '../../shared/commands';
import { EventKind } from '../../shared/events';
import { hash32, hashToUnit } from '../core/hash';
import { pow } from '../core/dmath';
import { knowsTechs, techMask } from '../tech';
import { airOf, type NukeLaunch, type World } from '../world';
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

/** Nation `n` launches a warhead at (x, y) by bomber or missile (PLAN 6.2): see the head of the file; why not, else None. */
export function launchNuke(world: World, n: number, x: number, y: number, missile: boolean): Refusal {
  if (!nukesAllowed(world, n)) return Refusal.NoNukes;
  if (warheadsOf(world, n) < 1) return Refusal.NoWarhead;
  const c = world.formations.cols;
  let from: [number, number] | null = null;
  let wing = 0;
  let kmh = MISSILE_KMH;
  let km = Infinity;
  if (missile) {
    const nc = world.nations.cols;
    if (!knows(world, n, 'ballistic_missiles')) return Refusal.NoDelivery;
    from = [nc.capitalX[n]!, nc.capitalY[n]!];
    km = seaKm(world, from[0], from[1], x, y);
    if (km > MISSILE_KM) return Refusal.NoDelivery;
  } else {
    const rules = world.rules!;
    for (const [id, base] of [...world.wingBase].sort((a, b) => a[0] - b[0])) {
      if (base <= 0 || c.nation[id] !== n || world.sorties.has(id) || carriesNuke(world, id) || !world.formations.has(id)) continue;
      const first = rules.templates[c.template[id]!]?.elements[0];
      if (!first || rules.units[first.unit]!.cls !== STRATEGIC) continue;
      const at = basePlace(world, base);
      if (!at) continue;
      const d = seaKm(world, at[0], at[1], x, y);
      if (d <= wingRange(world, id) && d < km) [wing, from, km] = [id, at, d];
    }
    if (wing === 0 || !from) return Refusal.NoDelivery;
    kmh = rules.templates[c.template[wing]!]!.speedKmh;
    world.wingMission.delete(wing);
    world.sorties.set(wing, { bx: from[0], by: from[1], tx: x, ty: y, launch: world.tick, kmh, km, over: 0 });
  }
  const h = world.warheads.get(n)!;
  h.stock--;
  world.nukeLaunches.push({ id: world.nextLaunchId++, nation: n, missile: missile ? 1 : 0, wing, bx: from![0], by: from![1], tx: x, ty: y, launch: world.tick, arrive: world.tick + km / Math.max(1, kmh) });
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
      blast(world, l.nation, yieldN, l.tx, l.ty);
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
