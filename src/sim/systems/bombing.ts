/**
 * Strategic bombing (PLAN 5.5a, SPEC §6.3): a strike on the enemy's land drops its aircraft's
 * bombs (`bombT`, tons each) on the industry within reach of its target. The cells there that
 * a nation at war with the bomber's controls, with any industry (`cells.econ`), share the
 * bombs by their industry: each loses the same share of what it produces, tons × `BOMB_DAMAGE`
 * over their industry together, up to `MAX_DAMAGE`. The damage is state (`world.bombDamage`, by
 * cell, saved while not empty); the monthly income takes it off a cell's output; it is repaired
 * day by day, `REPAIR_DAILY` of it.
 *
 * Ports (PLAN 5.5b): the ports within reach that a nation at war with the bomber holds are
 * damaged by the tons over `PORT_TONS` a level of the port, up to `MAX_DAMAGE`, and repaired as
 * industry is (`world.portDamage`, by port, saved). A port damaged by `PORT_SHUT` or more is shut
 * (`portShut`): its transports embark no one, its yard delivers no fleet.
 */
import type { World } from '../world';
import type { Port } from '../data/ports';
import { cellX, elementIndex, wrapDx } from './elements';
import { strikeFactor } from './airSuperiority';

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
/** Tons of bombs that put a port of level 1 wholly out of work (a level 3 port takes three times as many). */
export const PORT_TONS = 60;
/** A port damaged by this or more is shut. */
export const PORT_SHUT = 0.5;

/** Whether port `i` (index in `world.ports`) is shut by bombs (PLAN 5.5b). */
export function portShut(world: World, i: number): boolean {
  return (world.portDamage.get(i) ?? 0) >= PORT_SHUT;
}

/**
 * The bombs of wing `wing` on the industry about (tx, ty): its aircraft's tons, shared as the
 * header says. Returns the tons that fell on industry (0 where there is none of an enemy's).
 */
export function bombIndustry(world: World, wing: number, tx: number, ty: number): number {
  const bombCells = world.atSizeWhole(BOMB_CELLS);
  const rules = world.rules!;
  const ec = world.elements.cols;
  let tons = 0;
  for (const e of elementIndex(world).get(wing) ?? []) tons += ec.strength[e]! * rules.units[ec.unit[e]!]!.bombT;
  if (tons === 0) return 0;
  // Under its side's air more fall where they are aimed, under the enemy's fewer (PLAN 5.8t3).
  tons *= strikeFactor(world, wing, tx, ty);
  const { w, h, controller, econ } = world.cells;
  const nation = world.formations.cols.nation[wing]!;
  bombPorts(world, nation, tons, tx, ty);
  const cells: number[] = [];
  let total = 0;
  const cx = Math.floor(tx);
  const cy = Math.floor(ty);
  for (let dy = -bombCells; dy <= bombCells; dy++) {
    const y = cy + dy;
    if (y < 0 || y >= h) continue;
    for (let dx = -bombCells; dx <= bombCells; dx++) {
      const x = cellX(world, cx + dx);
      if (x === null) continue;
      const c = y * w + x;
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

/** The ports within `BOMB_CELLS` of (tx, ty) held by nations at war with `nation`: each damaged by `tons` ÷ (PORT_TONS × its level). */
function bombPorts(world: World, nation: number, tons: number, tx: number, ty: number): void {
  const bombCells = world.atSizeWhole(BOMB_CELLS);
  const { w, controller } = world.cells;
  const cx = Math.floor(tx);
  const cy = Math.floor(ty);
  // The ports of the cells within reach, from the ports by cell (PLAN 7.1f); then the test of
  // each, in the order of `world.ports`, as a walk of them all would make it.
  const byCell = portsByCell(world.ports);
  const near: number[] = [];
  for (let y = cy - bombCells; y <= cy + bombCells; y++) {
    if (y < 0 || y >= world.cells.h) continue;
    for (let d = -bombCells; d <= bombCells; d++) {
      const x = cellX(world, cx + d);
      if (x === null) continue;
      for (const i of byCell.get(y * w + x) ?? []) if (!near.includes(i)) near.push(i);
    }
  }
  near.sort((a, b) => a - b);
  for (const i of near) {
    const p = world.ports[i]!;
    const dx = Math.abs(wrapDx(world, cx, p.cell % w));
    if (dx > bombCells || Math.abs(Math.floor(p.cell / w) - cy) > bombCells) continue;
    if (!world.wars.atWar(nation, controller[p.cell]!)) continue;
    world.portDamage.set(i, Math.min(MAX_DAMAGE, (world.portDamage.get(i) ?? 0) + tons / (PORT_TONS * Math.max(1, p.port))));
  }
}

/** The indices in `ports` by cell (PLAN 7.1f): the ports are the scenario's static data, so once a list. */
const portCells = new WeakMap<readonly Port[], Map<number, number[]>>();

function portsByCell(ports: readonly Port[]): Map<number, number[]> {
  let m = portCells.get(ports);
  if (!m) {
    m = new Map();
    ports.forEach((p, i) => {
      const list = m!.get(p.cell);
      if (list) list.push(i);
      else m!.set(p.cell, [i]);
    });
    portCells.set(ports, m);
  }
  return m;
}

/** A day's repair, at its first hour: each damaged cell's and port's damage × (1 − REPAIR_DAILY). */
export function repairSystem(world: World): void {
  if (world.tick % 24 !== 0) return;
  for (const damage of [world.bombDamage, world.portDamage]) {
    for (const [k, d] of [...damage]) {
      const left = d * (1 - REPAIR_DAILY);
      if (left < DAMAGE_FLOOR) damage.delete(k);
      else damage.set(k, left);
    }
  }
}
