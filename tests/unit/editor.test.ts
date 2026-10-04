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

// PLAN 1.44: a brush dragged over the map is a stroke: a stamp where it starts and a line to
// every further point. The whole stroke is one undo step.
describe('brush strokes (PLAN 1.44)', () => {
  const stamp = (value: number, x: number, y: number, stroke?: 'start' | 'more'): Command => ({ kind: 'editPaint', layer: 'nation', tool: 'brush', x, y, x2: 0, y2: 0, r: 1, value, mask: null, ...(stroke ? { stroke } : {}) });
  const seg = (value: number, x: number, y: number, x2: number, y2: number, stroke: 'more' | null = 'more'): Command => ({ kind: 'editPaint', layer: 'nation', tool: 'line', x, y, x2, y2, r: 1, value, mask: null, ...(stroke ? { stroke } : {}) });
  /** Paint from (wx, wy) east, then south-east, 30 cells long: as one stroke, or as three paints apart. */
  const strokeOf = (value: number, oneStroke = true): Command[] => [
    stamp(value, wx, wy, oneStroke ? 'start' : undefined),
    seg(value, wx, wy, wx + 12, wy, oneStroke ? 'more' : null),
    seg(value, wx + 12, wy, wx + 30, wy + 6, oneStroke ? 'more' : null),
  ];
  const path = [...lineCells(W, H, wx, wy, wx + 12, wy, 0), ...lineCells(W, H, wx + 12, wy, wx + 30, wy + 6, 0)];

  it('paints every cell under its path and is one undo step', () => {
    const s = sim();
    const before = rasters(s.world);
    run(s, ...strokeOf(GER!));
    expect(path.length).toBeGreaterThan(30);
    for (const c of path) expect(s.world.cells.owner[c], `cell ${c}`).toBe(GER);
    expect(s.world.edits.undo.length).toBe(1);
    expect(s.world.edits.stroke).toBe(true);
    const painted = rasters(s.world);
    // The stroke's edit lists each changed cell once: the same picture as the three paints apart.
    const apart = sim();
    run(apart, ...strokeOf(GER!, false));
    expect(rasters(apart.world)).toEqual(painted);
    expect(apart.world.edits.undo.length).toBe(3);
    expect(s.world.edits.undo[0]!.cells.length).toBe(apart.world.edits.undo.reduce((n, e) => n + e.cells.length, 0));
    expect(new Set(s.world.edits.undo[0]!.cells).size).toBe(s.world.edits.undo[0]!.cells.length);

    run(s, { kind: 'editUndo' });
    expect(rasters(s.world)).toEqual(before);
    expect([s.world.edits.undo.length, s.world.edits.redo.length, s.world.edits.stroke]).toEqual([0, 1, false]);
    run(s, { kind: 'editRedo' });
    expect(rasters(s.world)).toEqual(painted);
  });

  it('a stroke ends with the next stroke, any other paint, an undo or a redo', () => {
    const s = sim();
    run(s, ...strokeOf(GER!), ...strokeOf(0));
    expect(s.world.edits.undo.length).toBe(2); // two strokes, two steps
    run(s, brush(POL!, 2)); // a plain click
    expect([s.world.edits.undo.length, s.world.edits.stroke]).toEqual([3, false]);
    // `more` with no stroke open opens one, and the next `more` joins it.
    run(s, seg(GER!, wx, wy + 10, wx + 8, wy + 10), seg(GER!, wx + 8, wy + 10, wx + 16, wy + 10));
    expect([s.world.edits.undo.length, s.world.edits.stroke]).toEqual([4, true]);
    // After an undo the stroke is closed: the same segment again is a step of its own.
    run(s, { kind: 'editUndo' });
    expect(s.world.edits.stroke).toBe(false);
    run(s, seg(GER!, wx, wy + 10, wx + 8, wy + 10));
    expect(s.world.edits.undo.length).toBe(4);
    // Another value or layer within a stroke starts a new step.
    run(s, seg(POL!, wx, wy + 12, wx + 8, wy + 12));
    expect(s.world.edits.undo.length).toBe(5);
    run(s, { kind: 'editPaint', layer: 'terrain', tool: 'line', x: wx, y: wy, x2: wx + 5, y2: wy, r: 1, value: Terrain.Hills, mask: null, stroke: 'more' });
    expect(s.world.edits.undo.length).toBe(6);
  });

  it('a start that changes nothing leaves no empty step; the stroke begins with its first change', () => {
    const s = sim();
    run(s, stamp(POL!, wx, wy, 'start')); // Polish paint on Polish land
    expect([s.world.edits.undo.length, s.world.edits.stroke]).toEqual([0, false]);
    run(s, seg(POL!, wx, wy, wx + 3, wy)); // still nothing
    expect(s.world.edits.undo.length).toBe(0);
    const [gx, gy] = cellOf(13.4, 52.5, W, H); // Berlin
    run(s, seg(POL!, gx, gy, gx + 4, gy), seg(POL!, gx + 4, gy, gx + 8, gy));
    expect([s.world.edits.undo.length, s.world.edits.stroke]).toEqual([1, true]);
  });

  it('a long stroke is still one step, and the depth cap counts strokes, not segments', () => {
    const s = sim();
    const before = rasters(s.world);
    const cmds: Command[] = [stamp(GER!, wx, wy, 'start')];
    for (let i = 0; i < UNDO_DEPTH + 20; i++) cmds.push(seg(GER!, wx + i * 0.5, wy, wx + (i + 1) * 0.5, wy));
    run(s, ...cmds);
    expect(s.world.edits.undo.length).toBe(1);
    run(s, { kind: 'editUndo' });
    expect(rasters(s.world)).toEqual(before);
  });

  it('a cell the game changed under the stroke returns to its value before the stroke', () => {
    const s = sim();
    const c = Math.floor(wy) * W + Math.floor(wx);
    run(s, stamp(GER!, wx, wy, 'start'));
    // The running game takes the cell for Poland again (a war would do it); the stroke passes over it once more.
    s.world.setController(c, POL!);
    run(s, seg(GER!, wx, wy, wx + 2, wy));
    expect(s.world.edits.undo.length).toBe(1);
    expect([s.world.cells.owner[c], s.world.cells.controller[c]]).toEqual([GER, GER]);
    run(s, { kind: 'editUndo' });
    expect([s.world.cells.owner[c], s.world.cells.controller[c]]).toEqual([POL, POL]);
  });

  it('an open stroke is state: a save in mid-stroke continues identically, and a closed one hashes as before', () => {
    const s = sim();
    const fresh = s.hash();
    const [first, ...rest] = strokeOf(GER!);
    run(s, first!, rest[0]!);
    const t = sim();
    t.load(s.save());
    expect(t.hash()).toBe(s.hash());
    expect(t.world.edits.stroke).toBe(true);
    for (const x of [s, t]) run(x, rest[1]!);
    expect(t.hash()).toBe(s.hash());
    expect(t.world.edits.undo.length).toBe(1);
    for (const x of [s, t]) run(x, { kind: 'editUndo' });
    expect(t.hash()).toBe(s.hash());
    // No stroke open and nothing on the stack: the edit section has the bytes it always had.
    const meta = new TextDecoder().decode(sim().world.edits.serialize().find((x) => x.name === 'edits.json')!.data as Uint8Array);
    expect(meta).toBe('{"undo":0,"edits":[]}');
    expect(sim().hash()).toBe(fresh);
  });
});
