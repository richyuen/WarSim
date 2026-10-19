/**
 * A ship's length at T3 (PLAN 4.7b): one figure is one ship, drawn its own length, not the side
 * of a battalion's grid (a battleship was a speck the size of a rifleman's place). The atlas
 * draws each class's hull its length of the frame (a battleship from bow to stern, a destroyer
 * three quarters of it): the sprite's side is the frame's, so the battleship's length is it.
 *
 * Further out than its length reads (PLAN 4.12c, the critic's R5-B4: at 20 m/px a carrier group
 * was seven small pills, a destroyer 7.5 px), a ship is drawn at least SHIP_MIN_PX long for a
 * battleship and in proportion for the others: about twice its length at 20 m/px.
 *
 * Closer in, that least length grows with the room between two ships (PLAN 7.22b, the critic's
 * run 8: "at 1× a ship is about 20 to 30 px long at 15 m/px"): SHIP_SLOT_SHARE of a slot's gap on
 * the screen, up to SHIP_ROOM_MAX_PX for a battleship (35 px at 15 m/px, 40 from 13 m/px in), so
 * that its class and turrets read at 1× while the ships of a fleet still stand apart. A ship is its
 * own length from 6.25 m/px in: about twice it from 20 to 13 m/px, as at 20 m/px before. A
 * rifleman is drawn tens of times his size at T3 (`FIGURE_MIN_PX`) (ADR-499).
 *
 * The smaller classes are not drawn in proportion to their length at that least size (PLAN 7.35c,
 * the critic's run 9: "at 20 m/px destroyers are about 10 × 3 px and submarines about 5 px"): each
 * is at least its class's share of the battleship's (`MIN_SHARE`), so that a destroyer's hull is
 * about 19 px and a submarine's 15 at 20 m/px, the classes in their order (ADR-548). Closer in,
 * where a ship is drawn its own length, the proportions are true again.
 */
import { ATLAS_FRAMES } from './atlas';
import { Frame } from '../../shared/unitLooks';

/** Metres from bow to stern, by frame, of the sprite's side: the battleship's whole. */
const SIDE_M: Record<number, number> = {
  [Frame.battleship]: 250,
  [Frame.carrier]: 260,
  [Frame.ship]: 200,
  [Frame.destroyer]: 150,
  [Frame.submarine]: 95,
  [Frame.transport]: 170,
};

/**
 * A ship's least size as a share of a battleship's, by frame, where that is more than its length
 * makes it (ADR-548): the hulls a destroyer's and a submarine's frames draw are shorter and narrower
 * than the others', and in proportion they were specks.
 */
const MIN_SHARE: Record<number, number> = {
  [Frame.ship]: 0.88,
  [Frame.transport]: 0.85,
  [Frame.destroyer]: 0.8,
  [Frame.submarine]: 0.65,
};

/** A ship of `frame`'s least size as a share of a battleship's: its length's share, or its class's (`MIN_SHARE`) where that is more; 0 for what is no ship. */
export function shipMinShare(frame: number): number {
  const m = SIDE_M[frame];
  return m === undefined ? 0 : Math.max(m / SIDE_M[Frame.battleship]!, MIN_SHARE[frame] ?? 0);
}

/** The side of the sprite of a ship of `frame` at T3, in cells of `kmPerCell`, or 0 for what is no ship. */
export function shipSideCells(frame: number, kmPerCell: number): number {
  const m = SIDE_M[frame];
  return m === undefined ? 0 : m / (1000 * kmPerCell);
}

/**
 * A battleship's least length on the screen, CSS px (before the unit size): under the 29 px
 * between two slots of a block at 20 m/px (`SLOT_SPACING`), so that the ships of a fleet stand
 * apart.
 */
export const SHIP_MIN_PX = 26;

/** The gap between two slots of a block, cells of the default map size: `SLOT_SPACING` of `sim/core/pose` (held equal by a unit test; the render does not import the sim). */
export const SLOT_GAP_CELLS = 0.03;

/** A battleship's least length grows to this share of the gap between two slots on the screen… */
export const SHIP_SLOT_SHARE = 0.9;
/** …up to this many CSS px. */
export const SHIP_ROOM_MAX_PX = 40;

/** A battleship's least length on the screen, CSS px, where two slots are `slotPx` CSS px apart. */
export function battleshipMinPx(slotPx: number): number {
  return Math.max(SHIP_MIN_PX, Math.min(SHIP_ROOM_MAX_PX, SHIP_SLOT_SHARE * slotPx));
}

/** The least size of each frame's sprite, CSS px, where two slots are `slotPx` CSS px apart: a ship's, its share of a battleship's (`shipMinShare`); 0 for the rest (`ProxyRenderer.draw`). */
export function shipFrameMinPx(slotPx: number): number[] {
  const bb = battleshipMinPx(slotPx);
  return Array.from({ length: ATLAS_FRAMES }, (_, f) => bb * shipMinShare(f));
}

/** The same where there is no room to spare: SHIP_MIN_PX for a battleship. */
export const SHIP_FRAME_MIN_PX: readonly number[] = shipFrameMinPx(0);
