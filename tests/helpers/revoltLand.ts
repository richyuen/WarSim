import { EventKind } from '../../src/shared/events';
import { REGION_KM2 } from '../../src/sim/systems/revolts';
import type { World } from '../../src/sim/world';

/**
 * PLAN 3.9 (the critic's R3-B2): what the revolts of one tick handed over. `before` is the
 * owner of every cell as the tick began, `events` the tick's flat event records. For each nation
 * a revolt founded, revived or enlarged (`RevoltSpawned`, a = that nation, b = the holder), the
 * land it took from its holders is at most REGION_KM2 for each of its revolts, beside the
 * provinces that are larger than that alone (such a province rises whole and alone, ADR-186).
 * Returns the nations that took more, as text; empty when none did.
 */
export function revoltLand(w: World, before: Uint16Array, events: readonly number[], name: (n: number) => string): string[] {
  const revolts = new Map<number, Set<number>>();
  const count = new Map<number, number>();
  for (let i = 0; i < events.length; i += 6) {
    if (events[i + 1] !== EventKind.RevoltSpawned) continue;
    const a = events[i + 2]!;
    revolts.set(a, (revolts.get(a) ?? new Set<number>()).add(events[i + 3]!));
    count.set(a, (count.get(a) ?? 0) + 1);
  }
  if (revolts.size === 0) return [];
  const { owner, province, w: width, h } = w.cells;
  const rowKm2 = w.landCounts().rowKm2;
  // nation → province → km² taken from a holder it rose against.
  const taken = new Map<number, Map<number, number>>();
  for (let y = 0, c = 0; y < h; y++) {
    for (let x = 0; x < width; x++, c++) {
      const o = owner[c]!;
      if (o === before[c] || !revolts.get(o)?.has(before[c]!)) continue;
      const by = taken.get(o) ?? new Map<number, number>();
      by.set(province[c]!, (by.get(province[c]!) ?? 0) + rowKm2[y]!);
      taken.set(o, by);
    }
  }
  const out: string[] = [];
  for (const [n, by] of [...taken].sort((a, b) => a[0] - b[0])) {
    let land = 0;
    let giants = 0;
    for (const km2 of by.values()) {
      land += km2;
      if (km2 > REGION_KM2) giants += km2;
    }
    const bound = count.get(n)! * REGION_KM2 + giants;
    if (land > bound) out.push(`${name(n)}: ${land} km² in ${by.size} provinces by ${count.get(n)} revolts (bound ${bound})`);
  }
  return out;
}
