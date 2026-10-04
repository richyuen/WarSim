import { describe, expect, it, vi } from 'vitest';
import { decodeSections } from '../../src/sim/core/sections';
import { Sim } from '../../src/sim/sim';
import { TOY_W, TOY_H } from '../../src/sim/toy';

// Determinism invariants (SPEC §2.6) on the toy world (PLAN 0.12):
//   I1 same seed + commands → same hash; I2 save → load → continue == uninterrupted;
//   I5 save bytes → load → save bytes identical. I3 (Node == worker) is in tests/e2e/worker.spec.ts.

const TICKS = 24 * 60; // 60 sim days

function scripted(seed: number, ticks: number): Sim {
  const sim = new Sim({ scenario: 'toy', seed });
  for (let t = 0; t < ticks; t++) {
    if (t === 100) sim.command({ kind: 'spawnFormation', nation: 1, x: 200.5, y: 64.25, strength: 5000 });
    if (t === 500) sim.command({ kind: 'removeFormation', id: 3 });
    sim.step();
  }
  return sim;
}

describe('toy world', () => {
  it('actually evolves: territory changes hands and formations churn', () => {
    const sim = new Sim({ scenario: 'toy', seed: 7 });
    const initial = sim.world.cells.controller.slice();
    const h0 = sim.hash();
    const removes = vi.spyOn(sim.world.formations, 'remove');
    const creates = vi.spyOn(sim.world.formations, 'create');
    sim.step(TICKS);
    let changed = 0;
    for (let i = 0; i < initial.length; i++) if (initial[i] !== sim.world.cells.controller[i]) changed++;
    expect(changed).toBeGreaterThan(200);
    // Formations die and are replaced (ids are reused from the free list).
    expect(removes.mock.calls.length).toBeGreaterThan(0);
    expect(creates.mock.calls.length).toBe(removes.mock.calls.length);
    expect(sim.hash()).not.toBe(h0);
    expect(sim.world.cells.w * sim.world.cells.h).toBe(TOY_W * TOY_H);
  });
});

describe('determinism invariants', () => {
  it('I1: same seed + commands → same hash; a different seed or command → a different hash', () => {
    const a = scripted(7, TICKS);
    const b = scripted(7, TICKS);
    expect(a.hash()).toBe(b.hash());
    expect(a.save()).toEqual(b.save());
    expect(scripted(8, TICKS).hash()).not.toBe(a.hash());
    const c = new Sim({ scenario: 'toy', seed: 7 });
    c.step(TICKS);
    expect(c.hash()).not.toBe(a.hash());
    expect(a.world.commandLog.map((c) => c.tick)).toEqual([100, 500]);
  });

  it('I2: save → load → continue is bit-identical to an uninterrupted run', () => {
    const uninterrupted = scripted(11, TICKS);
    for (const cut of [1, 99, 100, 101, 777]) {
      const first = scripted(11, cut);
      const resumed = new Sim({ scenario: 'toy', seed: 999 }); // seed is overwritten by the load
      resumed.load(first.save());
      for (let t = cut; t < TICKS; t++) {
        if (t === 100) resumed.command({ kind: 'spawnFormation', nation: 1, x: 200.5, y: 64.25, strength: 5000 });
        if (t === 500) resumed.command({ kind: 'removeFormation', id: 3 });
        resumed.step();
      }
      expect(resumed.save(), `cut at ${cut}`).toEqual(uninterrupted.save());
      expect(resumed.hash()).toBe(uninterrupted.hash());
    }
  });

  it('I2: a save taken with a queued command keeps it', () => {
    const a = new Sim({ scenario: 'toy', seed: 5 });
    a.step(10);
    a.command({ kind: 'spawnFormation', nation: 2, x: 10, y: 10, strength: 1 });
    const b = new Sim({ scenario: 'toy', seed: 5 });
    b.load(a.save());
    a.step(50);
    b.step(50);
    expect(b.hash()).toBe(a.hash());
    expect(b.world.commandLog).toHaveLength(1);
  });

  it('I5: save bytes → load → save bytes are identical', () => {
    const a = scripted(3, 600);
    const bytes = a.save();
    const b = new Sim({ scenario: 'toy', seed: 0 });
    b.load(bytes);
    const again = b.save();
    // First which sections differ and where: a failed comparison of 600 kB says only that they
    // do. (It failed once in a full run, 2026-10-04, and passes alone: see BLOCKERS.)
    expect(differing(again, bytes)).toEqual([]);
    expect(again).toEqual(bytes);
  });
});

/** The sections of two saves that differ, each with its first differing element and its bytes. */
function differing(a: Uint8Array, b: Uint8Array): string[] {
  const [sa, sb] = [decodeSections(a), decodeSections(b)];
  const out: string[] = [];
  if (sa.length !== sb.length) out.push(`${sa.length} sections against ${sb.length}`);
  sa.forEach((s, i) => {
    const t = sb[i];
    if (!t || t.name !== s.name || t.dtype !== s.dtype || t.data.length !== s.data.length) {
      out.push(`${s.name} (${s.dtype}, ${s.data.length}) against ${t ? `${t.name} (${t.dtype}, ${t.data.length})` : 'nothing'}`);
      return;
    }
    const x = new Uint8Array(s.data.buffer, s.data.byteOffset, s.data.byteLength);
    const y = new Uint8Array(t.data.buffer, t.data.byteOffset, t.data.byteLength);
    let first = -1;
    let n = 0;
    for (let k = 0; k < x.length; k++) {
      if (x[k] === y[k]) continue;
      if (first < 0) first = k;
      n++;
    }
    if (n === 0) return;
    const w = s.data.BYTES_PER_ELEMENT;
    const el = Math.floor(first / w);
    const hex = (v: Uint8Array): string => Array.from(v.subarray(el * w, (el + 1) * w), (c) => c.toString(16).padStart(2, '0')).join(' ');
    out.push(`${s.name} (${s.dtype}, ${s.data.length}): ${n} bytes differ, first in element ${el}: ${s.data[el]} [${hex(x)}] against ${t.data[el]} [${hex(y)}]`);
  });
  return out;
}
