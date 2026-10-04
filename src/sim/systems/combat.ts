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
 *   eff × fullness × FIRE_SCALE × terrainAttack(shooter class, target cell)
 *       × supplyFactor(shooter) ÷ terrainDefence(target cell, if holding) ÷ target hpPerUnit
 * where eff = hard vs armoured targets else soft, × ARMOR_PEN when armour beats piercing.
 * All fire in an hour is computed before any loss is applied (simultaneous volleys), so the
 * order of elements cannot bias the result; total fire ∝ surviving strength (Lanchester square).
 * Each volley emits a FireEvent (TickOutputs.fires; not state).
 */
import terrainJson from '../../../data/terrain.json' with { type: 'json' };
import { hash32, hashToUnit } from '../core/hash';
import { sqrt } from '../core/dmath';
import { SLOT_SPACING, slotPose } from '../core/pose';
import type { UnitRule, World } from '../world';
import { applyLoss, elementIndex, settleFormation } from './elements';
import { MAJOR_LOSS_MULT, updateMajorBattles } from './majorBattles';

export const CONTACT_CELLS = 1.5;
const BUCKET_CELLS = 2;
/** Target units removed per hour by a full element per point of soft/hard attack. */
export const FIRE_SCALE = 0.1;
export const ARMOR_PEN = 0.5;
export const COOLDOWN = 4;
const SALT_TARGET = 0x7a46;

const TERRAIN_DEF = terrainJson.terrain.map((t) => t.defense);
const TERRAIN_ATK = terrainJson.terrain.map((t) => t.attack as Record<string, number | undefined>);

/** Distance in cells between two points, wrapping east-west. */
function dist(world: World, ax: number, ay: number, bx: number, by: number): number {
  const w = world.cells.w;
  let dx = Math.abs(ax - bx);
  if (dx > w / 2) dx = w - dx;
  const dy = ay - by;
  return sqrt(dx * dx + dy * dy);
}

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
          if (dist(world, c.x[a]!, c.y[a]!, c.x[b]!, c.y[b]!) > CONTACT_CELLS) continue;
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
    for (const sf of battle) {
      const enemies = battle.filter((o) => world.wars.atWar(f.nation[sf]!, f.nation[o]!));
      const supplyFactor = 0.5 + 0.5 * f.supply[sf]!;
      const hostile = new Set(enemies);
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
        const atk = TERRAIN_ATK[terrain]![us.cls] ?? 1;
        const def = f.moving[tf] === 1 ? 1 : (TERRAIN_DEF[terrain] ?? 1);
        const bf = world.buffs;
        // Combat efficiency (PLAN 1.22; 0 = unset, e.g. toy nations, counts as 1).
        const ce = world.nations.cols.efficiency[f.nation[sf]!] || 1;
        const buffAtk = ce * Math.max(0, 1 + bf.sum('attack', 'nation', f.nation[sf]!) + bf.sum('attack', 'formation', sf));
        const buffDef = Math.max(0.05, 1 + bf.sum('defense', 'nation', f.nation[tf]!) + bf.sum('defense', 'formation', tf));
        const dmg = (eff(t) * fullness * FIRE_SCALE * atk * supplyFactor * buffAtk * lossMult) / def / buffDef / ut.hpPerUnit;
        if (dmg <= 0) continue;
        pending.set(t, (pending.get(t) ?? 0) + dmg);
        const sl = idx.get(sf)!;
        const tl = idx.get(tf)!;
        const [x0, y0] = slotPose(f.x[sf]!, f.y[sf]!, f.facing[sf]!, ec.slot[s]!, sl.length, SLOT_SPACING);
        const [x1, y1] = slotPose(f.x[tf]!, f.y[tf]!, f.facing[tf]!, ec.slot[t]!, tl.length, SLOT_SPACING);
        const subtick = hash32(world.seed, world.tick, s, 0x5b7) % 60;
        fires.push(world.tick, subtick, s, t, ec.unit[s]!, dmg, x0, y0, x1, y1);
      }
    }
    // Simultaneous volleys: apply every loss after all fire is computed, in id order.
    for (const t of [...pending.keys()].sort((p, q) => p - q)) applyLoss(world, t, pending.get(t)!);
    for (const fid of battle) settleFormation(world, fid);
  }
}
