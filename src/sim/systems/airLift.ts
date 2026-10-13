/**
 * Air supply (PLAN 5.8u1, SPEC §6.3): a transport wing's sortie on a `supply` mission, at its
 * target in the hour it arrives, lifts `AIR_LIFT` of a formation's supply an aircraft to the
 * formations of its side on the land within `AA_CELLS` of the target that are short of it, the
 * same share each (no more than each lacks), by ascending id. A formation cut off is fed so
 * between the hours its network cannot.
 */
import type { World } from '../world';
import { AA_CELLS } from './airCombat';
import { elementIndex, wrapDx } from './elements';
import { legHours } from './sorties';

/** A formation's supply an aircraft of a transport wing lifts (a group of 24: a half). */
export const AIR_LIFT = 1 / 48;

export function airLift(world: World): void {
  if (world.sorties.size === 0) return;
  const fc = world.formations.cols;
  const ec = world.elements.cols;
  const h = world.cells.h;
  for (const [id, s] of [...world.sorties].sort((a, b) => a[0] - b[0])) {
    const m = world.wingMission.get(id);
    if (!m || m.kind !== 'supply' || s.tx !== m.x || s.ty !== m.y || !world.formations.has(id)) continue;
    const arrive = s.launch + legHours(s);
    if (!(arrive > world.tick - 1 && arrive <= world.tick)) continue;
    const nation = fc.nation[id]!;
    const tx = Math.floor(s.tx);
    const ty = Math.floor(s.ty);
    const short: number[] = [];
    world.formations.forEach((g) => {
      if (world.offLand(g) || fc.supply[g]! >= 1) return;
      if (fc.nation[g] !== nation && !world.wars.sameSide(nation, fc.nation[g]!)) return;
      if (Math.abs(wrapDx(world, tx, Math.floor(fc.x[g]!))) > AA_CELLS || Math.abs(Math.min(h - 1, Math.floor(fc.y[g]!)) - ty) > AA_CELLS) return;
      short.push(g);
    });
    if (short.length === 0) continue;
    let aircraft = 0;
    for (const e of elementIndex(world).get(id) ?? []) aircraft += ec.strength[e]!;
    const each = (aircraft * AIR_LIFT) / short.length;
    for (const g of short.sort((a, b) => a - b)) fc.supply[g] = Math.min(1, fc.supply[g]! + each);
  }
}
