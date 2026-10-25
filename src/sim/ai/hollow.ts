/**
 * Hollow divisions (PLAN 7.116a, ADR-701): daily at 00:00, before the economic AI's month, every
 * land formation of a living AI nation with fewer than HOLLOW_MEN men (and fewer than its
 * template's) that is out of contact (not engaged, not retreating) and on land is folded into
 * another: its men go to the nearest land formation of its nation on the same landmass within
 * MERGE_KM that is below its template's strength (`refillFormation`: by its slots, as a refill;
 * the men become the receiver's units), and it is removed; the men the receiver has no room for,
 * and all its men when there is no such receiver, go back to the pool as a disbanded formation's
 * (DISBAND_MANPOWER). In the order of the ids; a receiver may be engaged (the men walk to the
 * line), and a formation that took men in and is still hollow is folded in its turn.
 *
 * Before (critic run 14, R14-B1): a remnant on occupied land is never refilled (`refillable`
 * wants its nation's cell), and 63.5 → 76.3 of them a world stood at year 20, 19–367 men each,
 * crowding the late fronts' labels; 0–2 of ~100 a world were in contact.
 *
 * A nation without AI keeps its remnants: which of its formations to merge is the player's.
 */
import { isDayStart } from '../../shared/calendar';
import { kmPerCell } from '../data/projection';
import { cellX, destroyFormation, elementIndex, wrapDx } from '../systems/elements';
import { refillFormation } from '../systems/production';
import { Domain, navOf, type World } from '../world';

/** A land formation with fewer men than this is hollow. */
export const HOLLOW_MEN = 500;
/** The furthest a hollow formation's men walk to the formation they join, km on the map. */
export const MERGE_KM = 50;
/** The cell a formation stands on, or -1. */
function cellOf(world: World, id: number): number {
  const fc = world.formations.cols;
  const cx = cellX(world, Math.floor(fc.x[id]!));
  const cy = Math.floor(fc.y[id]!);
  if (cx === null || cy < 0 || cy >= world.cells.h) return -1;
  return cy * world.cells.w + cx;
}

/**
 * Folds the day's hollow formations (module comment); `backToPool` is the share of the men no
 * receiver takes that go back to the pool (the economic AI's DISBAND_MANPOWER). Returns how many
 * were folded.
 */
export function foldHollow(world: World, backToPool: number): number {
  const rules = world.rules;
  if (!rules || !world.settings.aiEnabled || !isDayStart(world.tick)) return 0;
  const fc = world.formations.cols;
  const nc = world.nations.cols;
  // The land formations of living AI nations on land, by nation, in the order of their ids.
  const byNation = new Map<number, number[]>();
  let any = false;
  const index = elementIndex(world);
  world.formations.forEach((id) => {
    const n = fc.nation[id]!;
    if (nc.living[n] !== 1 || nc.aiOff[n] === 1 || world.isFleet(id) || world.isWing(id) || world.offLand(id)) return;
    const rule = rules.templates[fc.template[id]!];
    if (!rule || rule.domain !== Domain.land || rule.manpower <= 0 || !index.has(id)) return;
    const l = byNation.get(n) ?? [];
    l.push(id);
    byNation.set(n, l);
    if (fc.strength[id]! < Math.min(HOLLOW_MEN, rule.manpower)) any = true;
  });
  if (!any) return 0;
  const comp = navOf(world).grid.component;
  // MERGE_KM in cells, squared (no root: the comparison is exact on every engine).
  const reach = MERGE_KM / kmPerCell(world.cells.w);
  const reach2 = reach * reach;
  let folded = 0;
  for (const [n, list] of byNation) {
    for (const id of list) {
      if (!world.formations.has(id)) continue;
      const men = fc.strength[id]!;
      const rule = rules.templates[fc.template[id]!]!;
      if (men >= Math.min(HOLLOW_MEN, rule.manpower) || fc.engaged[id] === 1 || fc.retreat[id] !== 0) continue;
      const cell = cellOf(world, id);
      const land = cell >= 0 ? comp[cell]! : 0;
      let best = -1;
      let bestD = Infinity;
      if (land !== 0) {
        for (const o of list) {
          if (o === id || !world.formations.has(o)) continue;
          if (fc.strength[o]! >= rules.templates[fc.template[o]!]!.manpower) continue;
          const oc = cellOf(world, o);
          if (oc < 0 || comp[oc] !== land) continue;
          const dx = wrapDx(world, fc.x[id]!, fc.x[o]!);
          const dy = fc.y[o]! - fc.y[id]!;
          const d = dx * dx + dy * dy;
          if (d <= reach2 && d < bestD) {
            bestD = d;
            best = o;
          }
        }
      }
      const took = best >= 0 ? refillFormation(world, best, men) : 0;
      nc.manpower[n] = nc.manpower[n]! + backToPool * (men - took);
      destroyFormation(world, id);
      folded++;
    }
  }
  return folded;
}
