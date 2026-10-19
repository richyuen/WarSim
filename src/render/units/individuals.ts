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
import { Frame, shownFrame, turretOf } from '../../shared/unitLooks';
import { sizeScale } from '../sizeScale';
import { hullBox, muzzleOf, vehicleBox } from './atlas';
import { SLOT_GAP_CELLS } from './ships';

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
 * The same in the 4 × 4 grid of vehicles and guns (PLAN 7.34c2): a half-track is 0.76 of its
 * sub-slot long, and two a sub-slot apart, each 0.18 of it off toward the other, met. At 0.1 two
 * stand 0.8 of a sub-slot apart at the least.
 */
const GRID4_JITTER = 0.1;
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
  const tank = TANK_FRAMES.indexOf(frame as (typeof TANK_FRAMES)[number]);
  if (whole <= TANK_ABREAST * TANK_RANKS && tank >= 0) return TANK_ROWS + TANK_CLASS * tank + TANK_ABREAST;
  return frame === Frame.infantry || whole > 16 ? 8 : 4;
}

/**
 * The grid an element's figures are drawn in: `gridSide`, and for infantry in contact its firing
 * line (`LINE_ROWS`, PLAN 7.21a). What the figures, their shots and their fallen stand on.
 */
export function shownSide(frame: number, whole: number, inContact: boolean): number {
  if (inContact && frame === Frame.infantry) return LINE_ROWS + LINE_ABREAST;
  return gridSide(frame, whole);
}

/**
 * Infantry in contact (PLAN 7.21a, critic run 8: "at 10 m/px infantry are shapeless clumps of
 * figures"): the men lie in LINE_RANKS ranks across the front of the footprint, LINE_ABREAST in a
 * rank, the front rank first, each rank a quarter of a place off the one before (so the men of the
 * rank behind show between those in front), each man a little off his place. A figure is
 * LINE_CELLS: a prone soldier is long and narrow (`atlas`: 0.3 of his length across), and 16 of
 * them abreast fill the footprint's width. A loss takes a man of the rear rank. Its grid side is
 * LINE_ROWS + LINE_ABREAST (`shownSide`), which `figureCells` and `figureOffsets` read.
 *
 * Until PLAN 7.21a (PLAN 2.14c2) the men lay in the parade grid's 8 × 8 places, closed up into the
 * front half of the footprint, a third to half a place off them in a shuffled order, each 0.0028
 * cells (5 px at 10 m/px).
 */
export const LINE_ROWS = 200;
/** A prone man's side, cells (the size setting × this): 9 px at 10 m/px. */
export const LINE_CELLS = 0.0045;
export const LINE_ABREAST = 16;
export const LINE_RANKS = 4;
/** How far apart two ranks are, of LINE_CELLS; how far a man lies off his place across and along, of the pitch. */
const LINE_RANK_PITCH = 1.05;
const LINE_JITTER_ACROSS = 0.1;
const LINE_JITTER_ALONG = 0.08;

/**
 * Tanks at T3 (PLAN 7.9c, critic run 7: "at 10 m/px a tank is about 8 px ... in a loose grid with
 * no formation or facing"): an element of tanks is ranks across its facing, the front rank first,
 * TANK_ABREAST in a rank, the ranks TANK_RANKS. A light tank's figure is TANK_CELLS: its hull 14 px
 * at 10 m/px (a figure of the 4 × 4 grid was 6.8).
 *
 * Laid out so that a block at rest has no hull on another (PLAN 7.34c1, ADR-536; critic run 9:
 * "tanks overlapping in piles"): two tanks of a rank stand the turret's reach and half a hull
 * (`hullBox`, its outline with it) apart, and TURRET_CLEAR more, so a turret turned across keeps
 * its muzzle off the next hull; two ranks likewise along, and never nearer than a hull's length.
 * An element's hulls then fit its slot's square (`SLOT_GAP_CELLS`, FIT of it): the light tank at
 * its full figure, the medium and the heavy by a scale of their class (`TankLayout.scale`), the
 * heavy hull still the longest. No tank stands off its place: a rank is a straight line.
 * Until then the pitch was 0.82 and 0.95 of a figure for all three classes, each tank 0.04 of it
 * off its place, and a rank of four 0.0337 cells across, wider than its slot.
 *
 * The class is in the grid side (`gridSide`): TANK_ROWS + TANK_CLASS × class + abreast, which
 * `figureCells` and `figureOffsets` read, and with them the shots and wrecks drawn on a figure.
 */
export const TANK_ROWS = 100;
/** A light tank figure's side, cells (the size setting × this). */
export const TANK_CELLS = 0.0115;
/** Tanks in a rank, and ranks: an element of up to 12 (ten of light or medium tanks, twelve heavy). */
const TANK_ABREAST = 4;
const TANK_RANKS = 3;
/** The tank classes, in the order of their grid sides. */
const TANK_FRAMES = [Frame.tank, Frame.tankMedium, Frame.tankHeavy] as const;
const TANK_CLASS = 10;
/** How far a turret's muzzle stays off the next hull, of a figure. */
const TURRET_CLEAR = 0.04;
/** The share of half a slot an element's hulls reach to at most: room between two elements. */
const FIT = 0.97;

/** The ranks of a tank class: the pitch across and along, of a figure, and its figure's scale of TANK_CELLS. */
export interface TankLayout {
  across: number;
  along: number;
  scale: number;
}

function tankLayout(frame: number): TankLayout {
  const box = hullBox(frame);
  const [reach] = muzzleOf(frame);
  const across = reach + box.half + TURRET_CLEAR;
  const along = Math.max(reach + box.front, box.back + box.front) + TURRET_CLEAR;
  const halfAcross = ((TANK_ABREAST - 1) / 2) * across + box.half;
  const halfAlong = ((TANK_RANKS - 1) / 2) * along + box.back;
  const scale = Math.min(1, (FIT * SLOT_GAP_CELLS) / 2 / (TANK_CELLS * Math.max(halfAcross, halfAlong)));
  return { across, along, scale };
}

const TANK_LAYOUTS = TANK_FRAMES.map(tankLayout);

/** The ranks of the tank class of a grid side (`abreastOf` > 0). */
export function tankLayoutOf(side: number): TankLayout {
  return TANK_LAYOUTS[Math.floor((side - TANK_ROWS) / TANK_CLASS)]!;
}

/** Whether a grid side is a tank element's ranks (`gridSide`), and how many abreast. */
export function abreastOf(side: number): number {
  return side > TANK_ROWS && side < LINE_ROWS ? (side - TANK_ROWS) % TANK_CLASS : 0;
}

/** Whether a grid side is a firing line of infantry (`shownSide`). */
export function isLine(side: number): boolean {
  return side > LINE_ROWS;
}

/** Side of one figure in a grid of `side`, cells. */
export function figureCells(side: number): number {
  if (isLine(side)) return LINE_CELLS * sizeScale;
  if (abreastOf(side) > 0) return TANK_CELLS * tankLayoutOf(side).scale * sizeScale;
  return ((FOOTPRINT_CELLS * sizeScale) / side) * FILL;
}

/** The order in which the figures of `element` take the sub-slots of a grid of `side`: a shuffle by its id. */
export function subSlotOrder(element: number, side: number): number[] {
  const n = side * side;
  const keys = Array.from({ length: n }, (_, k) => hash2(element, k));
  return Array.from({ length: n }, (_, k) => k).sort((a, b) => keys[a]! - keys[b]! || a - b);
}

/**
 * Where the `count` figures of `element` stand in its grid of `side` (`shownSide`), as offsets in
 * cells from its slot pose: [dx0, dy0, dx1, dy1, …], x east and y south, the block's front
 * toward `facing` (radians).
 */
export function figureOffsets(element: number, side: number, count: number, facing: number): number[] {
  if (isLine(side)) return lineOffsets(element, count, facing);
  const abreast = abreastOf(side);
  if (abreast > 0) return rankOffsets(tankLayoutOf(side), figureCells(side), abreast, count, facing);
  const pitch = (FOOTPRINT_CELLS * sizeScale) / side;
  const order = subSlotOrder(element, side);
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  const out: number[] = [];
  for (let k = 0; k < count; k++) {
    const slot = order[k]!;
    const row = Math.floor(slot / side);
    const col = slot - row * side;
    const [jx, jy] = pair(hash2(element, 4096 + slot));
    const jitter = side === 4 ? GRID4_JITTER : JITTER;
    const across = (col - (side - 1) / 2 + jx * jitter) * pitch;
    const along = ((side - 1) / 2 - row + jy * jitter) * pitch; // front row ahead of the centre
    // Forward (fx, fy); right-hand side (−fy, fx): as the slots of the formation's block.
    out.push(fx * along - fy * across, fy * along + fx * across);
  }
  return out;
}

/**
 * The firing line of an element of infantry in contact (PLAN 7.21a): its ranks across `facing`,
 * the front rank's men at the front of the footprint. Rank r is filled by the figures 16r to
 * 16r + 15, at the places of a shuffle of its own by the element's id, so the losses of the rear
 * rank are gaps here and there along it.
 */
function lineOffsets(element: number, count: number, facing: number): number[] {
  const foot = FOOTPRINT_CELLS * sizeScale;
  const man = LINE_CELLS * sizeScale;
  const across = foot / LINE_ABREAST;
  const along = man * LINE_RANK_PITCH;
  const front = foot / 2 - man / 2;
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  const out: number[] = [];
  let order: number[] = [];
  for (let k = 0; k < Math.min(count, LINE_ABREAST * LINE_RANKS); k++) {
    const rank = Math.floor(k / LINE_ABREAST);
    if (k % LINE_ABREAST === 0) {
      const keys = Array.from({ length: LINE_ABREAST }, (_, c) => hash2(element, 16384 + rank * LINE_ABREAST + c));
      order = Array.from({ length: LINE_ABREAST }, (_, c) => c).sort((a, b) => keys[a]! - keys[b]! || a - b);
    }
    const col = order[k % LINE_ABREAST]!;
    const [jx, jy] = pair(hash2(element, 12288 + k));
    const a = (col - (LINE_ABREAST - 1) / 2 + (rank % 2 === 0 ? -0.25 : 0.25) + jx * LINE_JITTER_ACROSS) * across;
    const l = front - rank * along + jy * LINE_JITTER_ALONG * along;
    out.push(fx * l - fy * a, fy * l + fx * a);
  }
  return out;
}

/**
 * The ranks of an element of tanks (PLAN 7.9c, 7.34c1): `abreast` in a rank across `facing`, the
 * front rank first, at the pitch of their class's `layout`, a figure `cells` wide. The ranks are
 * the layout's (TANK_RANKS), not the tanks left's, about the slot pose as the grid is; a loss takes
 * the last tank, the others stand where they stood.
 */
function rankOffsets(layout: TankLayout, cells: number, abreast: number, count: number, facing: number): number[] {
  const across = cells * layout.across;
  const along = cells * layout.along;
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  const out: number[] = [];
  for (let k = 0; k < count; k++) {
    const rank = Math.floor(k / abreast);
    const col = k - rank * abreast;
    const a = (col - (abreast - 1) / 2) * across;
    const l = ((TANK_RANKS - 1) / 2 - rank) * along;
    out.push(fx * l - fy * a, fy * l + fx * a);
  }
  return out;
}

/**
 * Vehicles fitted to the room their neighbours leave (PLAN 7.34c2, ADR-540; critic run 9: "at
 * 10 m/px ... tanks overlapping in piles"). A block in contact stands off its slots
 * (`DEPLOY_SCATTER`): two elements 0.012 to 0.015 cells apart, where an element's tanks fill a
 * slot's 0.03 (PLAN 7.34c1). An element of vehicles (tanks, half-tracks: `isVehicleFrame`) is drawn
 * at a scale of its layout, figures and places alike: the least, over the vehicles near it, of
 * the bound the two keep together. Their drawn boxes (`vehicleBox`, about every figure of the
 * whole element) are kept apart along an axis that parts them: the centre line, or a side of
 * either's box; the bound is FIT of the room along the best of these. The bound of the place
 * before and of the place now, the least of the two (the figures glide between them), stepped
 * down to FIT_STEPS so a figure does not change its size by a hair from one snapshot to the
 * next. A block at rest keeps its full figures: there the bound is 1 or more.
 */
export interface FitElements {
  count: number;
  id: ArrayLike<number>;
  frame: ArrayLike<number>;
  size: ArrayLike<number>;
  x: ArrayLike<number>;
  y: ArrayLike<number>;
  facing: ArrayLike<number>;
  prevX?: ArrayLike<number>;
  prevY?: ArrayLike<number>;
}

/** Steps of a vehicle's fit (`fitScales`): its scale is a whole number of 1/FIT_STEPS, rounded down. */
const FIT_STEPS = 32;

/** Whether a figure of `frame` is a vehicle that T3 fits to its neighbours (`fitScales`): a tank, a half-track. */
export function isVehicleFrame(frame: number): boolean {
  return turretOf(frame) >= 0 || frame === Frame.halftrack;
}

/**
 * The drawn box about the whole element at full figure and facing 0: half its reach along the
 * facing (the larger of before and behind) and across it, cells.
 */
export function vehicleReach(element: number, frame: number, size: number): [along: number, across: number] {
  const side = gridSide(frame, figureCount(size, size));
  const cells = figureCells(side);
  const box = vehicleBox(frame);
  const off = figureOffsets(element, side, figureCount(size, size), 0);
  let along = 0;
  let across = 0;
  for (let k = 0; k < off.length; k += 2) {
    along = Math.max(along, off[k]! + box.front * cells, -(off[k]! - box.back * cells));
    across = Math.max(across, Math.abs(off[k + 1]!) + box.half * cells);
  }
  return [along, across];
}

/** How far the box of half-reaches (`along`, `across`) at `facing` reaches along the unit (ux, uy). */
function supportOf(along: number, across: number, facing: number, ux: number, uy: number): number {
  const c = Math.cos(facing);
  const s = Math.sin(facing);
  return along * Math.abs(ux * c + uy * s) + across * Math.abs(-ux * s + uy * c);
}

/** The scale two boxes keep together at (dx, dy) apart so that one axis parts them with FIT of the room on it (at most 1). */
function pairBound(dx: number, dy: number, a: readonly number[], fa: number, b: readonly number[], fb: number): number {
  const d = Math.hypot(dx, dy);
  if (d === 0) return 0;
  let best = 0;
  const axes = [dx / d, dy / d, Math.cos(fa), Math.sin(fa), -Math.sin(fa), Math.cos(fa), Math.cos(fb), Math.sin(fb), -Math.sin(fb), Math.cos(fb)];
  for (let k = 0; k < axes.length; k += 2) {
    const ux = axes[k]!;
    const uy = axes[k + 1]!;
    const reach = supportOf(a[0]!, a[1]!, fa, ux, uy) + supportOf(b[0]!, b[1]!, fb, ux, uy);
    best = Math.max(best, (FIT * Math.abs(dx * ux + dy * uy)) / reach);
    if (best >= 1) return 1;
  }
  return best;
}

/**
 * Each element's fit (PLAN 7.34c2): 1 for what is not a vehicle and for a vehicle with room, less
 * for one whose neighbours stand nearer than its layout reaches. Pure in the elements given.
 */
export function fitScales(e: FitElements): Float32Array {
  const out = new Float32Array(e.count).fill(1);
  const reach: number[][] = [];
  const vehicles: number[] = [];
  let far = 0;
  for (let i = 0; i < e.count; i++) {
    if (!isVehicleFrame(e.frame[i]!)) continue;
    const r = vehicleReach(e.id[i]!, e.frame[i]!, e.size[i]!);
    reach[i] = r;
    vehicles.push(i);
    far = Math.max(far, Math.hypot(r[0], r[1]));
  }
  if (vehicles.length < 2) return out;
  // Two boxes further apart than both reaches in any direction have room: a grid of that cell.
  const cell = 2 * far;
  const grid = new Map<string, number[]>();
  const key = (gx: number, gy: number): string => `${gx},${gy}`;
  for (const i of vehicles) {
    const k = key(Math.floor(e.x[i]! / cell), Math.floor(e.y[i]! / cell));
    const list = grid.get(k);
    if (list) list.push(i);
    else grid.set(k, [i]);
  }
  for (const i of vehicles) {
    const gx = Math.floor(e.x[i]! / cell);
    const gy = Math.floor(e.y[i]! / cell);
    for (let ox = -1; ox <= 1; ox++)
      for (let oy = -1; oy <= 1; oy++)
        for (const j of grid.get(key(gx + ox, gy + oy)) ?? []) {
          if (j <= i) continue;
          let b = pairBound(e.x[j]! - e.x[i]!, e.y[j]! - e.y[i]!, reach[i]!, e.facing[i]!, reach[j]!, e.facing[j]!);
          if (e.prevX && e.prevY) b = Math.min(b, pairBound(e.prevX[j]! - e.prevX[i]!, e.prevY[j]! - e.prevY[i]!, reach[i]!, e.facing[i]!, reach[j]!, e.facing[j]!));
          out[i] = Math.min(out[i]!, b);
          out[j] = Math.min(out[j]!, b);
        }
  }
  for (const i of vehicles) if (out[i]! < 1) out[i] = Math.floor(out[i]! * FIT_STEPS) / FIT_STEPS;
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
  /** Its element's fit (`fitScales`): its figure is `figureCells(side)` × this. None: 1. */
  fit?: number;
}

/**
 * Which figure of `element` fires its volley of `tick`, and where it stands: one of those the
 * element has now, by the element and the tick, so the same in every frame and after a reload,
 * and another for the next volley. Null for an element without a figure. `fit` is the element's
 * (`fitScales`): its figures' places and sizes are scaled by it.
 */
export function firingFigure(element: number, tick: number, frame: number, strength: number, size: number, facing: number, inContact: boolean, fit = 1): FiringFigure | null {
  const n = figureCount(strength, size);
  if (n === 0) return null;
  const side = shownSide(frame, figureCount(size, size), inContact);
  const off = figureOffsets(element, side, n, facing);
  const k = hash2(hash2(element, tick), 0x6d7a) % n;
  const f: FiringFigure = { dx: off[k * 2]! * fit, dy: off[k * 2 + 1]! * fit, frame: shownFrame(frame, inContact), side, facing };
  if (fit !== 1) f.fit = fit;
  return f;
}
