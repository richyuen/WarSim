/**
 * Strategic bombing (PLAN 5.5a, SPEC §6.3): a strike on the enemy's land drops its aircraft's
 * bombs (`bombT`, tons each) on the industry within reach of its target. The cells there that
 * a nation at war with the bomber's controls, with any industry (`cells.econ`), share the
 * bombs by their industry: each loses the same share of what it produces, tons × `BOMB_DAMAGE`
 * over their industry together, up to `MAX_DAMAGE`. The damage is state (`world.bombDamage`, by
 * cell, saved while not empty); the monthly income takes it off a cell's output; it is repaired
 * day by day, `REPAIR_DAILY` of it.
 */
import type { World } from '../world';
import { elementIndex } from './elements';

/** $M of a year's industrial output a ton of bombs puts out of work. */
export const BOMB_DAMAGE = 2;
/** The most of a cell's industry bombs can put out of work. */
export const MAX_DAMAGE = 0.9;
/** The share of a cell's damage repaired each day (a half-life of about 35 days). */
export const REPAIR_DAILY = 0.02;
/** Damage under this is repaired whole, so that a cell left alone leaves the state. */
export const DAMAGE_FLOOR = 0.001;
/** How far, cells, a strike's bombs fall about its target (each way, a square). */
export const BOMB_CELLS = 1;

/**
 * The bombs of wing `wing` on the industry about (tx, ty): its aircraft's tons, shared as the
 * header says. Returns the tons that fell on industry (0 where there is none of an enemy's).
 */
export function bombIndustry(world: World, wing: number, tx: number, ty: number): number {
  const rules = world.rules!;
  const ec = world.elements.cols;
  let tons = 0;
  for (const e of elementIndex(world).get(wing) ?? []) tons += ec.strength[e]! * rules.units[ec.unit[e]!]!.bombT;
  if (tons === 0) return 0;
  const { w, h, controller, econ } = world.cells;
  const nation = world.formations.cols.nation[wing]!;
  const cells: number[] = [];
  let total = 0;
  const cx = Math.floor(tx);
  const cy = Math.floor(ty);
  for (let dy = -BOMB_CELLS; dy <= BOMB_CELLS; dy++) {
    const y = cy + dy;
    if (y < 0 || y >= h) continue;
    for (let dx = -BOMB_CELLS; dx <= BOMB_CELLS; dx++) {
      const c = y * w + ((((cx + dx) % w) + w) % w);
      if (econ[c] === 0 || !world.wars.atWar(nation, controller[c]!)) continue;
      cells.push(c);
      total += econ[c]!;
    }
  }
  if (total === 0) return 0;
  const share = (tons * BOMB_DAMAGE) / total;
  for (const c of cells) world.bombDamage.set(c, Math.min(MAX_DAMAGE, (world.bombDamage.get(c) ?? 0) + share));
  return tons;
}

/** A day's repair, at its first hour: each damaged cell's damage × (1 − REPAIR_DAILY). */
export function repairSystem(world: World): void {
  if (world.bombDamage.size === 0 || world.tick % 24 !== 0) return;
  for (const [c, d] of [...world.bombDamage]) {
    const left = d * (1 - REPAIR_DAILY);
    if (left < DAMAGE_FLOOR) world.bombDamage.delete(c);
    else world.bombDamage.set(c, left);
  }
}
