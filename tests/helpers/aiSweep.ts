import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from './earth';
import { strayNaN } from './stateNumbers';

/**
 * PLAN 1.24 AT: a 10-year 1938 run on `seed` has ≥ 3 wars, ≥ 1 peace, ≥ 1 alliance change; and,
 * at every year end, no two members of one alliance are at war.
 */
export function aiSweep(seed: number): void {
  const s = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
  const counts: Record<string, number> = {};
  const names = Object.fromEntries(Object.entries(EventKind).map(([k, v]) => [v, k]));
  const yearly: Record<string, number>[] = [];
  const t0 = performance.now();
  // The game as it is saved at the end of year 9 (PLAN 2.12): loaded below, it must end year 10
  // as this game does.
  let saved: Uint8Array | null = null;
  for (let y = 0; y < 10; y++) {
    if (y === 9) saved = s.save();
    const year: Record<string, number> = {};
    s.step(24 * 365, (w) => {
      const ev = w.out.events;
      for (let i = 0; i < ev.length; i += 6) {
        const k = names[ev[i + 1]!]!;
        counts[k] = (counts[k] ?? 0) + 1;
        year[k] = (year[k] ?? 0) + 1;
      }
      ev.length = 0;
      w.out.fires.length = 0;
    });
    yearly.push(year);
    // Invariant (review in PLAN 1.34a): no alliance has two members at war with each other.
    for (const al of s.world.alliances.list) {
      for (const m of al.members) for (const o of al.members) if (m < o) expect(s.world.wars.atWar(m, o), `seed ${seed} year ${y}: allies ${m} and ${o} at war`).toBe(false);
    }
  }
  // A loaded game goes on as the game that was saved, late in a game too (PLAN 2.12, the
  // critic's R2-B4: its tables are as long as the save, where this game's have doubled; a
  // nation founded as a table grew was lost, and the two games lost different nations).
  const loaded = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
  loaded.load(saved!);
  loaded.step(24 * 365);
  expect(loaded.hash(), `seed ${seed}: the game saved at the end of year 9 and loaded, at the end of year 10 (nations up to ${s.world.nations.highWater - 1})`).toBe(s.hash());
  // And after ten years no number of the state is a NaN out of arithmetic (see `strayNaN`).
  expect(strayNaN(s.world), `seed ${seed}: NaN in the state after ten years`).toEqual([]);
  const wars = counts['WarDeclared'] ?? 0;
  const peace = counts['PeaceSigned'] ?? 0;
  const alliance = (counts['AllianceJoined'] ?? 0) + (counts['AllianceLeft'] ?? 0) + (counts['AllianceDissolved'] ?? 0);
  if (process.env['EVIDENCE']) {
    const out = path.resolve(import.meta.dirname, '../../docs/evidence/1.24');
    mkdirSync(out, { recursive: true });
    writeFileSync(path.join(out, `sweep-seed${seed}.json`), JSON.stringify({ seed, wallS: (performance.now() - t0) / 1000, totals: counts, yearly }, null, 1));
  }
  expect(wars, `seed ${seed} wars`).toBeGreaterThanOrEqual(3);
  expect(peace, `seed ${seed} peaces`).toBeGreaterThanOrEqual(1);
  expect(alliance, `seed ${seed} alliance changes`).toBeGreaterThanOrEqual(1);
}
