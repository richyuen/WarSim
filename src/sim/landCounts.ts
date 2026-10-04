/**
 * Land tallies for war scores (SPEC §6): cells owned, cells owned but held by another nation, and
 * cells by (owner, occupier) pair. Derived, never saved. Built by one scan of the map, then kept
 * by `World.setOwner` / `World.setController`, through which every change of a cell after the
 * scenario build passes (PLAN 1.42f: a daily scan of the 2 M cells was 6% of the tick). A load
 * drops it. The values are those of the scan; `tests/unit/landCounts.test.ts` compares the two.
 */
export class LandCounts {
  /** Cells owned, by nation id (ids are 16-bit). */
  readonly owned = new Uint32Array(65536);
  /** Cells owned but controlled by another nation, by owner. */
  readonly lost = new Uint32Array(65536);
  /** key owner·65536 + controller → cells (no zero entries). */
  readonly occupied = new Map<number, number>();

  static scan(owner: ArrayLike<number>, controller: ArrayLike<number>): LandCounts {
    const l = new LandCounts();
    // Occupied cells come in runs of one (owner, occupier) pair: count the run, then add it once.
    let runKey = -1;
    let run = 0;
    for (let c = 0; c < owner.length; c++) {
      const o = owner[c]!;
      if (o === 0) continue;
      l.owned[o]!++;
      const k = controller[c]!;
      if (k !== o && k !== 0) {
        l.lost[o]!++;
        const key = o * 65536 + k;
        if (key !== runKey) {
          if (run > 0) l.occupied.set(runKey, (l.occupied.get(runKey) ?? 0) + run);
          runKey = key;
          run = 0;
        }
        run++;
      }
    }
    if (run > 0) l.occupied.set(runKey, (l.occupied.get(runKey) ?? 0) + run);
    return l;
  }

  /** A copy that later changes of the map do not touch (the war pass reads one per day). */
  snapshot(): LandCounts {
    const l = new LandCounts();
    l.owned.set(this.owned);
    l.lost.set(this.lost);
    for (const [k, v] of this.occupied) l.occupied.set(k, v);
    return l;
  }

  /** Adds (`d` = 1) or removes (`d` = −1) one cell owned by `o` and controlled by `k`. */
  cell(o: number, k: number, d: 1 | -1): void {
    if (o === 0) return;
    this.owned[o]! += d;
    if (k === o || k === 0) return;
    this.lost[o]! += d;
    const key = o * 65536 + k;
    const n = (this.occupied.get(key) ?? 0) + d;
    if (n === 0) this.occupied.delete(key);
    else this.occupied.set(key, n);
  }
}
