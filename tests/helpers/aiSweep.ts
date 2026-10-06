import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import { isMonthStart } from '../../src/shared/calendar';
import { EventKind } from '../../src/shared/events';
import { FLAG_H, FLAG_W, foundedFlag, specToPixels } from '../../src/shared/flagPixels';
import { foundedName, provinceLabel } from '../../src/shared/nationNames';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { deadLand } from './deadLand';
import { assets1938, earthAdmin1 } from './earth';
import { strayNaN } from './stateNumbers';

/**
 * PLAN 1.24 AT: a 10-year 1938 run on `seed` has ≥ 3 wars, ≥ 1 peace, ≥ 1 alliance change; and,
 * at every year end, no two members of one alliance are at war.
 *
 * PLAN 2.15 AT (the critic's R2-B6): every nation founded in those years has an origin, a name
 * that is not "Free state N", and a flag of two colours or more with its own colour on it.
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
      // PLAN 2.16Rf: at every month's end no cell has a dead nation as its owner or its controller.
      if (isMonthStart(w.startDay, w.tick)) expect(deadLand(w), `seed ${seed}, tick ${w.tick}: land of the dead`).toEqual([]);
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
  // The nations the game founded (PLAN 2.15): each has a name and a flag. The flag is the one the
  // view draws: a function of the id and the colour (ADR-101).
  const nc = s.world.nations.cols;
  const labels = earthAdmin1().meta.map(provinceLabel);
  let founded = 0;
  for (let id = NATIONS_1938.length + 1; id < s.world.nations.highWater; id++) {
    founded++;
    const origin = nc.origin[id]!;
    expect(origin, `seed ${seed}, nation ${id}: an origin`).toBeGreaterThan(0);
    expect(foundedName(id, origin, labels), `seed ${seed}, nation ${id}, origin ${origin}`).not.toMatch(/^Free state d+$/);
    const n = new Map<number, number>();
    for (const v of specToPixels(foundedFlag(id, nc.color[id]!), {})) n.set(v, (n.get(v) ?? 0) + 1);
    const colours = [...n].filter(([, k]) => k >= (FLAG_W * FLAG_H) / 20).map(([c]) => c);
    expect(colours.length, `seed ${seed}, nation ${id}: the colours of its flag`).toBeGreaterThanOrEqual(2);
    expect(colours, `seed ${seed}, nation ${id}: its colour on its flag`).toContain(nc.color[id]!);
  }
  expect(founded, `seed ${seed}: nations founded in ten years`).toBeGreaterThan(0);
  console.log(`seed ${seed}: ${founded} nations founded in ten years, each with a name and a flag`);
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
