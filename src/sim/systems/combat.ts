/**
 * Engagement + element combat v1 (SPEC §5.1–5.2, PLAN 1.13).
 *
 * Engagement (hourly): land formations with elements are bucketed in a spatial hash
 * (BUCKET_CELLS ≈ 40–50 km at M). Two formations of nations at war whose centres are within
 * CONTACT_CELLS are in contact; connected contacts form one battle (derived each tick; a
 * persistent battle record with names and major-battle state comes with SPEC §5.4). Formations
 * in contact are `engaged`: they hold position (movement pauses) and fight.
 *
 * Fire (per battle, per hour): every element picks a target among the elements of hostile
 * formations in its battle, weighted by effectiveness × target health (strength × hpPerUnit: a
 * battalion draws more fire than a battery, so every element type bleeds at the same rate) ×
 * proximity, drawn with
 * hash32(seed, tick, element) and kept for COOLDOWN hours. Damage in target units is
 *   eff × fullness × FIRE_SCALE × terrainAttack(shooter class and unit type, target cell)
 *       × supplyFactor(shooter) × combinedArms(shooter's side) × screen(target) ÷ terrainDefence(target cell and unit type, if holding) ÷ target hpPerUnit
 * where eff = hard vs armoured targets else soft, × ARMOR_PEN when armour beats piercing,
 * combinedArms is COMBINED_ARMS for a side with infantry, artillery and armour alive in the battle, and
 * screen is UNSCREENED for armour on close ground whose side has no infantry alive in the battle.
 * All fire in an hour is computed before any loss is applied (simultaneous volleys), so the
 * order of elements cannot bias the result; total fire ∝ surviving strength (Lanchester square).
 * Each volley emits a FireEvent (TickOutputs.fires; not state).
 */
import combatJson from '../../../data/combat.json' with { type: 'json' };
import terrainJson from '../../../data/terrain.json' with { type: 'json' };
import { hash32, hashToUnit } from '../core/hash';
import { TERRAIN_IDS } from '../../shared/terrain';
import { ARM_ALL, ARM_ARMOUR, ARM_INFANTRY, type UnitRule, type World } from '../world';
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
 * What armour takes on close ground (`CLOSE`) when its side has no infantry alive in the battle
 * (PLAN 3.4b, `screen` of `data/combat.json`).
 */
export const UNSCREENED = combatJson.screen.taken;
const CLOSE = TERRAIN_IDS.map((id) => (combatJson.screen.terrain as string[]).includes(id));

const TERRAIN_DEF = terrainJson.terrain.map((t) => t.defense);
const TERRAIN_ATK = terrainJson.terrain.map((t) => t.attack as Record<string, number | undefined>);

/** Groups formations into battles (ascending ids); sets `engaged`. */
export function findBattles(world: World): number[][] {
  const f = world.formations;
  const c = f.cols;
  const idx = elementIndex(world);
  const w = world.cells.w;
  const bw = Math.ceil(w / BUCKET_CELLS);
  const buckets = new Map<number, number[]>();
  const fighters: number[] = [];
  // Only formations of nations at war can make contact (review after PLAN 1.25).
  const atWar = world.wars.nations();
  f.forEach((id) => {
    c.engaged[id] = 0;
    if (!idx.has(id) || !atWar.has(c.nation[id]!)) return;
    fighters.push(id);
    const k = Math.floor(c.y[id]! / BUCKET_CELLS) * bw + Math.floor(c.x[id]! / BUCKET_CELLS);
    let b = buckets.get(k);
    if (!b) buckets.set(k, (b = []));
    b.push(id);
  });
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
  for (const a of fighters) {
    const bx = Math.floor(c.x[a]! / BUCKET_CELLS);
    const by = Math.floor(c.y[a]! / BUCKET_CELLS);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const list = buckets.get((by + dy) * bw + ((bx + dx + bw) % bw));
        if (!list) continue;
        for (const b of list) {
          if (b <= a || !world.wars.atWar(c.nation[a]!, c.nation[b]!)) continue;
          const d = dist(world, c.x[a]!, c.y[a]!, c.x[b]!, c.y[b]!);
          if (d > CONTACT_CELLS) continue;
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
        }
      }
    }
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
function effectiveness(us: UnitRule, ut: UnitRule): number {
  const base = ut.armor > 0 ? us.hard : us.soft;
  return ut.armor > us.piercing ? base * ARMOR_PEN : base;
}

/**
 * The share of its fire a formation with no org keeps (PLAN 3.2c): between that and all of it
 * by its org. Not nothing: a formation out of order still shoots, and one that dealt no damage
 * would stand in contact for good.
 */
export const ORG_FIRE = 0.25;

export function combatSystem(world: World): void {
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

  for (const battle of battles) {
    const pending = new Map<number, number>();
    const lossMult = inMajor.has(battle[0]!) ? MAJOR_LOSS_MULT : 1;
    // The arms each formation has alive at the hour's start (losses apply after the volleys).
    const arms = new Map<number, number>();
    for (const fid of battle) {
      let a = 0;
      for (const s of idx.get(fid) ?? []) if (ec.strength[s]! > 0) a |= units[ec.unit[s]!]!.arm;
      arms.set(fid, a);
    }
    // The arms of each formation's side: of the battle's formations its nation is not at war with.
    const sideArmsOf = new Map<number, number>();
    for (const fid of battle) {
      let a = 0;
      for (const o of battle) if (!world.wars.atWar(f.nation[fid]!, f.nation[o]!)) a |= arms.get(o)!;
      sideArmsOf.set(fid, a);
    }
    for (const sf of battle) {
      const enemies = battle.filter((o) => world.wars.atWar(f.nation[sf]!, f.nation[o]!));
      const hostile = new Set(enemies);
      const sideArms = sideArmsOf.get(sf)!;
      const supplyFactor = (0.5 + 0.5 * f.supply[sf]!) * (ORG_FIRE + (1 - ORG_FIRE) * f.org[sf]!) * (sideArms === ARM_ALL ? COMBINED_ARMS : 1);
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
        const atk = (TERRAIN_ATK[terrain]![us.cls] ?? 1) * us.terrainAtk[terrain]!;
        const def = f.moving[tf] === 1 ? 1 : (TERRAIN_DEF[terrain] ?? 1) * ut.terrainDef[terrain]!;
        const bf = world.buffs;
        // Combat efficiency (PLAN 1.22; 0 = unset, e.g. toy nations, counts as 1).
        const ce = world.nations.cols.efficiency[f.nation[sf]!] || 1;
        const buffAtk = ce * Math.max(0, 1 + bf.sum('attack', 'nation', f.nation[sf]!) + bf.sum('attack', 'formation', sf));
        const buffDef = Math.max(0.05, 1 + bf.sum('defense', 'nation', f.nation[tf]!) + bf.sum('defense', 'formation', tf));
        // Armour on close ground with no infantry of its side in the battle (PLAN 3.4b).
        const screen = (ut.arm & ARM_ARMOUR) !== 0 && CLOSE[terrain] && (sideArmsOf.get(tf)! & ARM_INFANTRY) === 0 ? UNSCREENED : 1;
        const dmg = (eff(t) * fullness * FIRE_SCALE * atk * supplyFactor * buffAtk * lossMult * screen) / def / buffDef / ut.hpPerUnit;
        if (dmg <= 0) continue;
        pending.set(t, (pending.get(t) ?? 0) + dmg);
        const sl = idx.get(sf)!;
        const tl = idx.get(tf)!;
        const [x0, y0] = elementPlace(world, sf, ec.slot[s]!, slotCount(world, sf, sl.length));
        const [x1, y1] = elementPlace(world, tf, ec.slot[t]!, slotCount(world, tf, tl.length));
        const subtick = hash32(world.seed, world.tick, s, 0x5b7) % 60;
        fires.push(world.tick, subtick, s, t, ec.unit[s]!, dmg, x0, y0, x1, y1);
      }
    }
    // Simultaneous volleys: apply every loss after all fire is computed, in id order.
    for (const t of [...pending.keys()].sort((p, q) => p - q)) applyLoss(world, t, pending.get(t)!);
    for (const fid of battle) settleFormation(world, fid);
  }
}
