import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { packSave, unpackSave } from '../../src/shared/saveCodec';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';

// PLAN 1.27 AT: I2 and I5 on the full 1938 world after a year of AI play (wars, battles, revolts,
// production): save → load → save is byte-identical, and save → load → continue matches an
// uninterrupted run; the gzip file round-trips exactly.

it('I2 / I5 on the 1938 world after one year', async () => {
  const a = new Sim({ scenario: '1938', seed: 3, assets: assets1938(SIZE_1938.w) });
  a.step(24 * 365);
  const bytes = a.save();
  const packed = await packSave(bytes);
  const b = new Sim({ scenario: '1938', seed: 99, assets: assets1938(SIZE_1938.w) });
  b.step(5); // a live sim with its own state loads the save
  b.load(await unpackSave(packed));
  // I5: save → load → save.
  expect(Buffer.from(b.save()).equals(Buffer.from(bytes))).toBe(true);
  // I2: continue both for a month (AI, combat, economy month on 1 Feb 1939).
  a.step(24 * 40);
  b.step(24 * 40);
  expect(b.hash()).toBe(a.hash());
  if (process.env['EVIDENCE']) {
    const out = path.resolve(import.meta.dirname, '../../docs/evidence/1.27');
    mkdirSync(out, { recursive: true });
    writeFileSync(path.join(out, 'save-1939.json'), JSON.stringify({ rawBytes: bytes.length, gzipBytes: packed.length, tick: 24 * 365, nations: a.world.nations.count, formations: a.world.formations.count, wars: a.world.wars.list.length }, null, 1));
  }
}, 900_000);

// PLAN 2.11j (the fifth independent read, finding 2). The test above saves seed 3 after a year,
// where the game's supply network happened to be the one a full refresh makes. It is not at
// every tick: a refresh of the blocs whose cells changed left cells in another bloc's network
// (a puppet that was annexed) and lanes unclaimed that a neighbour reaches, and a load
// refreshes in full. In seed 3 the two part at tick 1885.

it('a game that refreshes its supply network in full at every refresh is the same game (seed 3, a hundred days)', () => {
  const a = new Sim({ scenario: '1938', seed: 3, assets: assets1938(SIZE_1938.w) });
  const b = new Sim({ scenario: '1938', seed: 3, assets: assets1938(SIZE_1938.w) });
  const apart: string[] = [];
  let refreshes = 0;
  let partial = 0;
  for (let tick = 1; tick <= 24 * 100 && apart.length === 0; tick++) {
    // The refresh is at the start of every twelfth hour, when something is marked for it.
    const due = (tick - 1) % 12 === 0 && (a.world.supplyDirty || a.world.supplyDirtyNations.size > 0 || a.world.supplyDirtyBlocs.size > 0);
    if (due) {
      refreshes++;
      if (!a.world.supplyDirty) partial++;
      b.world.supplyDirty = true;
    }
    a.step(1);
    b.step(1);
    if (!due) continue;
    const [sa, sb] = [a.world.cells.supply, b.world.cells.supply];
    let n = 0;
    for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) n++;
    if (n > 0) apart.push(`tick ${tick}: ${n} cells of the network`);
  }
  expect(refreshes).toBeGreaterThan(150);
  expect(partial).toBeGreaterThan(150);
  expect(apart).toEqual([]);
  expect(a.hash()).toBe(b.hash());
}, 900_000);

it('I2 from a save in the middle of a war (seed 3, tick 1890): a day, a month later', () => {
  const a = new Sim({ scenario: '1938', seed: 3, assets: assets1938(SIZE_1938.w) });
  a.step(1890);
  const b = new Sim({ scenario: '1938', seed: 7, assets: assets1938(SIZE_1938.w) });
  b.load(a.save());
  expect(b.hash()).toBe(a.hash());
  for (const hours of [24, 24 * 29]) {
    a.step(hours);
    b.step(hours);
    expect(b.hash(), `${a.world.tick - 1890} hours after the save`).toBe(a.hash());
  }
}, 900_000);
