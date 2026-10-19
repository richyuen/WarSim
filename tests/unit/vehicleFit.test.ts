import { describe, expect, it } from 'vitest';
import { vehicleBox } from '../../src/render/units/atlas';
import { figureCells, figureCount, figureOffsets, fitScales, gridSide, type FitElements } from '../../src/render/units/individuals';
import { SLOT_GAP_CELLS } from '../../src/render/units/ships';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { DEPLOY_SCATTER } from '../../src/sim/systems/elements';
import { Frame } from '../../src/shared/unitLooks';

// PLAN 7.34c2 (critic run 9, semantic zoom 7: "at 10 m/px ... tanks overlapping in piles"): in a
// block in contact the elements stand off their slots (`DEPLOY_SCATTER`), 0.012 to 0.015 cells
// from the nearest, where an element's tanks fill a slot's 0.03. Each vehicle element is drawn at
// its fit (`fitScales`): no vehicle's box on another's, of one element or of two.

const KM_PER_CELL = 40075 / SIZE_1938.w;
const PX_PER_CELL_AT_10M = (KM_PER_CELL * 1000) / 10;

interface Box {
  x: number;
  y: number;
  f: number;
  hl: number;
  hw: number;
  element: number;
}

/** Every vehicle of the elements as drawn at their fit: its box with its outline (`vehicleBox`). */
function boxesOf(e: FitElements, fit: Float32Array): Box[] {
  const out: Box[] = [];
  for (let i = 0; i < e.count; i++) {
    const frame = e.frame[i]!;
    const side = gridSide(frame, figureCount(e.size[i]!, e.size[i]!));
    const cells = figureCells(side) * fit[i]!;
    const off = figureOffsets(e.id[i]!, side, figureCount(e.size[i]!, e.size[i]!), e.facing[i]!);
    const box = vehicleBox(frame);
    const f = e.facing[i]!;
    const shift = ((box.front - box.back) / 2) * cells;
    for (let k = 0; k < off.length; k += 2) {
      out.push({ x: e.x[i]! + off[k]! * fit[i]! + Math.cos(f) * shift, y: e.y[i]! + off[k + 1]! * fit[i]! + Math.sin(f) * shift, f, hl: ((box.front + box.back) / 2) * cells, hw: box.half * cells, element: i });
    }
  }
  return out;
}

function corners(h: Box): [number, number][] {
  const [c, s] = [Math.cos(h.f), Math.sin(h.f)];
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => [h.x + c * a! * h.hl - s * b! * h.hw, h.y + s * a! * h.hl + c * b! * h.hw]);
}

/** Two boxes meet: no axis of either parts them. */
function meet(a: Box, b: Box): boolean {
  for (const f of [a.f, a.f + Math.PI / 2, b.f, b.f + Math.PI / 2]) {
    const [c, s] = [Math.cos(f), Math.sin(f)];
    const span = (h: Box): [number, number] => {
      const p = corners(h).map(([x, y]) => x * c + y * s);
      return [Math.min(...p), Math.max(...p)];
    };
    const [p, q] = [span(a), span(b)];
    if (p[1] <= q[0] + 1e-12 || q[1] <= p[0] + 1e-12) return false;
  }
  return true;
}

function overlapped(boxes: readonly Box[]): number {
  const hit = new Set<number>();
  for (let a = 0; a < boxes.length; a++)
    for (let b = a + 1; b < boxes.length; b++)
      if (Math.hypot(boxes[a]!.x - boxes[b]!.x, boxes[a]!.y - boxes[b]!.y) < 0.03 && meet(boxes[a]!, boxes[b]!)) {
        hit.add(a);
        hit.add(b);
      }
  return hit.size;
}

/** A small seeded random (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CLASSES = [[Frame.tank, 10], [Frame.tankMedium, 10], [Frame.tankHeavy, 12], [Frame.halftrack, 12]] as const;

/** A block of `cols` × `rows` elements on slots SLOT_GAP_CELLS apart, facing `facing`, each `scatter` of a slot off it at most. */
function block(seed: number, cols: number, rows: number, facing: number, scatter: number, classes: readonly (readonly [number, number])[] = CLASSES, x0 = 0, y0 = 0, firstId = 1) {
  const r = rng(seed);
  const e = { count: 0, id: [] as number[], frame: [] as number[], size: [] as number[], x: [] as number[], y: [] as number[], facing: [] as number[], prevX: [] as number[], prevY: [] as number[] };
  const [fx, fy] = [Math.cos(facing), Math.sin(facing)];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const [frame, size] = classes[Math.floor(r() * classes.length)]!;
      const a = (col - (cols - 1) / 2) * SLOT_GAP_CELLS + (r() * 2 - 1) * scatter * SLOT_GAP_CELLS;
      const l = (-row) * SLOT_GAP_CELLS + (r() * 2 - 1) * scatter * SLOT_GAP_CELLS;
      e.id.push(firstId + e.count);
      e.frame.push(frame);
      e.size.push(size);
      e.x.push(x0 + fx * l - fy * a);
      e.y.push(y0 + fy * l + fx * a);
      e.prevX.push(x0 + fx * l - fy * a);
      e.prevY.push(y0 + fy * l + fx * a);
      e.facing.push(facing);
      e.count++;
    }
  return e;
}

describe('vehicles fitted to their neighbours (PLAN 7.34c2)', () => {
  it('a block at rest keeps its full figures, and none of its vehicles meet', () => {
    for (const facing of [0, 0.7, Math.PI / 2, 2.5]) {
      const e = block(3, 6, 4, facing, 0);
      const fit = fitScales(e);
      expect([...fit].every((s) => s === 1)).toBe(true);
      expect(overlapped(boxesOf(e, fit))).toBe(0);
    }
  });

  it('a block in contact (DEPLOY_SCATTER): no vehicle on another, of one element or two; before the fit they met', () => {
    let least = Infinity;
    let before = 0;
    let after = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const e = block(seed, 6, 4, seed * 0.53, DEPLOY_SCATTER);
      const fit = fitScales(e);
      before += overlapped(boxesOf(e, new Float32Array(e.count).fill(1)));
      after += overlapped(boxesOf(e, fit));
      for (let i = 0; i < e.count; i++) least = Math.min(least, figureCells(gridSide(e.frame[i]!, figureCount(e.size[i]!, e.size[i]!))) * fit[i]! * PX_PER_CELL_AT_10M);
    }
    process.stderr.write(`12 blocks in contact of 24 elements: vehicles on another ${before} unfitted, ${after} fitted; the least figure ${least.toFixed(1)} px at 10 m/px\n`);
    expect(before).toBeGreaterThan(0);
    expect(after).toBe(0);
    // A light hull is 14 px at full figure: fitted, a figure is still a tank, not a speck.
    expect(least).toBeGreaterThan(4);
  });

  it('two formations face to face, each turned its own way: none meet', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const a = block(seed, 5, 3, 0.3, DEPLOY_SCATTER);
      const b = block(seed + 100, 5, 3, 0.3 + Math.PI + 0.4, DEPLOY_SCATTER, CLASSES, 0.07, 0.02, 1000);
      const e = {
        count: a.count + b.count,
        id: [...a.id, ...b.id],
        frame: [...a.frame, ...b.frame],
        size: [...a.size, ...b.size],
        x: [...a.x, ...b.x],
        y: [...a.y, ...b.y],
        facing: [...a.facing, ...b.facing],
      };
      expect(overlapped(boxesOf(e, fitScales(e)))).toBe(0);
    }
  });

  it('between the place before and the place now: the fit holds for both', () => {
    const e = block(5, 6, 4, 1.1, DEPLOY_SCATTER);
    // Now: each element moved in toward the block's middle by up to a third of a slot.
    const now = { ...e, x: e.x.map((x) => x * 0.7), y: e.y.map((y) => y * 0.7) };
    const fit = fitScales(now);
    expect(overlapped(boxesOf(now, fit))).toBe(0);
    expect(overlapped(boxesOf({ ...now, x: e.prevX, y: e.prevY }, fit))).toBe(0);
  });

  it('what is not a vehicle is drawn as it was: infantry, guns, a lone vehicle', () => {
    const e = block(7, 4, 3, 0, DEPLOY_SCATTER, [[Frame.infantry, 500], [Frame.gun, 12]]);
    expect([...fitScales(e)].every((s) => s === 1)).toBe(true);
    const one = block(7, 1, 1, 0, 0);
    expect(fitScales(one)[0]).toBe(1);
  });

  it('a fit is a whole number of 32ths: a figure does not change by a hair between snapshots', () => {
    const e = block(9, 6, 4, 0.2, DEPLOY_SCATTER);
    for (const s of fitScales(e)) expect(Math.abs(s * 32 - Math.round(s * 32))).toBeLessThan(1e-6);
  });
});
