/**
 * Engagement + element combat v1 (SPEC §5.1–5.2, PLAN 1.13).
 *
 * Engagement (hourly): land formations with elements are bucketed in a spatial hash
 * (BUCKET_CELLS ≈ 40–50 km at M). Two formations of nations at war whose centres are within
 * CONTACT_CELLS are in contact; connected contacts form one battle (derived each tick; a
 * persistent battle record with names and major-battle state comes with SPEC §5.4). Formations
 * in contact are `engaged`: they hold position (movement pauses) and fight. A formation on the
 * retreat (`systems/retreat.ts`) is in no contact and no battle.
 *
 * Fire (per battle, per hour): every element picks a target among the elements of hostile
 * formations in its battle, weighted by effectiveness × target health (strength × hpPerUnit: a
 * battalion draws more fire than a battery, so every element type bleeds at the same rate) ×
 * proximity, drawn with
 * hash32(seed, tick, element) and kept for COOLDOWN hours. Damage in target units is
 *   eff × fullness × FIRE_SCALE × terrainAttack(shooter class and unit type, target cell)
 *       × (0.5 + 0.5 supply) × (ORG_FIRE + (1 − ORG_FIRE) org) of the shooter's formation
 *       × combinedArms(shooter's side) × air(shooter's nation, its zone) × gunsOnGuns(shooter) × screen(target) × open(shooter, target) ÷ terrainDefence(target cell and unit type, if holding) ÷ target hpPerUnit
 * where eff = hard vs armoured targets else soft, × ARMOR_PEN when armour beats piercing,
 * combinedArms is COMBINED_ARMS for a side with infantry, artillery and armour alive in the battle,
 * air is 1 + AIR_SUPERIORITY × (2s − 1), s the shooter's nation's air superiority in its air zone
 * (PLAN 5.4a; 1 while no one has flown anywhere),
 * gunsOnGuns is SUPPRESSED for an AT gun whose enemy has artillery alive in the battle,
 * screen is UNSCREENED for armour on close ground whose side has no infantry alive in the battle, and
 * open is IN_THE_OPEN for armour firing at a target with no armour on open ground whose side has no AT gun alive in the battle.
 * All fire in an hour is computed before any loss is applied (simultaneous volleys), so the
 * order of elements cannot bias the result; total fire ∝ surviving strength (Lanchester square).
 * Each volley emits a FireEvent (TickOutputs.fires; not state).
 *
 * What the hour took of each formation is left in `world.battleLosses` for the org that goes
 * with it (`orgLossSystem` of `systems/retreat.ts`, PLAN 3.5a).
 */
import combatJson from '../../../data/combat.json' with { type: 'json' };
import terrainJson from '../../../data/terrain.json' with { type: 'json' };
import { hash32, hashToUnit } from '../core/hash';
import { TERRAIN_IDS } from '../../shared/terrain';
import { airOf, ARM_ALL, ARM_ARMOUR, ARM_ARTILLERY, ARM_AT, ARM_INFANTRY, type UnitRule, type World } from '../world';
import { airSuperiority } from './airSuperiority';
import { applyLoss, cellDist as dist, CONTACT_CELLS, deployAll, elementIndex, elementPlace, settleFormation, slotCount } from './elements';
import { MAJOR_LOSS_MULT, updateMajorBattles } from './majorBattles';

export { CONTACT_CELLS };
const BUCKET_CELLS = 2;
/** Target units removed per hour by a full element per point of soft/hard attack. */
export const FIRE_SCALE = 0.1;
export const ARMOR_PEN = 0.5;
export const COOLDOWN = 4;
const SALT_TARGET = 0x7a46;

/**
 * The fire of a side of a battle that has infantry, artillery and armour alive in it (PLAN
 * 3.4a, `data/combat.json`). A formation's side is the battle's formations its nation is not
 * at war with, itself among them.
 */
export const COMBINED_ARMS = combatJson.combinedArms.bonus;
/**
 * What full air superiority adds to a formation's fire, and none takes off it (PLAN 5.4a, `air`
 * of `data/combat.json`): the fire × (1 + this × (2s − 1)), s its nation's superiority in its
 * air zone (`airSuperiority`).
 */
export const AIR_SUPERIORITY = combatJson.air.superiority;

/**
 * The air's factor on formation `fid`'s fire (PLAN 5.4a): 1 where no one has flown. `memo`: the
 * factors worked out in this hour, by zone and nation (PLAN 7.1e: the air of a battle's zone was
 * summed again for each of its formations).
 */
export function airFactor(world: World, fid: number, memo?: Map<number, number>): number {
  if (world.airPower.size === 0) return 1;
  const c = world.formations.cols;
  const zone = airOf(world).zoneOf[Math.floor(c.y[fid]!) * world.cells.w + Math.floor(c.x[fid]!)]!;
  const key = zone * world.nations.highWater + c.nation[fid]!;
  let a = memo?.get(key);
  if (a === undefined) {
    a = 1 + AIR_SUPERIORITY * (2 * airSuperiority(world, c.nation[fid]!, zone) - 1);
    memo?.set(key, a);
  }
  return a;
}
/**
 * What armour takes on close ground (`CLOSE`) when its side has no infantry alive in the battle
 * (PLAN 3.4b, `screen` of `data/combat.json`).
 */
export const UNSCREENED = combatJson.screen.taken;
/**
 * The fire of an AT gun whose enemy has artillery alive in the battle (PLAN 3.4c, `gunsOnGuns`
 * of `data/combat.json`). Its enemy: the battle's formations its nation is at war with.
 */
export const SUPPRESSED = combatJson.gunsOnGuns.fire;
const CLOSE = TERRAIN_IDS.map((id) => (combatJson.screen.terrain as string[]).includes(id));
/**
 * The fire of armour at a target with no armour on open ground (`OPEN`) whose side has no AT gun
 * alive in the battle (PLAN 3.4d, `open` of `data/combat.json`).
 */
export const IN_THE_OPEN = combatJson.open.fire;
const OPEN = TERRAIN_IDS.map((id) => (combatJson.open.terrain as string[]).includes(id));

const TERRAIN_DEF = terrainJson.terrain.map((t) => t.defense);
const TERRAIN_ATK = terrainJson.terrain.map((t) => t.attack as Record<string, number | undefined>);
/**
 * The ground's factor on a unit type's fire, by unit type and terrain (`units.length` ×
 * `TERRAIN_ATK.length`): its class's on that terrain × its own (PLAN 3.3a). Worked out once for
 * a game's unit rules (PLAN 7.1e: the class's was looked up by name at every volley).
 */
const attacks = new WeakMap<readonly UnitRule[], Float64Array>();
function attackTable(units: readonly UnitRule[]): Float64Array {
  let table = attacks.get(units);
  if (!table) {
    const nt = TERRAIN_ATK.length;
    table = new Float64Array(units.length * nt);
    for (let u = 0; u < units.length; u++) for (let t = 0; t < nt; t++) table[u * nt + t] = (TERRAIN_ATK[t]![units[u]!.cls] ?? 1) * units[u]!.terrainAtk[t]!;
    attacks.set(units, table);
  }
  return table;
}

/**
 * The buckets of `findBattles`, kept between calls (not state) and empty between them: a
 * bucket's first fighter is `head` (an index into the call's fighters), `full` says it has
 * one, each fighter's next in its bucket is `next` (−1 at the end) and its bucket `key`. A
 * bucket is read by its key plus one row (`bw`), so the row above the map and the row below
 * it are buckets too; a key beyond those (a place off the map) has its bucket in `over`.
 * PLAN 7.1d: a `Map` of the buckets was looked up nine times a fighter an hour, most of them
 * empty, 4 % of year 1.
 */
const scratch = { full: new Uint8Array(0), head: new Int32Array(0), next: new Int32Array(0), key: new Int32Array(0) };

/** Groups formations into battles (ascending ids); sets `engaged`. */
export function findBattles(world: World): number[][] {
  const f = world.formations;
  const c = f.cols;
  const idx = elementIndex(world);
  const w = world.cells.w;
  const bw = Math.ceil(w / BUCKET_CELLS);
  const bh = Math.ceil(world.cells.h / BUCKET_CELLS);
  const fighters: number[] = [];
  // Only formations of nations at war can make contact (review after PLAN 1.25).
  const atWar = world.wars.nations();
  f.forEach((id) => {
    c.engaged[id] = 0;
    // One on the retreat is in no battle (PLAN 3.5a): it does not fire and is not fired on.
    // A fleet is in no battle of the land (PLAN 4.2b): the sea's are PLAN 4.3.
    if (c.retreat[id]! > 0 || !atWar.has(c.nation[id]!) || !idx.has(id) || world.offLand(id)) return;
    fighters.push(id);
  });
  const slots = (bh + 2) * bw;
  if (scratch.full.length !== slots) {
    scratch.full = new Uint8Array(slots);
    scratch.head = new Int32Array(slots);
  }
  if (scratch.next.length < fighters.length) {
    scratch.next = new Int32Array(Math.max(fighters.length, 2 * scratch.next.length));
    scratch.key = new Int32Array(scratch.next.length);
  }
  const { full, head, next, key } = scratch;
  const over = new Map<number, number[]>();
  // Every fighter in a bucket of the map, which has three columns or more: each bucket's
  // neighbours are each other's, and none is two of them.
  let onMap = bw >= 3;
  // Backwards, each to the front of its bucket: a bucket's fighters come out by ascending id.
  for (let i = fighters.length - 1; i >= 0; i--) {
    const id = fighters[i]!;
    const bx = Math.floor(c.x[id]! / BUCKET_CELLS);
    const by = Math.floor(c.y[id]! / BUCKET_CELLS);
    if (bx < 0 || bx >= bw || by < 0 || by >= bh) onMap = false;
    const k = by * bw + bx + bw;
    key[i] = k;
    if (k < 0 || k >= slots) {
      let b = over.get(k);
      if (!b) over.set(k, (b = []));
      b.unshift(i);
      continue;
    }
    next[i] = full[k] === 1 ? head[k]! : -1;
    head[k] = i;
    full[k] = 1;
  }
  const near = new Map<number, [number, number]>();
  const parent = new Map<number, number>();
  const find = (a: number): number => {
    let r = a;
    while (parent.get(r) !== r) r = parent.get(r)!;
    while (a !== r) {
      const n = parent.get(a)!;
      parent.set(a, r);
      a = n;
    }
    return r;
  };
  const pair = (a: number, b: number): void => {
    if (b <= a || !world.wars.atWar(c.nation[a]!, c.nation[b]!)) return;
    const d = dist(world, c.x[a]!, c.y[a]!, c.x[b]!, c.y[b]!);
    if (d > CONTACT_CELLS) return;
    // Each one's nearest enemy in contact (the lower id on a tie): where its block deploys (`deployOf`).
    const na = near.get(a);
    if (!na || d < na[1] || (d === na[1] && b < na[0])) near.set(a, [b, d]);
    const nb = near.get(b);
    if (!nb || d < nb[1] || (d === nb[1] && a < nb[0])) near.set(b, [a, d]);
    if (!parent.has(a)) parent.set(a, a);
    if (!parent.has(b)) parent.set(b, b);
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra > rb ? ra : rb, ra > rb ? rb : ra);
    c.engaged[a] = 1;
    c.engaged[b] = 1;
  };
  // Fighter `a` with each of bucket `k`'s, the lower id first.
  const across = (a: number, k: number): void => {
    if (full[k] !== 1) return;
    for (let i = head[k]!; i >= 0; i = next[i]!) {
      const b = fighters[i]!;
      if (a < b) pair(a, b);
      else pair(b, a);
    }
  };
  try {
    // Each pair once (PLAN 7.1d: a fighter's own bucket from it on, then the four buckets after
    // it), where nine buckets a fighter met each pair twice: a cell of a front holds a stack. The
    // pairs are the same, and the lower id first, as `pair` asks.
    if (onMap) {
      for (let ia = 0; ia < fighters.length; ia++) {
        const a = fighters[ia]!;
        for (let i = next[ia]!; i >= 0; i = next[i]!) pair(a, fighters[i]!);
        const k = key[ia]!;
        const bx = (k - bw) % bw;
        const row = k - bx;
        const left = bx === 0 ? bw - 1 : bx - 1;
        const right = bx === bw - 1 ? 0 : bx + 1;
        across(a, row + right);
        across(a, row + bw + left);
        across(a, row + bw + bx);
        across(a, row + bw + right);
      }
    } else {
      for (const a of fighters) {
        const bx = Math.floor(c.x[a]! / BUCKET_CELLS);
        const by = Math.floor(c.y[a]! / BUCKET_CELLS);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            // Over the seam whatever the map: candidates only, and `dist` keeps to the edges of a
            // map that does not loop (PLAN 3.12Rs), so a bucket of the other edge gives no pair.
            const k = (by + dy) * bw + ((bx + dx + bw) % bw) + bw;
            if (k < 0 || k >= slots) {
              for (const i of over.get(k) ?? []) pair(a, fighters[i]!);
              continue;
            }
            if (full[k] !== 1) continue;
            for (let i = head[k]!; i >= 0; i = next[i]!) pair(a, fighters[i]!);
          }
        }
      }
    }
  } finally {
    // Empty again for the next call.
    for (let i = 0; i < fighters.length; i++) if (key[i]! >= 0 && key[i]! < slots) full[key[i]!] = 0;
  }
  // Derived, for where the blocks stand this hour; not state (`contactsOf` gives the same from the state).
  deployAll(world, new Map([...near].map(([id, [enemy]]) => [id, enemy])));
  const groups = new Map<number, number[]>();
  for (const a of [...parent.keys()].sort((p, q) => p - q)) {
    const r = find(a);
    let g = groups.get(r);
    if (!g) groups.set(r, (g = []));
    g.push(a);
  }
  return [...groups.values()].sort((p, q) => p[0]! - q[0]!);
}

/** Attack value of a shooter type against a target type (SPEC §5.2 step 2). */
export function effectiveness(us: UnitRule, ut: UnitRule): number {
  const base = ut.armor > 0 ? us.hard : us.soft;
  return ut.armor > us.piercing ? base * ARMOR_PEN : base;
}

/**
 * The share of its fire a formation with no org keeps (PLAN 3.2c): between that and all of it
 * by its org. Not nothing: a formation out of order still shoots, and one that dealt no damage
 * would stand in contact for good.
 */
export const ORG_FIRE = 0.25;

/**
 * The hour's fire of `combatSystem`, kept between calls (not state): by element, the damage it
 * takes (`hurt`, 0 between calls; the elements hit are the first of `hit`) and where it stands (`px`,
 * `py`, set where `placed` holds the call's `stamp`); by formation, its slots (`slots`) and its
 * defence's buffs (`guard`), set where `counted` and `guarded` hold the stamp. PLAN 7.1e: a
 * `Map` of each, and the buffs looked up by a string at every volley, were 2.5 % of year 1.
 */
const fire = {
  stamp: 0,
  hurt: new Float64Array(0),
  hit: new Int32Array(0),
  placed: new Uint32Array(0),
  px: new Float64Array(0),
  py: new Float64Array(0),
  counted: new Uint32Array(0),
  slots: new Int32Array(0),
  guarded: new Uint32Array(0),
  guard: new Float64Array(0),
};

/** Sizes `fire` to the tables' ids and starts a call: returns its stamp. */
function fireCall(world: World): number {
  const ne = world.elements.highWater;
  if (fire.hurt.length < ne) {
    const n = Math.max(ne, 2 * fire.hurt.length);
    fire.hurt = new Float64Array(n);
    fire.hit = new Int32Array(n);
    fire.placed = new Uint32Array(n);
    fire.px = new Float64Array(n);
    fire.py = new Float64Array(n);
  }
  const nf = world.formations.highWater;
  if (fire.slots.length < nf) {
    const n = Math.max(nf, 2 * fire.slots.length);
    fire.counted = new Uint32Array(n);
    fire.slots = new Int32Array(n);
    fire.guarded = new Uint32Array(n);
    fire.guard = new Float64Array(n);
  }
  fire.stamp = (fire.stamp + 1) >>> 0 || 1;
  return fire.stamp;
}

export function combatSystem(world: World): void {
  world.battleLosses.length = 0;
  const battles = findBattles(world);
  const inMajor = updateMajorBattles(world, battles); // PLAN 1.23: also ends unmatched ones
  if (battles.length === 0) return;
  const rules = world.rules!;
  const units = rules.units;
  const f = world.formations.cols;
  const e = world.elements;
  const ec = e.cols;
  const idx = elementIndex(world);
  const w = world.cells.w;
  const cellOf = (fid: number): number => Math.floor(f.y[fid]!) * w + Math.floor(f.x[fid]!);
  const fires = world.out.fires;
  const stamp = fireCall(world);
  const attack = attackTable(units);
  const nt = TERRAIN_ATK.length;
  const airs = new Map<number, number>();
  const { hurt, hit, placed, px, py, counted, slots, guarded, guard } = fire;
  // Where each element stands this hour, worked out once: an element is shot at by many, and
  // its place holds for the hour (the blocks are set, and no formation moves in here).
  const place = (fid: number, el: number): void => {
    if (placed[el] === stamp) return;
    if (counted[fid] !== stamp) {
      slots[fid] = slotCount(world, fid, idx.get(fid)!.length);
      counted[fid] = stamp;
    }
    const [x, y] = elementPlace(world, fid, ec.slot[el]!, slots[fid]!, el);
    px[el] = x;
    py[el] = y;
    placed[el] = stamp;
  };
  const bf = world.buffs;
  // The buffs on formation `tf`'s defence (they hold for the hour).
  const guardOf = (tf: number): number => {
    if (guarded[tf] !== stamp) {
      guard[tf] = Math.max(0.05, 1 + bf.sum('defense', 'nation', f.nation[tf]!) + bf.sum('defense', 'formation', tf));
      guarded[tf] = stamp;
    }
    return guard[tf]!;
  };

  for (const battle of battles) {
    // How many elements are hit in the battle (the first of `hit`); what each takes is in `hurt`.
    let hits = 0;
    const lossMult = inMajor.has(battle[0]!) ? MAJOR_LOSS_MULT : 1;
    // The arms each formation has alive at the hour's start (losses apply after the volleys).
    const arms = new Map<number, number>();
    for (const fid of battle) {
      let a = 0;
      for (const s of idx.get(fid) ?? []) if (ec.strength[s]! > 0) a |= units[ec.unit[s]!]!.arm;
      arms.set(fid, a);
    }
    // By nation, as a battle has few nations and many formations: its enemies in the battle (in
    // the battle's order) and the arms of its side, the battle's formations it is not at war with.
    const sides = new Map<number, { enemies: number[]; hostile: Set<number>; arms: number }>();
    for (const fid of battle) {
      const n = f.nation[fid]!;
      if (sides.has(n)) continue;
      const enemies: number[] = [];
      let a = 0;
      for (const o of battle) {
        if (world.wars.atWar(n, f.nation[o]!)) enemies.push(o);
        else a |= arms.get(o)!;
      }
      sides.set(n, { enemies, hostile: new Set(enemies), arms: a });
    }
    const sideArmsOf = (fid: number): number => sides.get(f.nation[fid]!)!.arms;
    for (const sf of battle) {
      const { enemies, hostile } = sides.get(f.nation[sf]!)!;
      const sideArms = sideArmsOf(sf);
      // What every volley of the formation has: its supply, its org, its side's three arms, the air.
      const shooterFactor = (0.5 + 0.5 * f.supply[sf]!) * (ORG_FIRE + (1 - ORG_FIRE) * f.org[sf]!) * ((sideArms & ARM_ALL) === ARM_ALL ? COMBINED_ARMS : 1) * airFactor(world, sf, airs);
      let enemyArms = 0;
      for (const o of enemies) enemyArms |= arms.get(o)!;
      const atFire = (enemyArms & ARM_ARTILLERY) !== 0 ? SUPPRESSED : 1;
      // Combat efficiency (PLAN 1.22; 0 = unset, e.g. toy nations, counts as 1) and the buffs on its attack.
      const ce = world.nations.cols.efficiency[f.nation[sf]!] || 1;
      const buffAtk = ce * Math.max(0, 1 + bf.sum('attack', 'nation', f.nation[sf]!) + bf.sum('attack', 'formation', sf));
      const tables = new Map<number, { cand: number[]; cum: number[]; total: number }>();
      for (const s of idx.get(sf) ?? []) {
        const us = units[ec.unit[s]!]!;
        const fullness = ec.strength[s]! / us.size;
        if (fullness <= 0) continue;
        const eff = (t: number): number => effectiveness(us, units[ec.unit[t]!]!);
        // Keep the cached target while it lives and stays hostile in this battle.
        let t = ec.target[s]!;
        const valid = t !== 0 && e.has(t) && ec.strength[t]! > 0 && hostile.has(ec.formation[t]!);
        if (valid && ec.cooldown[s]! > 0) {
          ec.cooldown[s] = ec.cooldown[s]! - 1;
        } else {
          t = 0;
          // Weights depend only on the shooter's unit type and formation (strengths change only
          // after the hour's volleys), so one table per (formation, unit) serves all its elements.
          let table = tables.get(ec.unit[s]!);
          if (!table) {
            const cand: number[] = [];
            const cum: number[] = [];
            let total = 0;
            for (const tf of enemies) {
              const prox = 1 / (1 + dist(world, f.x[sf]!, f.y[sf]!, f.x[tf]!, f.y[tf]!));
              for (const tid of idx.get(tf) ?? []) {
                if (ec.strength[tid]! <= 0) continue;
                const wt = eff(tid) * ec.strength[tid]! * units[ec.unit[tid]!]!.hpPerUnit * prox;
                if (wt <= 0) continue;
                total += wt;
                cand.push(tid);
                cum.push(total);
              }
            }
            tables.set(ec.unit[s]!, (table = { cand, cum, total }));
          }
          if (table.total > 0) {
            // First candidate whose cumulative weight exceeds u (binary search).
            const u = hashToUnit(hash32(world.seed, world.tick, s, SALT_TARGET)) * table.total;
            let lo = 0;
            let hi = table.cand.length - 1;
            while (lo < hi) {
              const mid = (lo + hi) >> 1;
              if (table.cum[mid]! > u) hi = mid;
              else lo = mid + 1;
            }
            t = table.cand[lo]!;
          }
          ec.target[s] = t;
          ec.cooldown[s] = COOLDOWN;
        }
        if (t === 0) continue;
        const tf = ec.formation[t]!;
        const ut = units[ec.unit[t]!]!;
        const cell = cellOf(tf);
        const terrain = world.cells.terrain[cell]!;
        // The ground the target stands on, by the shooter's class and by its unit type (PLAN 3.3a).
        const atk = attack[ec.unit[s]! * nt + terrain]!;
        const def = f.moving[tf] === 1 ? 1 : (TERRAIN_DEF[terrain] ?? 1) * ut.terrainDef[terrain]!;
        const buffDef = guardOf(tf);
        // Armour on close ground with no infantry of its side in the battle (PLAN 3.4b).
        const screen = (ut.arm & ARM_ARMOUR) !== 0 && CLOSE[terrain] && (sideArmsOf(tf) & ARM_INFANTRY) === 0 ? UNSCREENED : 1;
        // An AT gun under the enemy's artillery (PLAN 3.4c).
        const guns = (us.arm & ARM_AT) !== 0 ? atFire : 1;
        // Armour at what has no armour, on open ground, with no AT gun of the target's side in the battle (PLAN 3.4d).
        const open = (us.arm & ARM_ARMOUR) !== 0 && ut.armor === 0 && OPEN[terrain] && (sideArmsOf(tf) & ARM_AT) === 0 ? IN_THE_OPEN : 1;
        const dmg = (eff(t) * fullness * FIRE_SCALE * atk * shooterFactor * buffAtk * lossMult * screen * guns * open) / def / buffDef / ut.hpPerUnit;
        if (dmg <= 0) continue;
        if (hurt[t] === 0) hit[hits++] = t;
        hurt[t] = hurt[t]! + dmg;
        place(sf, s);
        place(tf, t);
        const subtick = hash32(world.seed, world.tick, s, 0x5b7) % 60;
        fires.push(world.tick, subtick, s, t, ec.unit[s]!, dmg, px[s]!, py[s]!, px[t]!, py[t]!);
      }
    }
    // Simultaneous volleys: apply every loss after all fire is computed, in id order.
    const struck = hit.subarray(0, hits).sort();
    for (const t of struck) {
      applyLoss(world, t, hurt[t]!);
      hurt[t] = 0;
    }
    for (const fid of battle) {
      const before = f.strength[fid]!;
      settleFormation(world, fid);
      // For the org that goes with the losses (`orgLossSystem`, PLAN 3.5a).
      if (world.formations.has(fid) && f.strength[fid]! < before) world.battleLosses.push(fid, before, f.strength[fid]!);
    }
  }
}
