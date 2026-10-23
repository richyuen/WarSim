import { describe, expect, it } from 'vitest';
import { streamFor } from '../../src/sim/core/rng';
import { enemyDistance, enemyWithin } from '../../src/sim/systems/capitals';
import { World } from '../../src/sim/world';

// PLAN 7.83d: the capitals' searches cut without changing an answer. The early-stopped search
// (`enemyDistance`) and the diamond scan (`enemyWithin`) against the full breadth-first pass over
// the grid they replace, on open and looping maps.

/** The old pass: steps from the enemy's cells to every cell, out to `cap` (-1 beyond); null with none. */
function fullPass(w: World, enemy: Uint8Array, cap = Infinity): Int32Array | null {
  const { w: W, h, controller } = w.cells;
  const dist = new Int32Array(controller.length).fill(-1);
  const queue: number[] = [];
  for (let c = 0; c < controller.length; c++) {
    if (enemy[controller[c]!] === 1) {
      dist[c] = 0;
      queue.push(c);
    }
  }
  if (queue.length === 0) return null;
  const wrap = w.settings.loopingMap;
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head]!;
    const d = dist[c]! + 1;
    if (d > cap) break;
    const x = c % W;
    const next = [c >= W ? c - W : -1, c < W * h - W ? c + W : -1, x > 0 ? c - 1 : wrap ? c + W - 1 : -1, x < W - 1 ? c + 1 : wrap ? c - W + 1 : -1];
    for (const m of next) {
      if (m >= 0 && dist[m] === -1) {
        dist[m] = d;
        queue.push(m);
      }
    }
  }
  return dist;
}

/** A world of `w` × `h` with blobs of nations 1–4 on a sea of none. */
function blobWorld(seed: number, w: number, h: number, wrap: boolean, blobs: number): World {
  const world = new World(seed, w, h);
  world.settings.loopingMap = wrap;
  const rng = streamFor(seed, 'test');
  for (let b = 0; b < blobs; b++) {
    const n = 1 + Math.floor(rng.nextFloat() * 4);
    const cx = Math.floor(rng.nextFloat() * w);
    const cy = Math.floor(rng.nextFloat() * h);
    const r = 1 + Math.floor(rng.nextFloat() * 6);
    for (let y = Math.max(0, cy - r); y <= Math.min(h - 1, cy + r); y++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = (((cx + dx) % w) + w) % w;
        if (rng.nextFloat() < 0.8) world.cells.controller[y * w + x] = n;
      }
    }
  }
  return world;
}

describe('the capitals searches (PLAN 7.83d)', () => {
  const cases: [string, boolean][] = [
    ['an open map', false],
    ['a looping map', true],
  ];
  for (const [name, wrap] of cases) {
    it(`the search stopped at its targets gives each the full pass's steps (${name})`, () => {
      for (let seed = 1; seed <= 12; seed++) {
        const world = blobWorld(seed, 61, 37, wrap, 3 + (seed % 5));
        const enemy = new Uint8Array(5);
        enemy[1 + (seed % 4)] = 1;
        enemy[1 + ((seed + 2) % 4)] = seed % 3 === 0 ? 1 : 0;
        const ref = fullPass(world, enemy);
        const targets: number[] = [];
        for (let c = 0; c < world.cells.controller.length; c++) if (enemy[world.cells.controller[c]!] !== 1 && (c * 7 + seed) % 5 === 0) targets.push(c);
        const got = enemyDistance(world, enemy, targets);
        if (ref === null) {
          expect(got).toBeNull();
          continue;
        }
        expect(got).not.toBeNull();
        expect(Array.from(got!)).toEqual(targets.map((t) => ref[t]!));
        // The buffers are put back: a second call on other targets reads the same.
        const again = enemyDistance(world, enemy, targets.slice(0, 5));
        expect(Array.from(again!)).toEqual(targets.slice(0, 5).map((t) => ref[t]!));
      }
    });

    it(`the diamond scan gives the capped pass's steps, the cap beyond it (${name})`, () => {
      for (let seed = 1; seed <= 12; seed++) {
        const world = blobWorld(100 + seed, 53, 29, wrap, 2 + (seed % 4));
        const enemy = new Uint8Array(5);
        enemy[1 + (seed % 4)] = 1;
        const cap = 3 + (seed % 9);
        const ref = fullPass(world, enemy, cap);
        for (let c = 0; c < world.cells.controller.length; c += 3) {
          const want = ref === null || ref[c]! < 0 ? cap : Math.min(ref[c]!, cap);
          expect(enemyWithin(world, enemy, c, cap)).toBe(want);
        }
      }
    });
  }

  it('a looping map counts the steps the short way round, an open one does not', () => {
    const world = new World(1, 40, 3);
    world.cells.controller[1 * 40 + 38] = 2; // two cells left of the wrap, row 1
    const enemy = new Uint8Array(3);
    enemy[2] = 1;
    world.settings.loopingMap = true;
    expect(enemyWithin(world, enemy, 1 * 40 + 1, 10)).toBe(3);
    expect(Array.from(enemyDistance(world, enemy, [1 * 40 + 1, 0])!)).toEqual([3, 3]);
    world.settings.loopingMap = false;
    expect(enemyWithin(world, enemy, 1 * 40 + 1, 10)).toBe(10);
    expect(Array.from(enemyDistance(world, enemy, [1 * 40 + 1, 0])!)).toEqual([37, 39]);
  });
});
