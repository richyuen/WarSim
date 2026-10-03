/**
 * Scenario editing (SPEC §9, PLAN 1.36): cities (place, remove, make capital), cores and claims
 * (a claim of a dead nation is a preset revolt: revolts there bring that nation back), gold, and
 * annexation (`annexNation` in systems/puppets). All are commands, so they replay and save.
 *
 * Economy of placed cities: scenario cities are part of the economy's calibration (PLAN 1.9);
 * a placed city adds CITY_ECON_PER_SIZE × size × the world's mean land-cell economy to its cell,
 * stored on the city row and taken back when it is removed. Removing a scenario city leaves the
 * calibrated economy as it is.
 */
import { EventKind } from '../shared/events';
import { isLand } from '../shared/terrain';
import { relocateCapital } from './systems/capitals';
import type { World } from './world';

export const CITY_ECON_PER_SIZE = 20;
/** City rows placed in the editor have no scenario definition. */
export const NO_DEF = 0xffffffff;
export const MAX_CITY_NAME = 40;

/** Places a city of `size` (1..5) named `name` on the land cell at (x, y); returns its row or 0. */
export function spawnCity(world: World, x: number, y: number, name: string, size: number): number {
  const { w, h, terrain, econ, owner } = world.cells;
  const cx = ((Math.floor(x) % w) + w) % w;
  const cy = Math.floor(y);
  if (cy < 0 || cy >= h) return 0;
  const cell = cy * w + cx;
  const label = name.trim().slice(0, MAX_CITY_NAME);
  if (!isLand(terrain[cell]!) || label === '') return 0;
  let busy = false;
  world.cities.forEach((id) => {
    if (world.cities.cols.cell[id] === cell) busy = true;
  });
  if (busy) return 0;
  let sum = 0;
  let n = 0;
  for (let c = 0; c < econ.length; c++) {
    if (econ[c]! > 0) {
      sum += econ[c]!;
      n++;
    }
  }
  const s = Math.max(1, Math.min(5, Math.round(size)));
  const bonus = n > 0 ? (CITY_ECON_PER_SIZE * s * sum) / n : 0;
  const cc = world.cities.cols;
  const id = world.cities.create();
  cc.def[id] = NO_DEF;
  cc.x[id] = cx + 0.5;
  cc.y[id] = cy + 0.5;
  cc.cell[id] = cell;
  cc.size[id] = s;
  cc.capitalOf[id] = 0;
  // The layer holds whole $M (u32): store what was actually added, so removal is exact.
  const before = econ[cell]!;
  econ[cell] = Math.min(0xffffffff, before + Math.round(bonus));
  cc.econ[id] = econ[cell]! - before;
  world.cityNames.set(id, label);
  world.supplyDirty = true;
  world.citiesVersion++;
  world.out.emit(world.tick, EventKind.CitySpawned, id, owner[cell]!, cc.x[id]!, cc.y[id]!);
  return id;
}

/** Removes city row `id`; a capital moves to the nation's next city (or the field). */
export function removeCity(world: World, id: number): boolean {
  if (!world.cities.has(id)) return false;
  const cc = world.cities.cols;
  const capitalOf = cc.capitalOf[id]!;
  const econ = world.cells.econ;
  econ[cc.cell[id]!] = Math.max(0, econ[cc.cell[id]!]! - cc.econ[id]!);
  world.cityNames.delete(id);
  world.cities.remove(id);
  if (capitalOf !== 0 && world.nations.has(capitalOf) && world.nations.cols.living[capitalOf] === 1) relocateCapital(world, capitalOf);
  world.supplyDirty = true;
  world.citiesVersion++;
  return true;
}

/** Makes city `id` the capital of `nation`, which must own and control it. */
export function setCapital(world: World, nation: number, id: number): boolean {
  if (!world.cities.has(id) || !world.nations.has(nation) || world.nations.cols.living[nation] !== 1) return false;
  const cc = world.cities.cols;
  const cell = cc.cell[id]!;
  if (world.cells.owner[cell] !== nation || world.cells.controller[cell] !== nation) return false;
  if (cc.capitalOf[id] !== 0 && cc.capitalOf[id] !== nation) return false; // another nation's capital
  world.cities.forEach((c) => {
    if (cc.capitalOf[c] === nation) cc.capitalOf[c] = 0;
  });
  cc.capitalOf[id] = nation;
  world.nations.cols.capitalX[nation] = cc.x[id]!;
  world.nations.cols.capitalY[nation] = cc.y[id]!;
  world.supplyDirty = true;
  world.citiesVersion++;
  world.out.emit(world.tick, EventKind.CapitalMoved, nation, id, cc.x[id]!, cc.y[id]!);
  return true;
}

/**
 * Gives (`on`) or takes away (core and claim) a core of `nation` on province `p`: on, it becomes
 * the province's core when it has none, else an extra claim. A dead nation's claim is a preset
 * revolt.
 */
export function setCore(world: World, p: number, nation: number, on: boolean): boolean {
  const pv = world.provinces;
  if (p <= 0 || p >= pv.count || !world.nations.has(nation)) return false;
  if (on) {
    if (pv.core[p] === 0) pv.core[p] = nation;
    else pv.addClaim(p, nation);
  } else {
    if (pv.core[p] === nation) pv.core[p] = 0;
    pv.removeClaim(p, nation);
  }
  return true;
}
