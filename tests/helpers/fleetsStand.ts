import { elementIndex } from '../../src/sim/systems/elements';
import { atLostBase } from '../../src/sim/systems/navalCombat';
import { seaRangeOf, type World } from '../../src/sim/world';

/**
 * The fleets of a world as they stand when this is called, and what has become of them since
 * (PLAN 4.2b AT): asked once a day, `day` gives a line for each fleet that is no longer at its
 * place with its ships, its crews and its supply, that has a ship with damage, that is in
 * contact or on the march, or that is gone while the nation it was of the day before lives. A
 * fleet whose nation died is gone with it (`eliminateNation`) and is counted in `gone`; one
 * whose nation was made part of its overlord is the overlord's and stands. `start` is how many
 * there were.
 *
 * Since PLAN 4.4e a fleet at a base its nation has lost sails for another (`rebaseFleets`, at a
 * day's start, an hour after this is asked): one found under way or moved (its way can end in
 * the day) that was at a lost base (`atLostBase`) when it was last asked, or under way from
 * one now, is counted in `sailed` and no longer held to stand. One found in a sea battle, broken off from one, or that was in one in an hour since
 * (`hour`, to be asked every hour before the hour's fires are cleared: a battle can begin and
 * end in one hour; PLAN 4.3: a fleet that sailed met it), is counted in `fought`
 * and no longer held to stand. Any other change is still a line.
 */
export function fleetsStand(world: World): { start: number; gone: number; sailed: number; fought: number; hour: (w: World) => void; day: (w: World) => string[] } {
  const f = world.formations;
  const idx = elementIndex(world);
  const fleets = new Map<number, { generation: number; x: number; y: number; ships: number; strength: number; nation: number }>();
  f.forEach((id) => {
    if (world.afloat(id)) fleets.set(id, { generation: f.generation[id]!, x: f.cols.x[id]!, y: f.cols.y[id]!, ships: idx.get(id)?.length ?? 0, strength: f.cols.strength[id]!, nation: f.cols.nation[id]! });
  });
  /** The fleets at a lost base when last asked. */
  let lostBefore = new Set<number>();
  /** The fleets that were in a sea battle in an hour since last asked (`hour`, asked every hour). */
  const inBattle = new Set<number>();
  const out = {
    start: fleets.size,
    gone: 0,
    sailed: 0,
    fought: 0,
    hour(w: World): void {
      for (const b of w.seaBattles) for (const id of b.fleets) inBattle.add(id);
      // A battle can begin and end in one hour: its volleys name the ships (shooter, target).
      const fr = w.out.fires;
      for (let i = 0; i < fr.length; i += 10) {
        for (const el of [fr[i + 2]!, fr[i + 3]!]) if (w.elements.has(el) && w.afloat(w.elements.cols.formation[el]!)) inBattle.add(w.elements.cols.formation[el]!);
      }
    },
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
        const touched = wound !== 0 || !w.afloat(id) || c.x[id] !== was.x || c.y[id] !== was.y || ships !== was.ships || c.strength[id] !== was.strength || c.supply[id] !== 1 || c.org[id] !== 1 || c.engaged[id] === 1 || c.moving[id] === 1 || c.retreat[id] !== 0;
        // Sent from a lost base (PLAN 4.4e): free from here on.
        const moved = c.x[id] !== was.x || c.y[id] !== was.y;
        if (touched && wound === 0 && ships === was.ships && w.afloat(id) && ((c.moving[id] === 1 && atLostBase(w, id)) || ((c.moving[id] === 1 || moved) && lostBefore.has(id)))) {
          fleets.delete(id);
          out.sailed++;
          continue;
        }
        // In a sea battle, or broken off from one: the sea's rules (PLAN 4.3).
        if (touched && w.afloat(id) && (inBattle.has(id) || seaRangeOf(w, id) !== undefined || c.retreat[id]! > 0)) {
          fleets.delete(id);
          out.fought++;
          continue;
        }
        if (wound !== 0) lines.push(`fleet ${id} of nation ${was.nation}: its ships carry ${wound} of damage`);
        if (touched) {
          lines.push(`fleet ${id} of nation ${was.nation}: at (${c.x[id]!}, ${c.y[id]!}) for (${was.x}, ${was.y}), ${ships} ships for ${was.ships}, strength ${c.strength[id]!} for ${was.strength}, supply ${c.supply[id]!}, org ${c.org[id]!}, engaged ${c.engaged[id]!}, moving ${c.moving[id]!}, retreat ${c.retreat[id]!}`);
        }
      }
      inBattle.clear();
      lostBefore = new Set([...fleets.keys()].filter((id) => w.formations.has(id) && w.afloat(id) && atLostBase(w, id)));
      return lines;
    },
  };
  return out;
}
