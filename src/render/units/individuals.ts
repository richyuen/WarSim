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
import { Frame, shownFrame } from '../../shared/unitLooks';
import { sizeScale } from '../sizeScale';

/** m/px up to which T3 is the unit layer (`tierOf`); the handover from the T2 sprites is at this zoom. */
export const T3_MAX_M = 30;
export const MAX_FIGURES = 64;
/**
 * Side of an element's footprint, cells. Slots are 0.03 apart (`sim/core/pose`), so the elements
 * of a block at rest stay apart. In a deployed block an element stands up to 0.009 off its slot
 * (`DEPLOY_SCATTER`, PLAN 3.11c4), and the footprints of two neighbours may reach into each other.
 */
export const FOOTPRINT_CELLS = 0.024;
/** How far a figure stands from the centre of its sub-slot, as a share of the sub-slot's side. */
const JITTER = 0.18;
/**
 * Infantry in contact (PLAN 2.14c2): the share of the footprint's depth its ranks take, at the
 * front of it, and how far a man lies from his place in them (shares of the sub-slot's side;
 * along the facing it is of the closed-up rank's depth).
 */
export const LINE_DEPTH = 0.5;
const LINE_JITTER_ACROSS = 0.34;
const LINE_JITTER_ALONG = 0.45;
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
  if (whole <= TANK_ABREAST * TANK_RANKS && (frame === Frame.tank || frame === Frame.tankMedium || frame === Frame.tankHeavy)) return TANK_ROWS + TANK_ABREAST;
  return frame === Frame.infantry || whole > 16 ? 8 : 4;
}

/**
 * Tanks at T3 (PLAN 7.9c, critic run 7: "at 10 m/px a tank is about 8 px ... in a loose grid with
 * no formation or facing"): an element of tanks is ranks across its facing, the front rank first,
 * TANK_ABREAST in a rank, each tank TANK_CELLS: a light hull 14 px at 10 m/px (a figure of the 4 × 4
 * grid was 6.8). Its grid side is TANK_ROWS + TANK_ABREAST (`gridSide`), which `figureCells` and
 * `figureOffsets` read. Four, not five: a turret turned across the rank reaches 0.41 to 0.44 of a
 * figure (`muzzleOf`), and its muzzle must stay clear of the next tank's middle (more than 0.3 of a
 * figure: ABREAST_PITCH less its jitter, 0.75, less 0.44), four ranks of that pitch fill a slot (0.03).
 */
export const TANK_ROWS = 100;
/** A tank figure's side, cells (the size setting × this). */
export const TANK_CELLS = 0.0115;
/** Tanks in a rank, and ranks: an element of up to 12 (ten of light or medium tanks, twelve heavy). */
const TANK_ABREAST = 4;
const TANK_RANKS = 3;
/** How far apart two tanks of a rank are, and two ranks, of TANK_CELLS; how far a tank stands off its place, of the pitch. */
const ABREAST_PITCH = 0.82;
const RANK_PITCH = 0.95;
const TANK_JITTER = 0.04;

/** Whether a grid side is a tank element's ranks (`gridSide`), and how many abreast. */
export function abreastOf(side: number): number {
  return side > TANK_ROWS ? side - TANK_ROWS : 0;
}

/** Side of one figure in a grid of `side`, cells. */
export function figureCells(side: number): number {
  if (abreastOf(side) > 0) return TANK_CELLS * sizeScale;
  return ((FOOTPRINT_CELLS * sizeScale) / side) * FILL;
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
export function figureOffsets(element: number, side: number, count: number, facing: number, firingLine = false): number[] {
  const abreast = abreastOf(side);
  if (abreast > 0) return rankOffsets(element, abreast, count, facing);
  const pitch = (FOOTPRINT_CELLS * sizeScale) / side;
  const order = subSlotOrder(element, side);
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  const out: number[] = [];
  // In contact (PLAN 2.14c2) the men are not in their ranks: the ranks close up towards the
  // front of the footprint, LINE_DEPTH of its depth, and each man lies a good way off his
  // place in them. The same man in the same file: a loss takes the same figure away.
  const jitterAcross = firingLine ? LINE_JITTER_ACROSS : JITTER;
  const jitterAlong = firingLine ? LINE_JITTER_ALONG : JITTER;
  const depth = firingLine ? LINE_DEPTH : 1;
  const forward = firingLine ? ((1 - LINE_DEPTH) * FOOTPRINT_CELLS * sizeScale) / 2 : 0;
  for (let k = 0; k < count; k++) {
    const slot = order[k]!;
    const row = Math.floor(slot / side);
    const col = slot - row * side;
    const [jx, jy] = pair(hash2(element, 4096 + slot));
    const across = (col - (side - 1) / 2 + jx * jitterAcross) * pitch;
    const along = ((side - 1) / 2 - row + jy * jitterAlong) * pitch * depth + forward; // front row ahead of the centre
    // Forward (fx, fy); right-hand side (−fy, fx): as the slots of the formation's block.
    out.push(fx * along - fy * across, fy * along + fx * across);
  }
  return out;
}

/**
 * The ranks of an element of tanks (PLAN 7.9c): `abreast` in a rank across `facing`, the front
 * rank first, each tank a little off its place (TANK_JITTER of the pitch). The ranks are the
 * layout's (TANK_RANKS), not the tanks left's, about the slot pose as the grid is; a loss takes the
 * last tank, the others stand where they stood.
 */
function rankOffsets(element: number, abreast: number, count: number, facing: number): number[] {
  const across = TANK_CELLS * sizeScale * ABREAST_PITCH;
  const along = TANK_CELLS * sizeScale * RANK_PITCH;
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  const ranks = TANK_RANKS;
  const out: number[] = [];
  for (let k = 0; k < count; k++) {
    const rank = Math.floor(k / abreast);
    const col = k - rank * abreast;
    const [jx, jy] = pair(hash2(element, 8192 + k));
    const a = (col - (abreast - 1) / 2 + jx * TANK_JITTER) * across;
    const l = ((ranks - 1) / 2 - rank + jy * TANK_JITTER) * along;
    out.push(fx * l - fy * a, fy * l + fx * a);
  }
  return out;
}

/** The figure of an element that a shot leaves (PLAN 3.6c). */
export interface FiringFigure {
  /** Where it stands, cells from the element's slot pose. */
  dx: number;
  dy: number;
  /** The frame it is drawn with, the sub-slots per side of its grid, and its facing (radians). */
  frame: number;
  side: number;
  facing: number;
}

/**
 * Which figure of `element` fires its volley of `tick`, and where it stands: one of those the
 * element has now, by the element and the tick, so the same in every frame and after a reload,
 * and another for the next volley. Null for an element without a figure.
 */
export function firingFigure(element: number, tick: number, frame: number, strength: number, size: number, facing: number, inContact: boolean): FiringFigure | null {
  const n = figureCount(strength, size);
  if (n === 0) return null;
  const side = gridSide(frame, figureCount(size, size));
  const off = figureOffsets(element, side, n, facing, inContact && frame === Frame.infantry);
  const k = hash2(hash2(element, tick), 0x6d7a) % n;
  return { dx: off[k * 2]!, dy: off[k * 2 + 1]!, frame: shownFrame(frame, inContact), side, facing };
}
