/**
 * The air forces of a scenario's start (PLAN 5.1d): `data/scenarios/<id>/air.json`'s groups → each
 * wing at an airbase of its nation's. A wing goes to the base its nation holds with the most room
 * left that holds its aircraft (ties: the lower base), in the file's order; one that no base of
 * its nation holds is unplaced (an error of the data).
 */
import { airbaseRoom, type Airbase } from './airbases';

export interface WingGroup {
  nation: string;
  template: string;
  count: number;
}

export interface PlacedWing {
  nation: number;
  template: string;
  /** The airbase's index in the list given. */
  base: number;
}

/** `aircraftOf(template)`: the aircraft a wing of that template has. */
export function placeWings(bases: readonly Airbase[], controller: Uint16Array, groups: readonly WingGroup[], tags: readonly string[], aircraftOf: (template: string) => number): { wings: PlacedWing[]; unplaced: number[] } {
  const idOf = new Map(tags.map((t, i) => [t, i + 1]));
  const left = bases.map((b) => airbaseRoom(b));
  const wings: PlacedWing[] = [];
  const unplaced: number[] = [];
  groups.forEach((g, gi) => {
    const nation = idOf.get(g.nation) ?? 0;
    const need = aircraftOf(g.template);
    for (let k = 0; k < g.count; k++) {
      let best = -1;
      bases.forEach((b, i) => {
        if (controller[b.cell] !== nation || left[i]! < need) return;
        if (best < 0 || left[i]! > left[best]!) best = i;
      });
      if (best < 0) {
        unplaced.push(gi);
        return;
      }
      left[best]! -= need;
      wings.push({ nation, template: g.template, base: best });
    }
  });
  return { wings, unplaced };
}
