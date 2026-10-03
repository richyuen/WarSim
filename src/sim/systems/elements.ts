/**
 * Elements: the authoritative unit proxies of land formations (SPEC §3.6, PLAN 1.13).
 *
 * A formation built from a scenario template gets one element per template unit (e.g. 18
 * infantry elements of 500 men, 3 artillery elements of 12 guns). Losses land on elements; the
 * formation's `strength` (men) is their sum, so the strategic number always equals what the
 * tactical view shows. Formations without elements (toy scenario, tests) keep a bare strength.
 */
import { EventKind } from '../../shared/events';
import type { World } from '../world';

/** Live element ids per formation, ascending (derived; rebuilt after creates/removes or a load). */
export function elementIndex(world: World): Map<number, number[]> {
  if (world.elementIndex) return world.elementIndex;
  const idx = new Map<number, number[]>();
  const e = world.elements;
  e.forEach((id) => {
    const f = e.cols.formation[id]!;
    let list = idx.get(f);
    if (!list) idx.set(f, (list = []));
    list.push(id);
  });
  world.elementIndex = idx;
  return idx;
}

/** Creates the elements of formation `fid` from its template; sets its strength. */
export function equipFormation(world: World, fid: number, template: number): void {
  const rule = world.rules?.templates[template];
  if (!rule) return;
  const e = world.elements;
  e.reserve(rule.elements.reduce((s, x) => s + x.count, 0));
  let slot = 0;
  for (const { unit, count } of rule.elements) {
    const size = world.rules!.units[unit]!.size;
    for (let k = 0; k < count; k++) {
      const id = e.create();
      e.cols.formation[id] = fid;
      e.cols.slot[id] = slot++;
      e.cols.unit[id] = unit;
      e.cols.strength[id] = size;
    }
  }
  world.elementIndex = null;
  recomputeStrength(world, fid);
}

/** Formation strength in men from its elements (no-op for element-less formations). */
export function recomputeStrength(world: World, fid: number): void {
  const list = elementIndex(world).get(fid);
  if (!list) return;
  const units = world.rules!.units;
  const ec = world.elements.cols;
  let men = 0;
  for (const id of list) men += ec.strength[id]! * units[ec.unit[id]!]!.menPerUnit;
  world.formations.cols.strength[fid] = Math.round(men);
}

/** Removes `units` (fractional) from an element, carrying the remainder; returns units lost. */
export function applyLoss(world: World, id: number, units: number): number {
  const ec = world.elements.cols;
  const w = ec.wound[id]! + units;
  const whole = Math.min(Math.floor(w), ec.strength[id]!);
  ec.strength[id] = ec.strength[id]! - whole;
  ec.wound[id] = ec.strength[id] === 0 ? 0 : w - Math.floor(w);
  return whole;
}

/**
 * Removes the share `fraction` of a formation's strength: from every element (with carried
 * fractions) when it has elements, else from its bare strength. Used by attrition and desertion,
 * so strength stays the sum of the elements.
 */
export function bleedFormation(world: World, fid: number, fraction: number): void {
  const els = elementIndex(world).get(fid);
  if (!els) {
    const c = world.formations.cols;
    const before = c.strength[fid]!;
    c.strength[fid] = Math.floor(before * (1 - fraction));
    const n = c.nation[fid]!;
    if (world.nations.has(n)) world.nations.cols.casualties[n] = world.nations.cols.casualties[n]! + (before - c.strength[fid]!);
    return;
  }
  for (const e of els) applyLoss(world, e, world.elements.cols.strength[e]! * fraction);
  settleFormation(world, fid);
}

/** Removes dead elements of `fid`, recomputes strength; destroys the formation if none remain. */
export function settleFormation(world: World, fid: number): void {
  const list = elementIndex(world).get(fid);
  if (!list) return;
  const fc = world.formations.cols;
  const nation = fc.nation[fid]!;
  const before = fc.strength[fid]!;
  settleElements(world, fid, list);
  // Men lost since the last settle count as casualties (PLAN 1.34b statistics).
  const after = world.formations.has(fid) ? fc.strength[fid]! : 0;
  if (before > after && world.nations.has(nation)) world.nations.cols.casualties[nation] = world.nations.cols.casualties[nation]! + (before - after);
}

function settleElements(world: World, fid: number, list: number[]): void {
  const e = world.elements;
  const live = list.filter((id) => {
    if (e.cols.strength[id]! > 0) return true;
    e.remove(id);
    return false;
  });
  if (live.length === list.length) {
    recomputeStrength(world, fid);
    return;
  }
  world.elementIndex!.set(fid, live);
  if (live.length > 0) {
    recomputeStrength(world, fid);
    return;
  }
  world.elementIndex!.delete(fid);
  destroyFormation(world, fid);
}

/** Removes a formation, its elements and derived caches; emits FormationDestroyed. */
export function destroyFormation(world: World, fid: number): void {
  const f = world.formations;
  if (!f.has(fid)) return;
  const list = elementIndex(world).get(fid) ?? [];
  for (const id of list) world.elements.remove(id);
  world.elementIndex!.delete(fid);
  world.out.emit(world.tick, EventKind.FormationDestroyed, fid, f.cols.nation[fid]!, f.cols.x[fid]!, f.cols.y[fid]!);
  f.remove(fid);
  world.paths.delete(fid);
}
