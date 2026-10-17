import { describe, expect, it } from 'vitest';
import { NATIONS_1938, SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { cellOf } from '../../src/sim/data/terrain';
import { elementIndex, slotCount, slotPlace } from '../../src/sim/systems/elements';
import { fileOffsets } from '../../src/worker/files';
import { assets1938 } from '../helpers/earth';

// PLAN 7.4f38: formations of one nation at one place, not in contact, drew their elements in the
// same places (two Soviet columns marching from one point). They stand as a file abreast: the
// lowest id on its place, the others a block's width to its right and left by turns.

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const INF = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');

describe('formations of one nation at one place, a file abreast (PLAN 7.4f38)', () => {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
  const [x, y] = cellOf(10.0, 50.5, W, H); // Germany, inland
  const before = s.world.formations.highWater;
  for (const n of ['GER', 'GER', 'GER', 'CZS']) s.command({ kind: 'spawnFormation', nation: id(n), x, y, strength: 0, template: INF });
  s.step(1);
  const w = s.world;
  const made = [before, before + 1, before + 2, before + 3];
  const c = w.formations.cols;

  it('the three of one nation: the first on its place, the others to its right and left', () => {
    for (const f of made) expect(w.formations.has(f)).toBe(true);
    const off = fileOffsets(w);
    const [a, b, d] = made;
    expect(off.has(a!)).toBe(false);
    const ob = off.get(b!)!;
    const od = off.get(d!)!;
    // Opposite sides of the lead, equally far, across its facing.
    expect(ob[0] + od[0]).toBeCloseTo((c.x[a!]! - c.x[b!]!) + (c.x[a!]! - c.x[d!]!), 9);
    const across = [-Math.sin(c.facing[a!]!), Math.cos(c.facing[a!]!)];
    const along = (o: [number, number], f: number): number => (c.x[f]! + o[0] - c.x[a!]!) * across[0]! + (c.y[f]! + o[1] - c.y[a!]!) * across[1]!;
    expect(along(ob, b!)).toBeGreaterThan(0);
    expect(along(od, d!)).toBeCloseTo(-along(ob, b!), 9);
  });

  it('their elements no longer stand in one another', () => {
    const off = fileOffsets(w);
    const idx = elementIndex(w);
    const places = (f: number): [number, number][] => {
      const list = idx.get(f)!;
      const n = slotCount(w, f, list.length);
      const o = off.get(f) ?? [0, 0];
      return list.map((e) => slotPlace(w, c.x[f]! + o[0], c.y[f]! + o[1], c.facing[f]!, w.elements.cols.slot[e]!, n));
    };
    const ger = made.slice(0, 3).map(places);
    let nearest = Infinity;
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) for (const p of ger[i]!) for (const q of ger[j]!) nearest = Math.min(nearest, Math.hypot(p[0] - q[0], p[1] - q[1]));
    // Before, every element of one stood on one of the other's (0 apart).
    expect(nearest).toBeGreaterThan(w.atSize(0.03) * 0.9);
  });

  it('one of another nation there is a file of its own: it keeps its place', () => {
    expect(fileOffsets(w).has(made[3]!)).toBe(false);
  });
});
