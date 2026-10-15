/**
 * The border index (PLAN 7.1l1): a bit per cell, set where the cell's controller is a nation and
 * a 4-neighbour is held by another nation. The neighbours over the east and west edges count
 * whether the map loops or not, so the set is the border of either map: it holds every frontier
 * cell (a frontier cell's hostile neighbour is a nation not its own), and the frontier's rebuild
 * tests its cells alone, in ascending order, where it scanned the grid.
 *
 * Derived, never saved: built by a scan on first use (`World.borderBits`), kept by
 * `World.setController`, dropped where the controllers are written without it (a load).
 */

/** Whether cell `c` is on the border: held, with a neighbour held by another nation. */
function onBorder(ctl: Uint16Array, w: number, h: number, c: number): boolean {
  const a = ctl[c]!;
  if (a === 0) return false;
  const differs = (k: number): boolean => {
    const b = ctl[k]!;
    return b !== 0 && b !== a;
  };
  const x = c % w;
  if (c >= w && differs(c - w)) return true;
  if (c < (h - 1) * w && differs(c + w)) return true;
  if (differs(x > 0 ? c - 1 : c + w - 1)) return true;
  return differs(x < w - 1 ? c + 1 : c - w + 1);
}

/** The border of the map, by a scan of its cells. */
export function scanBorder(ctl: Uint16Array, w: number, h: number): Uint32Array {
  const bits = new Uint32Array((w * h + 31) >>> 5);
  for (let c = 0; c < w * h; c++) if (onBorder(ctl, w, h, c)) bits[c >>> 5]! |= 1 << (c & 31);
  return bits;
}

/** Sets the bits of cell `c` and its four neighbours again after a change of `c`'s controller. */
export function borderChanged(bits: Uint32Array, ctl: Uint16Array, w: number, h: number, c: number): void {
  const x = c % w;
  const set = (k: number): void => {
    if (onBorder(ctl, w, h, k)) bits[k >>> 5]! |= 1 << (k & 31);
    else bits[k >>> 5]! &= ~(1 << (k & 31));
  };
  set(c);
  if (c >= w) set(c - w);
  if (c < (h - 1) * w) set(c + w);
  set(x > 0 ? c - 1 : c + w - 1);
  set(x < w - 1 ? c + 1 : c - w + 1);
}
