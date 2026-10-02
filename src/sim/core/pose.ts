/**
 * Slotted element poses (SPEC §3.6, PLAN 1.11): where element `slot` of a formation stands
 * when not engaged, as a pure function of the formation's position and facing. The same code
 * runs in the sim (engagement start positions) and the snapshot builder (semantic zoom), so
 * every tier shows the same positions.
 *
 * Elements form a block `cols` wide (≈ 2:1 front to depth), front row first, centred on the
 * formation; the block is rotated so its front faces `facing` (radians, x east, y south).
 */
import { cos, sin, sqrt } from './dmath';

export function slotGrid(count: number): { cols: number; rows: number } {
  const cols = Math.max(1, Math.ceil(sqrt(count * 2)));
  return { cols, rows: Math.max(1, Math.ceil(count / cols)) };
}

/** World position (cells) of `slot` in a formation of `count` elements spaced `spacing` cells. */
export function slotPose(cx: number, cy: number, facing: number, slot: number, count: number, spacing: number): [number, number] {
  const { cols, rows } = slotGrid(count);
  const r = Math.floor(slot / cols);
  const k = slot - r * cols;
  const across = (k - (cols - 1) / 2) * spacing;
  const along = ((rows - 1) / 2 - r) * spacing; // front row ahead of the centre
  const fx = cos(facing);
  const fy = sin(facing);
  // Forward (fx, fy); right-hand side (-fy, fx).
  return [cx + fx * along - fy * across, cy + fy * along + fx * across];
}
