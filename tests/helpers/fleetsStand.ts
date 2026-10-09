import { elementIndex } from '../../src/sim/systems/elements';
import type { World } from '../../src/sim/world';

/**
 * The fleets of a world as they stand when this is called, and what has become of them since
 * (PLAN 4.2b AT): asked once a day, `day` gives a line for each fleet that is no longer at its
 * place with its ships, its crews and its supply, that has a ship with damage, that is in
 * contact or on the march, or that is gone while the nation it was of the day before lives. A
 * fleet whose nation died is gone with it (`eliminateNation`) and is counted in `gone`; one
 * whose nation was made part of its overlord is the overlord's and stands. `start` is how many
 * there were.
 */
export function fleetsStand(world: World): { start: number; gone: number; day: (w: World) => string[] } {
  const f = world.formations;
  const idx = elementIndex(world);
  const fleets = new Map<number, { generation: number; x: number; y: number; ships: number; strength: number; nation: number }>();
  f.forEach((id) => {
    if (world.afloat(id)) fleets.set(id, { generation: f.generation[id]!, x: f.cols.x[id]!, y: f.cols.y[id]!, ships: idx.get(id)?.length ?? 0, strength: f.cols.strength[id]!, nation: f.cols.nation[id]! });
  });
  const out = {
    start: fleets.size,
    gone: 0,
    day(w: World): string[] {
      const c = w.formations.cols;
      const index = elementIndex(w);
      const lines: string[] = [];
      for (const [id, was] of fleets) {
        if (!w.formations.has(id) || w.formations.generation[id] !== was.generation) {
          fleets.delete(id);
          out.gone++;
          if (w.nations.cols.living[was.nation] === 1) lines.push(`fleet ${id} of nation ${was.nation} is gone and its nation lives`);
          continue;
        }
        was.nation = c.nation[id]!;
        const els = index.get(id) ?? [];
        const ships = els.length;
        // Damage carried towards a ship's loss (a desertion of a twentieth sinks none for 20 months).
        const wound = els.reduce((s, e) => s + w.elements.cols.wound[e]!, 0);
        if (wound !== 0) lines.push(`fleet ${id} of nation ${was.nation}: its ships carry ${wound} of damage`);
        if (!w.afloat(id) || c.x[id] !== was.x || c.y[id] !== was.y || ships !== was.ships || c.strength[id] !== was.strength || c.supply[id] !== 1 || c.org[id] !== 1 || c.engaged[id] === 1 || c.moving[id] === 1 || c.retreat[id] !== 0) {
          lines.push(`fleet ${id} of nation ${was.nation}: at (${c.x[id]!}, ${c.y[id]!}) for (${was.x}, ${was.y}), ${ships} ships for ${was.ships}, strength ${c.strength[id]!} for ${was.strength}, supply ${c.supply[id]!}, org ${c.org[id]!}, engaged ${c.engaged[id]!}, moving ${c.moving[id]!}, retreat ${c.retreat[id]!}`);
        }
      }
      return lines;
    },
  };
  return out;
}
