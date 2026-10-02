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
