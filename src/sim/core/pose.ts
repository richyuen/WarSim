/**
 * Slotted element poses (SPEC §3.6, PLAN 1.11): where element `slot` of a formation stands,
 * as a pure function of where its block stands and what it faces: the formation's own place
 * and facing, or, for one in contact, its deployment (`deployOf` in systems/elements.ts). The same code
 * runs in the sim (engagement start positions) and the snapshot builder (semantic zoom), so
 * every tier shows the same positions.
 *
 * Elements form a block `cols` wide (≈ 2:1 front to depth), front row first, centred on the
 * formation; the block is rotated so its front faces `facing` (radians, x east, y south).
 */
import { cos, sin, sqrt } from './dmath';

/** Element spacing within a formation's block, cells. */
export const SLOT_SPACING = 0.03;

export function slotGrid(count: number): { cols: number; rows: number } {
  const cols = Math.max(1, Math.ceil(sqrt(count * 2)));
  return { cols, rows: Math.max(1, Math.ceil(count / cols)) };
}

/**
 * How far from a formation's centre its block of `count` slots reaches, in cells: to the slot
 * in the far corner, and half a slot more for what stands on it.
 */
export function blockReach(count: number, spacing: number): number {
  const { cols, rows } = slotGrid(count);
  const across = ((cols - 1) / 2) * spacing;
  const along = ((rows - 1) / 2) * spacing;
  return sqrt(across * across + along * along) + spacing / 2;
}

/**
 * World position (cells) of `slot` in a formation of `count` elements spaced `spacing` cells;
 * `offAlong` and `offAcross` cells off the slot, forward and to the right (an element of a
 * deployed block, PLAN 3.11c4).
 */
export function slotPose(cx: number, cy: number, facing: number, slot: number, count: number, spacing: number, offAlong = 0, offAcross = 0): [number, number] {
  const { cols, rows } = slotGrid(count);
  const r = Math.floor(slot / cols);
  const k = slot - r * cols;
  const across = (k - (cols - 1) / 2) * spacing + offAcross;
  const along = ((rows - 1) / 2 - r) * spacing + offAlong; // front row ahead of the centre
  const fx = cos(facing);
  const fy = sin(facing);
  // Forward (fx, fy); right-hand side (-fy, fx).
  return [cx + fx * along - fy * across, cy + fy * along + fx * across];
}
