/**
 * T3: an element as its individuals (SPEC §8, PLAN 2.6 and 2.10b, ADR-69 and ADR-80).
 *
 * Count: where an element has up to MAX_FIGURES units when whole, one figure for each unit it
 * has: guns (12 to an element), tanks (10), planes and ships are exact. A battalion of 500 has
 * MAX_FIGURES figures when whole and its share of them while it loses men, rounded up: at 150
 * men, 20 figures. So its losses show from the first figure's worth on, and an element with
 * men has a figure.
 *
 * Place: the footprint is a square of FOOTPRINT_CELLS around the element's slot pose, turned
 * with the formation, and divided into sub-slots: 8 × 8 for men and for anything that has more
 * than 16 figures when whole, 4 × 4 for vehicles and guns. The grid is the whole element's: it
 * does not change as the element loses. An element's figures take the sub-slots in an order of
 * its own (a shuffle by its id), each standing a little off the centre of its sub-slot. A loss
 * takes the last figure of that order away; the others stand where they stood.
 *
 * Pure functions of the element's id, frame, strength, size and facing: the same picture on
 * every frame and after a reload. Nothing here is sim state.
 */
import { hash2, pair } from '../hash';
import { Frame } from '../../shared/unitLooks';

/** m/px up to which T3 is the unit layer (`tierOf`); the handover from the T2 sprites is at this zoom. */
export const T3_MAX_M = 30;
export const MAX_FIGURES = 64;
/** Side of an element's footprint, cells. Slots are 0.03 apart (`sim/core/pose`), so elements stay apart. */
export const FOOTPRINT_CELLS = 0.024;
/** How far a figure stands from the centre of its sub-slot, as a share of the sub-slot's side. */
const JITTER = 0.18;
/** A figure fills this share of its sub-slot. */
const FILL = 0.92;

/**
 * Figures shown for an element that has `strength` of the `size` units it has when whole.
 * Rounded up for a battalion: figure k stands while more than k − 1 figures' worth of men are
 * left, so the last stands for the last man, and all MAX_FIGURES only when less than one
 * figure's worth is lost.
 */
export function figureCount(strength: number, size: number): number {
  const units = Math.max(0, Math.floor(strength));
  if (size <= MAX_FIGURES) return Math.min(MAX_FIGURES, units);
  return Math.min(MAX_FIGURES, Math.ceil((units * MAX_FIGURES) / size));
}

/**
 * Sub-slots per side of the footprint for an element of atlas frame `frame` that has `whole`
 * figures when at full strength (`figureCount(size, size)`). By the whole element, not by what
 * is left of it: the figures of a mechanised battalion do not change their size and their
 * places when it is down to 16 of them.
 */
export function gridSide(frame: number, whole: number): number {
  return frame === Frame.infantry || whole > 16 ? 8 : 4;
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
 * Where the `count` figures of `element` stand in its grid of `side` (`gridSide`), as offsets in
 * cells from its slot pose: [dx0, dy0, dx1, dy1, …], x east and y south, the block's front
 * toward `facing` (radians).
 */
export function figureOffsets(element: number, side: number, count: number, facing: number): number[] {
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
