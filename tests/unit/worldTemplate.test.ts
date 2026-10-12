import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { xxhash32View } from '../../src/sim/core/hash';
import { Table } from '../../src/sim/core/table';
import { keepWorldTemplates, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import type { World } from '../../src/sim/world';
import { at1938, simKey } from '../helpers/checkpoint';
import { assets1938 } from '../helpers/earth';

// ADR-279: a 1938 world made from the template of an earlier build (the unit tests' setup) is
// the world a build gives: the same state, whatever its seed, the same parts outside its state,
// and the same state after a day and a half. A checkpoint (`at1938`) is the world the same
// stepping gives.

const W = SIZE_1938.w;
const build = (seed: number): Sim => new Sim({ scenario: '1938', seed, assets: assets1938(W) });

/** Caches derived from the state (a load drops them; rebuilt on demand) and the drawing's version counters. */
const DERIVED = new Set(['navKey', 'navStale', 'elementIndex', 'cellPoints', 'inland', 'nav', 'sea', 'portSea', 'lanes', 'contacts', 'frontier', 'frontierMask', 'held', 'land', 'stepWays', 'stepWaysGrid', 'deployed', 'deployedBefore', 'flipping', 'terrainVersion', 'citiesVersion', 'namesVersion', 'flagsVersion', 'out', 'rng']);

/** The world's fields outside its saved parts, but the derived ones: a typed array by its hash, the map data by identity. */
function outside(w: World): Record<string, unknown> {
  const parts = new Set<unknown>(w.parts());
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(w)) {
    if (parts.has(v) || DERIVED.has(k)) continue;
    out[k] = v instanceof Map ? [...v] : v instanceof Set ? [...v] : ArrayBuffer.isView(v) ? `${(v as Uint8Array).length}:${xxhash32View(v)}` : v;
  }
  return out;
}

describe('a 1938 world made from a template (ADR-279)', () => {
  keepWorldTemplates(false);
  const real = [build(5), build(99)];
  keepWorldTemplates(true);
  const first = build(5);
  const made = [build(5), build(99)];

  it('the first world of the assets is built; the next ones have the state a build gives, whatever the seed', () => {
    expect(first.hash()).toBe(real[0]!.hash());
    expect(made[0]!.hash()).toBe(real[0]!.hash());
    expect(made[1]!.hash()).toBe(real[1]!.hash());
    expect(made[1]!.world.seed).toBe(99);
  });

  it('and the same parts outside their state: the map, the seas, the ports, the rules', () => {
    for (let i = 0; i < 2; i++) {
      const [a, b] = [outside(made[i]!.world), outside(real[i]!.world)];
      expect(Object.keys(a)).toEqual(Object.keys(b));
      for (const k of Object.keys(b)) {
        const big = k === 'landMask' || k === 'rules' || k === 'seaSeeds' || k === 'seaPassages' || k === 'seaIce';
        if (big) expect(a[k], k).toBe(b[k]);
        else expect(a[k], k).toEqual(b[k]);
      }
    }
    expect(made[1]!.world.ports.length).toBeGreaterThan(100);
    // And the tables with the room the build left them: a `cols` held lasts as many creates.
    const room = (s: Sim): number[] => s.world.parts().map((p) => (p instanceof Table ? p.capacity : -1));
    for (let i = 0; i < 2; i++) expect(room(made[i]!)).toEqual(room(real[i]!));
  });

  it('and they run as the built ones do', () => {
    for (let i = 0; i < 2; i++) {
      real[i]!.step(36);
      made[i]!.step(36);
      expect(made[i]!.hash(), `seed ${[5, 99][i]}`).toBe(real[i]!.hash());
    }
  });
});

describe('a checkpoint of the 1938 world (ADR-279)', () => {
  it('is the world the same stepping gives, when written and when read', () => {
    const ticks = 30;
    const run = build(11);
    run.step(ticks);
    const file = path.join(import.meta.dirname, '../../.cache/checkpoints', simKey(), `11-${ticks}.bin`);
    rmSync(file, { force: true });
    const written = at1938(11, ticks);
    expect(existsSync(file)).toBe(true);
    const read = at1938(11, ticks);
    expect(written.hash()).toBe(run.hash());
    expect(read.hash()).toBe(run.hash());
    expect(read.tick).toBe(ticks);
    // And it runs on as the stepped world does.
    run.step(12);
    read.step(12);
    expect(read.hash()).toBe(run.hash());
    rmSync(file, { force: true });
  });

  it('is keyed by what the sim is made of', () => {
    expect(simKey()).toMatch(/^[0-9a-f]{8}$/);
    expect(simKey()).toBe(simKey());
  });
});
