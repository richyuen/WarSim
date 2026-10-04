/**
 * T3: an element as its individuals (SPEC §8, PLAN 2.6, ADR-69).
 *
 * Count: one figure for each unit of strength, at most MAX_FIGURES. So guns (12 to an element)
 * and tanks (10) are exact, and a battalion of 500 shows 64 until fewer than 64 men are left.
 *
 * Place: the footprint is a square of FOOTPRINT_CELLS around the element's slot pose, turned
 * with the formation, and divided into sub-slots: 8 × 8 for men and for anything of more than
 * 16, 4 × 4 for vehicles and guns. An element's figures take the sub-slots in an order of its
 * own (a shuffle by its id), each standing a little off the centre of its sub-slot. A loss
 * takes the last figure of that order away; the others stand where they stood.
 *
 * Pure functions of the element's id, frame, strength and facing: the same picture on every
 * frame and after a reload. Nothing here is sim state.
 */
import { hash2, pair } from '../hash';
import { Frame } from './atlas';

export const MAX_FIGURES = 64;
/** Side of an element's footprint, cells. Slots are 0.03 apart (`sim/core/pose`), so elements stay apart. */
export const FOOTPRINT_CELLS = 0.024;
/** How far a figure stands from the centre of its sub-slot, as a share of the sub-slot's side. */
const JITTER = 0.18;
/** A figure fills this share of its sub-slot. */
const FILL = 0.92;

/** Figures shown for an element of `strength` units. */
export function figureCount(strength: number): number {
  return Math.max(0, Math.min(MAX_FIGURES, Math.floor(strength)));
}

/** Sub-slots per side of the footprint for `count` figures of atlas frame `frame`. */
export function gridSide(frame: number, count: number): number {
  return frame === Frame.infantry || count > 16 ? 8 : 4;
}

/** Side of one figure in a grid of `side`, cells. */
export function figureCells(side: number): number {
  return (FOOTPRINT_CELLS / side) * FILL;
}

/** The order in which the figures of `element` take the sub-slots of a grid of `side`: a shuffle by its id. */
export function subSlotOrder(element: number, side: number): number[] {
  const n = side * side;
  const keys = Array.from({ length: n }, (_, k) => hash2(element, k));
  return Array.from({ length: n }, (_, k) => k).sort((a, b) => keys[a]! - keys[b]! || a - b);
}

/**
 * Where the `count` figures of `element` stand, as offsets in cells from its slot pose:
 * [dx0, dy0, dx1, dy1, …], x east and y south, the block's front toward `facing` (radians).
 */
export function figureOffsets(element: number, frame: number, count: number, facing: number): number[] {
  const side = gridSide(frame, count);
  const pitch = FOOTPRINT_CELLS / side;
  const order = subSlotOrder(element, side);
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  const out: number[] = [];
  for (let k = 0; k < count; k++) {
    const slot = order[k]!;
    const row = Math.floor(slot / side);
    const col = slot - row * side;
    const [jx, jy] = pair(hash2(element, 4096 + slot));
    const across = (col - (side - 1) / 2 + jx * JITTER) * pitch;
    const along = ((side - 1) / 2 - row + jy * JITTER) * pitch; // front row ahead of the centre
    // Forward (fx, fy); right-hand side (−fy, fx): as the slots of the formation's block.
    out.push(fx * along - fy * across, fy * along + fx * across);
  }
  return out;
}
