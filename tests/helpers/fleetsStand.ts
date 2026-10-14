import { EventKind } from '../../src/shared/events';
import { elementIndex } from '../../src/sim/systems/elements';
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
 * A fleet found under way or moved (its way can end in the day) with its ships whole is counted
 * in `sailed` and no longer held to stand: since PLAN 4.4e a fleet at a base its nation lost
 * sails for another (`rebaseFleets`), and since PLAN 4.6c the naval AI sails fleets to sea and
 * home (before 4.6c only a fleet at a lost base was let sail). One found in a sea battle, broken off from one, or that was in one in an hour since
 * (`hour`, to be asked every hour before the hour's fires are cleared: a battle can begin and
 * end in one hour; PLAN 4.3: a fleet that sailed met it), or sunk in one, is counted in `fought`
 * and no longer held to stand. Since PLAN 4.5a a transport group carries a land formation that
 * a player or the AI ordered to another land (`World.embarked`, read by `hour`): from the hour
 * it carries one it is counted in `carried` and no longer held to stand. Any other change is
 * still a line. Since PLAN 4.6e1 a nation short of money lays up fleets (`FleetsLaidUp`, read by
 * `hour`): as many of its fleets as it laid up may be gone, counted in `laid`. Since PLAN 5.4c a
 * strike from the air hits a fleet with no sea battle (PLAN 5.8w5): one within a cell of an
 * `AirStrike`, or that lost a ship (`ElementDestroyed`), in an hour is counted in `fought` too.
 */
export function fleetsStand(world: World): { start: number; gone: number; sailed: number; fought: number; carried: number; laid: number; hour: (w: World) => void; day: (w: World) => string[] } {
  const f = world.formations;
  const idx = elementIndex(world);
  const fleets = new Map<number, { generation: number; x: number; y: number; ships: number; strength: number; nation: number }>();
  f.forEach((id) => {
    if (world.isFleet(id)) fleets.set(id, { generation: f.generation[id]!, x: f.cols.x[id]!, y: f.cols.y[id]!, ships: idx.get(id)?.length ?? 0, strength: f.cols.strength[id]!, nation: f.cols.nation[id]! });
  });
  /** The ships of the fleets at the start, by element: a ship sunk in its fleet's first hour of battle is gone from the table when `hour` reads the hour's fires. */
  const shipOf = new Map<number, number>();
  for (const id of fleets.keys()) for (const e of idx.get(id) ?? []) shipOf.set(e, id);
  /** The fleets that were in a sea battle in an hour since last asked (`hour`, asked every hour). */
  const inBattle = new Set<number>();
  /** Per nation: the fleets it laid up since last asked (PLAN 4.6e1, `FleetsLaidUp`, read by `hour`). */
  const laidUp = new Map<number, number>();
  /** The fleets that have carried a land formation (PLAN 4.5a). */
  const carrying = new Set<number>();
  const out = {
    start: fleets.size,
    gone: 0,
    sailed: 0,
    fought: 0,
    carried: 0,
    laid: 0,
    hour(w: World): void {
      const ev = w.out.events;
      for (let i = 0; i < ev.length; i += 6) {
        if (ev[i + 1] === EventKind.FleetsLaidUp) laidUp.set(ev[i + 2]!, (laidUp.get(ev[i + 2]!) ?? 0) + ev[i + 3]!);
        // Struck from the air (PLAN 5.4c, 5.8w5): the fleets about the strike's place, and one whose ship was lost.
        if (ev[i + 1] === EventKind.ElementDestroyed && shipOf.has(ev[i + 2]!)) inBattle.add(shipOf.get(ev[i + 2]!)!);
        if (ev[i + 1] === EventKind.AirStrike) {
          for (const id of fleets.keys()) {
            if (!w.formations.has(id)) continue;
            const dx = Math.abs(w.formations.cols.x[id]! - ev[i + 4]!);
            if (Math.min(dx, w.cells.w - dx) <= 1.5 && Math.abs(w.formations.cols.y[id]! - ev[i + 5]!) <= 1.5) inBattle.add(id);
          }
        }
      }
      for (const e of w.embarked.values()) carrying.add(e.fleet);
      for (const b of w.seaBattles) for (const id of b.fleets) inBattle.add(id);
      // A battle can begin and end in one hour: its volleys name the ships (shooter, target).
      const fr = w.out.fires;
      for (let i = 0; i < fr.length; i += 10) {
        for (const el of [fr[i + 2]!, fr[i + 3]!]) {
          if (w.elements.has(el) && w.isFleet(w.elements.cols.formation[el]!)) inBattle.add(w.elements.cols.formation[el]!);
          // A ship sunk in the hour (PLAN 4.6c: a fleet at its base is met there by the enemy's).
          else if (!w.elements.has(el) && shipOf.has(el)) inBattle.add(shipOf.get(el)!);
        }
      }
    },
    day(w: World): string[] {
      const c = w.formations.cols;
      const index = elementIndex(w);
      const lines: string[] = [];
      for (const [id, was] of fleets) {
        if (!w.formations.has(id) || w.formations.generation[id] !== was.generation) {
          fleets.delete(id);
          // Sunk in a sea battle it was in: the sea's rules (PLAN 4.3).
          if (inBattle.has(id)) {
            out.fought++;
            continue;
          }
          // Laid up by its nation short of money (PLAN 4.6e1).
          if ((laidUp.get(was.nation) ?? 0) > 0) {
            laidUp.set(was.nation, laidUp.get(was.nation)! - 1);
            out.laid++;
            continue;
          }
          out.gone++;
          if (w.nations.cols.living[was.nation] === 1) lines.push(`fleet ${id} of nation ${was.nation} is gone and its nation lives`);
          continue;
        }
        was.nation = c.nation[id]!;
        const els = index.get(id) ?? [];
        const ships = els.length;
        // Damage carried towards a ship's loss (a desertion of a twentieth sinks none for 20 months).
        const wound = els.reduce((s, e) => s + w.elements.cols.wound[e]!, 0);
        const touched = wound !== 0 || !w.isFleet(id) || c.x[id] !== was.x || c.y[id] !== was.y || ships !== was.ships || c.strength[id] !== was.strength || c.supply[id] !== 1 || c.org[id] !== 1 || c.engaged[id] === 1 || c.moving[id] === 1 || c.retreat[id] !== 0;
        // Sent (from a lost base, PLAN 4.4e; by the naval AI, PLAN 4.6c): free from here on.
        const moved = c.x[id] !== was.x || c.y[id] !== was.y;
        if (touched && wound === 0 && ships === was.ships && w.isFleet(id) && (c.moving[id] === 1 || moved)) {
          fleets.delete(id);
          out.sailed++;
          continue;
        }
        // In a sea battle, or broken off from one: the sea's rules (PLAN 4.3).
        if (touched && w.isFleet(id) && (inBattle.has(id) || seaRangeOf(w, id) !== undefined || c.retreat[id]! > 0)) {
          fleets.delete(id);
          out.fought++;
          continue;
        }
        // Carrying, or having carried, troops (PLAN 4.5a): the orders of the land.
        if (touched && w.isFleet(id) && carrying.has(id)) {
          fleets.delete(id);
          out.carried++;
          continue;
        }
        if (wound !== 0) lines.push(`fleet ${id} of nation ${was.nation}: its ships carry ${wound} of damage`);
        if (touched) {
          lines.push(`fleet ${id} of nation ${was.nation}: at (${c.x[id]!}, ${c.y[id]!}) for (${was.x}, ${was.y}), ${ships} ships for ${was.ships}, strength ${c.strength[id]!} for ${was.strength}, supply ${c.supply[id]!}, org ${c.org[id]!}, engaged ${c.engaged[id]!}, moving ${c.moving[id]!}, retreat ${c.retreat[id]!}`);
        }
      }
      inBattle.clear();
      return lines;
    },
  };
  return out;
}
