import { describe, expect, it } from 'vitest';
import type { Command } from '../../src/shared/commands';
import { Terrain } from '../../src/shared/terrain';
import { xxhash32View } from '../../src/sim/core/hash';
import { cellOf } from '../../src/sim/data/terrain';
import { brushCells, bucketCells, lineCells, UNDO_DEPTH } from '../../src/sim/editor';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { navOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 1.35 AT (unit part): the editor's tools and its undo stack.

const { w: W, h: H } = SIZE_1938;
const [GER, POL] = ['GER', 'POL'].map(nationId) as number[];
const rasters = (w: World): number[] => [xxhash32View(w.cells.owner), xxhash32View(w.cells.controller), xxhash32View(w.cells.terrain)];
const [wx, wy] = cellOf(19.5, 52, W, H); // central Poland

function sim(): Sim {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
  s.world.settings.aiEnabled = false; // isolate the edits
  return s;
}
function run(s: Sim, ...cmds: Command[]): void {
  for (const c of cmds) s.command(c);
  s.applyNow();
}
const brush = (value: number, r = 4, layer: 'nation' | 'terrain' = 'nation', mask: { kind: 'terrain' | 'nation'; value: number } | null = null): Command => ({ kind: 'editPaint', layer, tool: 'brush', x: wx, y: wy, x2: 0, y2: 0, r, value, mask });

describe('editor tools (PLAN 1.35)', () => {
  it('brush is a wrapped disc, line stamps along the segment, bucket fills one connected value', () => {
    expect(brushCells(100, 50, 5, 5, 0)).toEqual([5 * 100 + 5]);
    expect(brushCells(100, 50, 5, 5, 1).length).toBe(5);
    expect(brushCells(100, 50, 0, 5, 1)).toContain(5 * 100 + 99); // wraps x
    expect(brushCells(100, 50, 5, 0, 1).every((c) => c >= 0)).toBe(true); // clipped y
    const line = lineCells(100, 50, 2, 2, 12, 2, 0);
    expect(line).toEqual(Array.from({ length: 11 }, (_, i) => 2 * 100 + 2 + i));
    const s = sim();
    const fill = bucketCells(s.world, 'nation', wx, wy);
    // Mainland Poland: Polish land cells only, nearly all of its land (a few cells lie apart).
    expect(fill.every((c) => s.world.cells.owner[c] === POL)).toBe(true);
    expect(fill.length).toBeGreaterThan(0.95 * s.world.nations.cols.cells[POL!]!);
    expect(fill.length).toBeLessThanOrEqual(s.world.nations.cols.cells[POL!]!);
  });

  it('paint, undo and redo restore the exact rasters; a new edit clears redo', () => {
    const s = sim();
    const before = rasters(s.world);
    run(s, brush(GER!));
    const painted = rasters(s.world);
    expect(painted).not.toEqual(before);
    expect(s.world.cells.owner[Math.floor(wy) * W + Math.floor(wx)]).toBe(GER);
    run(s, { kind: 'editUndo' });
    expect(rasters(s.world)).toEqual(before);
    run(s, { kind: 'editRedo' });
    expect(rasters(s.world)).toEqual(painted);
    run(s, { kind: 'editUndo' }, brush(GER!, 2));
    expect(s.world.edits.redo.length).toBe(0);
    expect(s.world.edits.undo.length).toBe(1);
  });

  it('a target mask limits the paint; terrain edits change land into land and invalidate pathing', () => {
    const s = sim();
    const t = s.world.cells.terrain;
    const area = brushCells(W, H, wx, wy, 6);
    const kinds = new Set(area.map((c) => t[c]!));
    const only = [...kinds].find((k) => k !== Terrain.Water)!;
    run(s, brush(GER!, 6, 'nation', { kind: 'terrain', value: only }));
    for (const c of area) expect(s.world.cells.owner[c] === GER, `cell ${c}`).toBe(t[c] === only);
    navOf(s.world); // build pathing, then edit terrain
    run(s, brush(Terrain.Mountains, 3, 'terrain'));
    expect(s.world.nav).toBeNull();
    expect(brushCells(W, H, wx, wy, 3).every((c) => t[c] === Terrain.Mountains || t[c] === Terrain.Water || t[c] === Terrain.Crossing)).toBe(true);
    // Water is never painted and never becomes land.
    run(s, { kind: 'editPaint', layer: 'terrain', tool: 'brush', x: wx, y: wy, x2: 0, y2: 0, r: 2, value: Terrain.Water, mask: null });
    expect(s.world.edits.undo.length).toBe(2);
  });

  it(`the stack keeps at most ${UNDO_DEPTH} edits`, () => {
    const s = sim();
    for (let i = 0; i < UNDO_DEPTH + 5; i++) run(s, brush(i % 2 === 0 ? GER! : POL!, 1));
    expect(s.world.edits.undo.length).toBe(UNDO_DEPTH);
  });

  it('the stack is state: after save/load, undo still restores, and replays match', () => {
    const s = sim();
    const before = rasters(s.world);
    run(s, brush(GER!), brush(0, 2));
    run(s, { kind: 'editUndo' });
    const t = sim();
    t.load(s.save());
    expect(t.hash()).toBe(s.hash());
    expect([t.world.edits.undo.length, t.world.edits.redo.length]).toEqual([1, 1]);
    for (const x of [s, t]) run(x, { kind: 'editUndo' });
    expect(rasters(t.world)).toEqual(before);
    expect(t.hash()).toBe(s.hash());
  });
});
