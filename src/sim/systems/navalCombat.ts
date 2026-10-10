/**
 * Fleet battles (PLAN 4.3a, SPEC §6.2): detection, contact, the range of a battle and gunnery
 * by range, at the level of the ship.
 *
 * Detection (hourly): a fleet of a nation at war sees an enemy fleet within its best ship's
 * `detection` (km) × (1 − the enemy's least stealthy ship's `stealth` / 100). Two fleets of
 * nations at war in which either sees the other, and of which one has a weapon (a gun: `rangeKm`
 * and `hard` above 0; torpedoes: `torpedoKm` and `torpedo`), are in contact; fleets in contact, joined, are one sea battle. A fleet in a battle
 * is `engaged`: it holds (the movement system leaves it), as a land formation in contact does.
 *
 * The range of a battle (km, `world.seaRange`, state): at its first hour the distance of its
 * nearest pair in contact, then each hour by the two sides' reach (their longest gun) and pace
 * (their slowest ship's top speed; a reach is a side's longest gun or torpedo). Beyond both reaches both close; between the two the side of
 * the shorter reach closes at what its pace has over the other's, and the other holds it off;
 * within the shorter reach it stays. A side's fleets are the battle's that are not at war with
 * its first fleet's nation; the other side, those that are.
 *
 * Fire (per battle, per hour): every ship with a gun that reaches the range fires at a ship of an
 * enemy fleet in its battle, chosen by weight (its hit points: a battleship draws more fire than a
 * destroyer) with hash32(seed, tick, element) and kept for `COOLDOWN` hours. Damage in ships:
 *   hard × (ARMOR_PEN where its armour beats the shell's piercing) × SEA_FIRE_SCALE
 *       × the attack buffs of the shooter ÷ the defence buffs of the target ÷ target hpPerUnit.
 * All volleys of an hour before any loss (simultaneous), as on land. A ship's end is the
 * element's (`ElementDestroyed`); a fleet with no ship left is gone. Each volley emits a
 * FireEvent (not state).
 *
 * Torpedoes and the screen (PLAN 4.3b): a ship with torpedoes fires them at its target too, where
 * their reach (`torpedoKm`) covers the range; a submarine whatever the range (it closes
 * submerged). A torpedo's damage is its `torpedo` with no armour against it, × the screen of
 * the target: a ship that is no destroyer, of a side with destroyers in the battle, takes
 * × (1 − SCREEN × min(1, its side's destroyers ÷ its side's other surface ships)). A
 * submarine is no target of a gun or a torpedo (it is under water): only of depth charges
 * (`asw`, a destroyer's), whatever the range, chosen among the enemy's submarines.
 *
 * Not here: a fleet breaking off (PLAN 4.3c); sea control (PLAN 4.4); the AI's orders (PLAN 4.6).
 */
import { hash32, hashToUnit } from '../core/hash';
import { hypot } from '../core/dmath';
import { navOf, type World } from '../world';
import { applyLoss, elementIndex, elementPlace, settleFormation, slotCount } from './elements';
import { ARMOR_PEN, COOLDOWN } from './combat';

/** Ships removed per hour by one ship per point of `hard` against a target of 1 hit point. */
export const SEA_FIRE_SCALE = 2;
/** The share of the torpedoes' damage a full screen of destroyers takes off (one destroyer to each other surface ship of the side). */
export const SCREEN = 0.6;
const SALT_TARGET = 0x5e47;
const SALT_HUNT = 0x5e49;
const SALT_SUBTICK = 0x5e48;

/** What the battle reads of a fleet at the hour's start. */
interface FleetFacts {
  id: number;
  nation: number;
  /** Its best ship's detection, km; its least stealthy ship's stealth; its longest gun, km; its pace, km/h. */
  detection: number;
  stealth: number;
  reach: number;
  kmh: number;
}

/** The distance in km between two points (cells) of the map: by the km of a cell at their middle row, the short way round a looping map. */
export function seaKm(world: World, x0: number, y0: number, x1: number, y1: number): number {
  const g = navOf(world).grid;
  const w = world.cells.w;
  let dx = Math.abs(x1 - x0);
  if (world.settings.loopingMap && dx > w / 2) dx = w - dx;
  const row = Math.min(g.h - 1, Math.max(0, Math.floor((y0 + y1) / 2)));
  return hypot(dx * g.kx[row]!, (y1 - y0) * g.ky[row]!);
}

/** The range of a battle after an hour, from `r`: by the reach and the pace of its two sides (see the head of the file). */
export function nextRange(r: number, reachA: number, kmhA: number, reachB: number, kmhB: number): number {
  const long = Math.max(reachA, reachB);
  const short = Math.min(reachA, reachB);
  if (r > long) return Math.max(long, r - (kmhA + kmhB));
  if (r > short) {
    const closer = reachA < reachB ? kmhA : kmhB;
    const keeper = reachA < reachB ? kmhB : kmhA;
    return Math.max(short, r - Math.max(0, closer - keeper));
  }
  return r;
}

function factsOf(world: World, id: number, els: readonly number[]): FleetFacts | null {
  const units = world.rules!.units;
  const ec = world.elements.cols;
  let detection = 0;
  let stealth = Infinity;
  let reach = 0;
  for (const e of els) {
    if (ec.strength[e]! <= 0) continue;
    const u = units[ec.unit[e]!]!;
    detection = Math.max(detection, u.detection);
    stealth = Math.min(stealth, u.stealth);
    if (u.hard > 0) reach = Math.max(reach, u.rangeKm);
    if (u.torpedo > 0) reach = Math.max(reach, u.torpedoKm);
  }
  if (stealth === Infinity) return null;
  const rule = world.rules!.templates[world.formations.cols.template[id]!];
  return { id, nation: world.formations.cols.nation[id]!, detection, stealth, reach, kmh: rule?.speedKmh ?? 0 };
}

/** Fleets in contact, joined into battles (ascending ids), and the nearest distance of a pair in each; sets `engaged`. */
export function findSeaBattles(world: World): { fleets: number[]; km: number }[] {
  const f = world.formations;
  const c = f.cols;
  const idx = elementIndex(world);
  const atWar = world.wars.nations();
  const facts: FleetFacts[] = [];
  f.forEach((id) => {
    if (!world.afloat(id) || !atWar.has(c.nation[id]!)) return;
    const els = idx.get(id);
    const ff = els ? factsOf(world, id, els) : null;
    if (ff) facts.push(ff);
  });
  const parent = new Map<number, number>();
  const nearest = new Map<number, number>();
  const find = (a: number): number => {
    let r = a;
    while (parent.get(r) !== r) r = parent.get(r)!;
    return r;
  };
  for (let i = 0; i < facts.length; i++) {
    const a = facts[i]!;
    for (let j = i + 1; j < facts.length; j++) {
      const b = facts[j]!;
      if (a.reach <= 0 && b.reach <= 0) continue;
      if (!world.wars.atWar(a.nation, b.nation)) continue;
      const km = seaKm(world, c.x[a.id]!, c.y[a.id]!, c.x[b.id]!, c.y[b.id]!);
      const sees = Math.max(a.detection * (1 - b.stealth / 100), b.detection * (1 - a.stealth / 100));
      if (km > sees) continue;
      if (!parent.has(a.id)) parent.set(a.id, a.id);
      if (!parent.has(b.id)) parent.set(b.id, b.id);
      const ra = find(a.id);
      const rb = find(b.id);
      if (ra !== rb) parent.set(ra > rb ? ra : rb, ra > rb ? rb : ra);
      nearest.set(a.id, Math.min(nearest.get(a.id) ?? Infinity, km));
      nearest.set(b.id, Math.min(nearest.get(b.id) ?? Infinity, km));
    }
  }
  const groups = new Map<number, { fleets: number[]; km: number }>();
  for (const id of [...parent.keys()].sort((p, q) => p - q)) {
    const r = find(id);
    let g = groups.get(r);
    if (!g) groups.set(r, (g = { fleets: [], km: Infinity }));
    g.fleets.push(id);
    g.km = Math.min(g.km, nearest.get(id)!);
    c.engaged[id] = 1;
  }
  return [...groups.values()].sort((p, q) => p.fleets[0]! - q.fleets[0]!);
}

export function navalCombatSystem(world: World): void {
  const battles = findSeaBattles(world);
  const ranges = world.seaRange;
  const fighting = new Set<number>();
  if (battles.length === 0) {
    ranges.clear();
    return;
  }
  const units = world.rules!.units;
  const f = world.formations.cols;
  const e = world.elements;
  const ec = e.cols;
  const idx = elementIndex(world);
  const fires = world.out.fires;
  const bf = world.buffs;
  for (const battle of battles) {
    const first = f.nation[battle.fleets[0]!]!;
    // The two sides: the reach and pace of each, and the range of the hour.
    let reachA = 0;
    let reachB = 0;
    let kmhA = Infinity;
    let kmhB = Infinity;
    let r = Infinity;
    for (const id of battle.fleets) {
      fighting.add(id);
      const ff = factsOf(world, id, idx.get(id)!)!;
      if (world.wars.atWar(first, ff.nation)) {
        reachB = Math.max(reachB, ff.reach);
        kmhB = Math.min(kmhB, ff.kmh);
      } else {
        reachA = Math.max(reachA, ff.reach);
        kmhA = Math.min(kmhA, ff.kmh);
      }
      const stored = ranges.get(id);
      if (stored !== undefined) r = Math.min(r, stored);
    }
    if (r === Infinity) r = battle.km;
    else r = nextRange(r, reachA, kmhA, reachB, kmhB);

    const pending = new Map<number, number>();
    // Each side's screen: its destroyers and its other surface ships alive at the hour's start.
    const screenOf = new Map<number, number>();
    const screen = (n: number): number => {
      let v = screenOf.get(n);
      if (v === undefined) {
        let dd = 0;
        let big = 0;
        for (const o of battle.fleets) {
          if (world.wars.atWar(n, f.nation[o]!)) continue;
          for (const el of idx.get(o)!) {
            if (ec.strength[el]! <= 0) continue;
            const cls = units[ec.unit[el]!]!.cls;
            if (cls === 'dd') dd++;
            else if (cls !== 'ss') big++;
          }
        }
        screenOf.set(n, (v = big === 0 ? 1 : 1 - SCREEN * Math.min(1, dd / big)));
      }
      return v;
    };
    for (const sf of battle.fleets) {
      const n = f.nation[sf]!;
      const enemies = battle.fleets.filter((o) => world.wars.atWar(n, f.nation[o]!));
      const buffAtk = Math.max(0, 1 + bf.sum('attack', 'nation', n) + bf.sum('attack', 'formation', sf));
      // The enemy's ships by weight (hit points): on the surface, and under water.
      const tables: ({ cand: number[]; cum: number[]; total: number } | null)[] = [null, null];
      const tableOf = (sub: boolean): { cand: number[]; cum: number[]; total: number } => {
        let table = tables[sub ? 1 : 0];
        if (!table) {
          const cand: number[] = [];
          const cum: number[] = [];
          let total = 0;
          for (const tf of enemies) {
            for (const tid of idx.get(tf) ?? []) {
              if (ec.strength[tid]! <= 0 || (units[ec.unit[tid]!]!.cls === 'ss') !== sub) continue;
              total += units[ec.unit[tid]!]!.hpPerUnit * ec.strength[tid]!;
              cand.push(tid);
              cum.push(total);
            }
          }
          tables[sub ? 1 : 0] = table = { cand, cum, total };
        }
        return table;
      };
      const pick = (table: { cand: number[]; cum: number[]; total: number }, s: number, salt: number): number => {
        if (table.total <= 0) return 0;
        const u = hashToUnit(hash32(world.seed, world.tick, s, salt)) * table.total;
        let lo = 0;
        let hi = table.cand.length - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (table.cum[mid]! > u) hi = mid;
          else lo = mid + 1;
        }
        return table.cand[lo]!;
      };
      const volley = (s: number, t: number, dmg: number): void => {
        if (dmg <= 0) return;
        const tf = ec.formation[t]!;
        pending.set(t, (pending.get(t) ?? 0) + dmg);
        const [x0, y0] = elementPlace(world, sf, ec.slot[s]!, slotCount(world, sf, idx.get(sf)!.length), s);
        const [x1, y1] = elementPlace(world, tf, ec.slot[t]!, slotCount(world, tf, idx.get(tf)!.length), t);
        fires.push(world.tick, hash32(world.seed, world.tick, s, SALT_SUBTICK) % 60, s, t, ec.unit[s]!, dmg, x0, y0, x1, y1);
      };
      const defOf = (t: number): number => {
        const tf = ec.formation[t]!;
        return Math.max(0.05, 1 + bf.sum('defense', 'nation', f.nation[tf]!) + bf.sum('defense', 'formation', tf));
      };
      for (const s of idx.get(sf)!) {
        if (ec.strength[s]! <= 0) continue;
        const us = units[ec.unit[s]!]!;
        const full = (ec.strength[s]! / us.size) * SEA_FIRE_SCALE * buffAtk;
        const gun = us.hard > 0 && us.rangeKm >= r;
        const torpedo = us.torpedo > 0 && (us.cls === 'ss' || us.torpedoKm >= r);
        if (gun || torpedo) {
          // A target on the surface, kept while it lives and is the enemy's.
          let t = ec.target[s]!;
          const valid = t !== 0 && e.has(t) && ec.strength[t]! > 0 && enemies.includes(ec.formation[t]!) && units[ec.unit[t]!]!.cls !== 'ss';
          if (valid && ec.cooldown[s]! > 0) {
            ec.cooldown[s] = ec.cooldown[s]! - 1;
          } else {
            t = pick(tableOf(false), s, SALT_TARGET);
            ec.target[s] = t;
            ec.cooldown[s] = COOLDOWN;
          }
          if (t !== 0) {
            const ut = units[ec.unit[t]!]!;
            if (gun) volley(s, t, (us.hard * (ut.armor > us.piercing ? ARMOR_PEN : 1) * full) / defOf(t) / ut.hpPerUnit);
            if (torpedo) volley(s, t, (us.torpedo * full * (ut.cls === 'dd' ? 1 : screen(f.nation[ec.formation[t]!]!))) / defOf(t) / ut.hpPerUnit);
          }
        }
        if (us.asw > 0) {
          // Depth charges at a submarine of the enemy, whatever the range.
          const t = pick(tableOf(true), s, SALT_HUNT);
          if (t !== 0) volley(s, t, (us.asw * full) / defOf(t) / units[ec.unit[t]!]!.hpPerUnit);
        }
      }
    }
    for (const t of [...pending.keys()].sort((p, q) => p - q)) applyLoss(world, t, pending.get(t)!);
    for (const id of battle.fleets) {
      settleFormation(world, id);
      if (world.formations.has(id)) ranges.set(id, r);
    }
  }
  for (const id of [...ranges.keys()]) if (!fighting.has(id) || !world.formations.has(id)) ranges.delete(id);
}
