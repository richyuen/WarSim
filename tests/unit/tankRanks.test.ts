import { describe, expect, it } from 'vitest';
import { hullBox, muzzleOf } from '../../src/render/units/atlas';
import { SLOT_GAP_CELLS } from '../../src/render/units/ships';
import { figureCells, figureOffsets, gridSide, TANK_CELLS } from '../../src/render/units/individuals';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Frame } from '../../src/shared/unitLooks';

// PLAN 7.9c (critic run 7, tanks 5: "at 10 m/px a tank is about 8 px ... in a loose grid with no
// formation or facing"): a tank element's figures were a shuffled 4 × 4 grid of a 0.024-cell
// footprint, a light hull 6.8 px at 10 m/px. They are now ranks of four across its facing, the front
// rank first, each tank TANK_CELLS.

const KM_PER_CELL = 40075 / SIZE_1938.w;
/** A light hull is 40 px of a 64-px frame. */
const HULL = 40 / 64;

const CLASSES = [[Frame.tank, 10], [Frame.tankMedium, 10], [Frame.tankHeavy, 12]] as const;
const FACINGS = [0, 0.7, Math.PI / 2, 2.5, -1.2];

/** A hull as drawn, its outline with it (`hullBox`): its middle, its facing, half its length and width, cells. */
interface Hull {
  x: number;
  y: number;
  f: number;
  hl: number;
  hw: number;
}

function hullsOf(frame: number, off: readonly number[], cells: number, facing: number): Hull[] {
  const box = hullBox(frame);
  // The box's middle is (front − back) / 2 of a figure along the facing from the turret ring.
  const shift = ((box.front - box.back) / 2) * cells;
  return Array.from({ length: off.length / 2 }, (_, k) => ({ x: off[k * 2]! + Math.cos(facing) * shift, y: off[k * 2 + 1]! + Math.sin(facing) * shift, f: facing, hl: ((box.front + box.back) / 2) * cells, hw: box.half * cells }));
}

function corners(h: Hull): [number, number][] {
  const [c, s] = [Math.cos(h.f), Math.sin(h.f)];
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => [h.x + c * a! * h.hl - s * b! * h.hw, h.y + s * a! * h.hl + c * b! * h.hw]);
}

function inside(h: Hull, x: number, y: number): boolean {
  const [c, s] = [Math.cos(h.f), Math.sin(h.f)];
  const [dx, dy] = [x - h.x, y - h.y];
  return Math.abs(dx * c + dy * s) < h.hl && Math.abs(-dx * s + dy * c) < h.hw;
}

/** Two boxes meet: no axis of either parts them. */
function meet(a: Hull, b: Hull): boolean {
  for (const f of [a.f, a.f + Math.PI / 2, b.f, b.f + Math.PI / 2]) {
    const [c, s] = [Math.cos(f), Math.sin(f)];
    const span = (h: Hull): [number, number] => {
      const p = corners(h).map(([x, y]) => x * c + y * s);
      return [Math.min(...p), Math.max(...p)];
    };
    const [p, q] = [span(a), span(b)];
    if (p[1] <= q[0] + 1e-12 || q[1] <= p[0] + 1e-12) return false;
  }
  return true;
}

describe('tanks at T3 in ranks (PLAN 7.9c)', () => {
  it('a light tank is at least 14 px long at 10 m/px', () => {
    const pxPerCell = (KM_PER_CELL * 1000) / 10;
    const px = figureCells(gridSide(Frame.tank, 10)) * pxPerCell * HULL;
    process.stderr.write(`a light hull at 10 m/px: ${px.toFixed(1)} px (TANK_CELLS ${TANK_CELLS})\n`);
    expect(px).toBeGreaterThanOrEqual(14);
  });

  it('ten tanks are ranks of four across the facing (4, 4, 2), the front rank toward it', () => {
    for (const facing of [0, 0.7, Math.PI / 2, 2.5, -1.2]) {
      const side = gridSide(Frame.tankMedium, 10);
      const off = figureOffsets(17, side, 10, facing);
      const [fx, fy] = [Math.cos(facing), Math.sin(facing)];
      // Along the facing and across it.
      const along = Array.from({ length: 10 }, (_, k) => off[k * 2]! * fx + off[k * 2 + 1]! * fy);
      const across = Array.from({ length: 10 }, (_, k) => -off[k * 2]! * fy + off[k * 2 + 1]! * fx);
      const ranks = [along.slice(0, 4), along.slice(4, 8), along.slice(8)];
      // Every tank of a rank ahead of every tank of the rank behind it.
      expect(Math.min(...ranks[0]!)).toBeGreaterThan(Math.max(...ranks[1]!));
      expect(Math.min(...ranks[1]!)).toBeGreaterThan(Math.max(...ranks[2]!));
      // A rank is a line across the facing: spread across far more than along.
      const spread = (l: number[]): number => Math.max(...l) - Math.min(...l);
      expect(spread(across.slice(0, 4))).toBeGreaterThan(3 * spread(ranks[0]!));
      // Left to right in order.
      for (let k = 1; k < 4; k++) expect(across[k]!).toBeGreaterThan(across[k - 1]!);
    }
  });

  // Since PLAN 7.34c1 (ADR-536; critic run 9: "tanks overlapping in piles") the two tests below
  // hold the hulls themselves, each the box it is drawn in with its outline (`hullBox`): no muzzle
  // on another hull, no hull on another, of the element or of its neighbours in a block at rest.
  // Until then they held proxies of that: a muzzle more than 0.3 of a figure from the next tank's
  // middle (a light hull's half-width with its outline is 0.23), and no two tanks nearer than 0.75
  // of a figure (a light tank's pitch is now 0.68: its hull with its outline is 0.47 wide).

  it("a turret turned any way keeps its muzzle off every other hull of the element", () => {
    for (const [frame, whole] of CLASSES) {
      const side = gridSide(frame, whole);
      const cells = figureCells(side);
      const [mx] = muzzleOf(frame);
      for (const facing of FACINGS) {
        const hulls = hullsOf(frame, figureOffsets(1, side, whole, facing), cells, facing);
        for (let k = 0; k < whole; k++) {
          for (let t = 0; t < 32; t++) {
            const turn = facing + (t * Math.PI) / 16;
            const x = hulls[k]!.x + Math.cos(turn) * mx * cells;
            const y = hulls[k]!.y + Math.sin(turn) * mx * cells;
            for (let j = 0; j < whole; j++) if (j !== k) expect(inside(hulls[j]!, x, y), `frame ${frame} facing ${facing} tank ${k} turned ${t}/32 on tank ${j}`).toBe(false);
          }
        }
      }
    }
  });

  it("an element's hulls on its slot's square (0.03 cells), none on another, the heavy hull the longest, the same every time", () => {
    const lengths: number[] = [];
    for (const [frame, whole] of CLASSES) {
      const side = gridSide(frame, whole);
      const cells = figureCells(side);
      for (const facing of FACINGS) {
        const off = figureOffsets(77, side, whole, facing);
        const hulls = hullsOf(frame, off, cells, facing);
        // In the block's frame (its front toward the facing), every corner of every hull within half a slot.
        for (const h of hulls) {
          for (const [cx, cy] of corners(h)) {
            const along = cx * Math.cos(facing) + cy * Math.sin(facing);
            const across = -cx * Math.sin(facing) + cy * Math.cos(facing);
            expect(Math.abs(along), `frame ${frame} facing ${facing}`).toBeLessThan(SLOT_GAP_CELLS / 2);
            expect(Math.abs(across), `frame ${frame} facing ${facing}`).toBeLessThan(SLOT_GAP_CELLS / 2);
          }
        }
        for (let i = 0; i < whole; i++) for (let j = i + 1; j < whole; j++) expect(meet(hulls[i]!, hulls[j]!), `frame ${frame} facing ${facing} tanks ${i}, ${j}`).toBe(false);
        expect(figureOffsets(77, side, whole, facing)).toEqual(off);
      }
      lengths.push((hullBox(frame).back + hullBox(frame).front) * cells);
    }
    expect(lengths[1]!).toBeGreaterThan(lengths[0]!);
    expect(lengths[2]!).toBeGreaterThan(lengths[1]!);
  });

  it('two elements of a block at rest, one slot apart across or along, any two classes: no hull on another', () => {
    for (const facing of FACINGS) {
      const [fx, fy] = [Math.cos(facing), Math.sin(facing)];
      for (const [a, wa] of CLASSES) {
        for (const [b, wb] of CLASSES) {
          const one = hullsOf(a, figureOffsets(5, gridSide(a, wa), wa, facing), figureCells(gridSide(a, wa)), facing);
          // The next slot to the right (−fy, fx) and the one ahead (fx, fy).
          for (const [dx, dy] of [[-fy * SLOT_GAP_CELLS, fx * SLOT_GAP_CELLS], [fx * SLOT_GAP_CELLS, fy * SLOT_GAP_CELLS]] as const) {
            const off = figureOffsets(6, gridSide(b, wb), wb, facing).map((v, k) => v + (k % 2 === 0 ? dx : dy));
            const two = hullsOf(b, off, figureCells(gridSide(b, wb)), facing);
            for (const h of one) for (const g of two) expect(meet(h, g), `frames ${a}, ${b} facing ${facing}`).toBe(false);
          }
        }
      }
    }
  });

  it('a loss takes the last tank; the others stand where they stood', () => {
    const side = gridSide(Frame.tank, 10);
    const all = figureOffsets(5, side, 10, 0.3);
    expect(figureOffsets(5, side, 6, 0.3)).toEqual(all.slice(0, 12));
  });

  it('heavy tanks four abreast in three ranks', () => {
    const side = gridSide(Frame.tankHeavy, 12);
    const off = figureOffsets(3, side, 12, 0);
    const along = Array.from({ length: 12 }, (_, k) => off[k * 2]!);
    expect(Math.min(...along.slice(0, 4))).toBeGreaterThan(Math.max(...along.slice(4, 8)));
    expect(Math.min(...along.slice(4, 8))).toBeGreaterThan(Math.max(...along.slice(8)));
  });
});
