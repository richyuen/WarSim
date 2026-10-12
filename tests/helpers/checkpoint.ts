import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { xxhash32 } from '../../src/sim/core/hash';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from './earth';

// ADR-279: the 1938 world of a seed after a number of hours, saved once and loaded by every test
// that only needs it there (a pure run: no command, nothing looked at on the way). A checkpoint
// is the state the same stepping gives; it lives in `.cache/checkpoints/<key>/`, where the key is
// a hash of everything the sim is made of: a change to any of it writes new ones.

const ROOT = path.resolve(import.meta.dirname, '../..');
const DIR = path.join(ROOT, '.cache/checkpoints');
/** What the sim and its 1938 world are made of (the gate's sweep inputs, but the tests). */
const INPUTS = ['src/sim', 'src/shared', 'data', 'public/data', 'package-lock.json'];

function filesOf(p: string): string[] {
  const abs = path.join(ROOT, p);
  if (!statSync(abs).isDirectory()) return [p];
  return readdirSync(abs, { withFileTypes: true })
    .map((e) => path.posix.join(p, e.name))
    .sort()
    .flatMap((f) => filesOf(f));
}

let key: string | undefined;
/** The hash of the sim's inputs: their paths and bytes. */
export function simKey(): string {
  if (key === undefined) {
    let h = 0;
    for (const f of INPUTS.flatMap(filesOf)) h = xxhash32(readFileSync(path.join(ROOT, f)), xxhash32(new TextEncoder().encode(f), h));
    key = (h >>> 0).toString(16).padStart(8, '0');
  }
  return key;
}

/**
 * A 1938 world of `seed` after `ticks` hours of play from the start, as `new Sim` and `step`
 * give it: loaded from its checkpoint, written by the first test that asks for it.
 */
export function at1938(seed: number, ticks: number): Sim {
  const s = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
  const dir = path.join(DIR, simKey());
  const file = path.join(dir, `${seed}-${ticks}.bin`);
  let bytes: Uint8Array | null = null;
  try {
    bytes = new Uint8Array(readFileSync(file));
  } catch {
    // Not written yet.
  }
  if (bytes) {
    s.load(bytes);
    return s;
  }
  s.step(ticks);
  // Written whole and renamed (two test workers may write the same one); the checkpoints of
  // other sims are dropped.
  mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, s.save());
  renameSync(tmp, file);
  for (const old of readdirSync(DIR)) if (old !== simKey()) rmSync(path.join(DIR, old), { recursive: true, force: true });
  return s;
}
