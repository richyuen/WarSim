/**
 * Land tallies for war scores (SPEC §3.5): km² owned, km² owned but held by another nation, and
 * km² by (owner, occupier) pair. Derived, never saved. Built by one scan of the map, then kept
 * by `World.setOwner` / `World.setController`, through which every change of a cell after the
 * scenario build passes (PLAN 1.42f: a daily scan of the 2 M cells was 6% of the tick). A load
 * drops it. The values are those of the scan; `tests/unit/landCounts.test.ts` compares the two.
 *
 * Land is area, not cells (ADR-57, PLAN 1.42e): on the Miller map a cell near the poles covers
 * far less ground than one at the equator. A cell counts the true area of its row rounded to a
 * whole km² (`cellKm2ByRow`), so every tally is an integer and exact in whatever order the cells
 * change: the tallies the setters keep equal the scan a load makes, bit for bit. (Sums of the
 * unrounded areas would differ in their last bits, and a loaded game could decide a peace
 * differently from the game that saved it.)
 */
import { cellAreaByRow } from './nav/grid';

/** Whole km² of one cell, by row: the unit of every land rule of the sim (ADR-57). */
export function cellKm2ByRow(w: number, h: number): Uint32Array {
  return Uint32Array.from(cellAreaByRow(w, h), (a) => Math.round(a));
}

export class LandCounts {
  /** km² owned, by nation id (ids are 16-bit). */
  readonly owned = new Uint32Array(65536);
  /** km² owned but controlled by another nation, by owner. */
  readonly lost = new Uint32Array(65536);
  /** key owner·65536 + controller → km² (no zero entries). */
  readonly occupied = new Map<number, number>();

  /** `rowKm2`: whole km² of one cell, by row (`cellKm2ByRow`). */
  private constructor(readonly rowKm2: Uint32Array) {}

  static scan(owner: ArrayLike<number>, controller: ArrayLike<number>, w: number, h: number): LandCounts {
    const l = new LandCounts(cellKm2ByRow(w, h));
    // Occupied cells come in runs of one (owner, occupier) pair: sum the run, then add it once.
    let runKey = -1;
    let run = 0;
    for (let y = 0, c = 0; y < h; y++) {
      const a = l.rowKm2[y]!;
      for (let x = 0; x < w; x++, c++) {
        const o = owner[c]!;
        if (o === 0) continue;
        l.owned[o]! += a;
        const k = controller[c]!;
        if (k !== o && k !== 0) {
          l.lost[o]! += a;
          const key = o * 65536 + k;
          if (key !== runKey) {
            if (run > 0) l.occupied.set(runKey, (l.occupied.get(runKey) ?? 0) + run);
            runKey = key;
            run = 0;
          }
          run += a;
        }
      }
    }
    if (run > 0) l.occupied.set(runKey, (l.occupied.get(runKey) ?? 0) + run);
    return l;
  }

  /** A copy that later changes of the map do not touch (the war pass reads one per day). */
  snapshot(): LandCounts {
    const l = new LandCounts(this.rowKm2);
    l.owned.set(this.owned);
    l.lost.set(this.lost);
    for (const [k, v] of this.occupied) l.occupied.set(k, v);
    return l;
  }

  /** Adds (`km2` > 0) or removes (`km2` < 0) one cell of that area, owned by `o` and controlled by `k`. */
  cell(o: number, k: number, km2: number): void {
    if (o === 0) return;
    this.owned[o]! += km2;
    if (k === o || k === 0) return;
    this.lost[o]! += km2;
    const key = o * 65536 + k;
    const n = (this.occupied.get(key) ?? 0) + km2;
    if (n === 0) this.occupied.delete(key);
    else this.occupied.set(key, n);
  }
}
