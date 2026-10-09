import type { World } from '../../src/sim/world';

/**
 * Formations that bear the mark of a march home and wait before an enemy's cell (PLAN 3.12Rk,
 * ADR-222): asked once an hour, it counts for each formation the hours in a row that it bore
 * `formations.home`, was not in contact, stood where it stood the hour before, and had a cell of
 * a nation its own is at war with as the next of its path. `longest` is the most hours any had,
 * `marked` the formation-hours with the mark. Before, the mark kept the AI off such a formation
 * for as long as the war lasted: 7,656 hours in three years of seed 77.
 */
export function homeWait(): { hour: (w: World) => void; longest: number; marked: number; where: string } {
  const waits = new Map<number, { hours: number; x: number; y: number }>();
  const out = {
    longest: 0,
    marked: 0,
    where: '',
    hour(w: World): void {
      const f = w.formations;
      const c = f.cols;
      for (const id of waits.keys()) if (!f.has(id) || c.home[id] === 0) waits.delete(id);
      f.forEach((id) => {
        if (c.home[id] === 0) return;
        out.marked++;
        const path = w.paths.get(id);
        const next = path?.[c.pathStep[id]! + 1];
        const was = waits.get(id);
        const still = was !== undefined && was.x === c.x[id] && was.y === c.y[id];
        const before = next !== undefined && c.engaged[id] !== 1 && w.wars.atWar(c.nation[id]!, w.cells.controller[next]!);
        const hours = before && still ? was.hours + 1 : 0;
        waits.set(id, { hours, x: c.x[id]!, y: c.y[id]! });
        if (hours > out.longest) {
          out.longest = hours;
          out.where = `formation ${id} of nation ${c.nation[id]!} at (${c.x[id]!.toFixed(1)}, ${c.y[id]!.toFixed(1)}), tick ${w.tick}, mark ${c.home[id]!}`;
        }
      });
    },
  };
  return out;
}
