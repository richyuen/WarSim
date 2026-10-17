import { describe, expect, it } from 'vitest';
import { muzzleOf } from '../../src/render/units/atlas';
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

  it("a turret turned across the rank keeps its muzzle clear of the next tank's middle (more than 0.3 of a figure)", () => {
    for (const frame of [Frame.tank, Frame.tankMedium, Frame.tankHeavy]) {
      const whole = frame === Frame.tankHeavy ? 12 : 10;
      const side = gridSide(frame, whole);
      const cells = figureCells(side);
      const [mx] = muzzleOf(frame);
      for (const element of [1, 2, 3, 99, 1234]) {
        const off = figureOffsets(element, side, whole, 0);
        for (let k = 0; k < whole; k++) {
          for (const turn of [Math.PI / 2, -Math.PI / 2, Math.PI / 4, 0]) {
            const [x, y] = [off[k * 2]! + Math.cos(turn) * mx * cells, off[k * 2 + 1]! + Math.sin(turn) * mx * cells];
            for (let j = 0; j < whole; j++) if (j !== k) expect(Math.hypot(x - off[j * 2]!, y - off[j * 2 + 1]!) / cells, `frame ${frame} element ${element} tank ${k} → ${j}`).toBeGreaterThan(0.3);
          }
        }
      }
    }
  });

  it("on the ground of the element's slot (0.03 cells apart), apart from each other, the same every time", () => {
    for (const [frame, whole] of [[Frame.tank, 10], [Frame.tankMedium, 10], [Frame.tankHeavy, 12]] as const) {
      const side = gridSide(frame, whole);
      for (const element of [1, 77, 19_353]) {
        // Facing east, square to the axes: every tank's middle within half a slot on each.
        const off = figureOffsets(element, side, whole, 0);
        for (let k = 0; k < whole; k++) {
          expect(Math.abs(off[k * 2]!)).toBeLessThan(0.015);
          expect(Math.abs(off[k * 2 + 1]!)).toBeLessThan(0.015);
        }
        let nearest = Infinity;
        for (let i = 0; i < whole; i++) for (let j = i + 1; j < whole; j++) nearest = Math.min(nearest, Math.hypot(off[i * 2]! - off[j * 2]!, off[i * 2 + 1]! - off[j * 2 + 1]!));
        // Never nearer than three quarters of a figure: no two hulls on one another.
        expect(nearest / figureCells(side)).toBeGreaterThan(0.75);
        expect(figureOffsets(element, side, whole, 0)).toEqual(off);
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
