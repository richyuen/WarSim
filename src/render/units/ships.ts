/**
 * A ship's length at T3 (PLAN 4.7b): one figure is one ship, drawn its own length, not the side
 * of a battalion's grid (a battleship was a speck the size of a rifleman's place). The atlas
 * draws each class's hull its length of the frame (a battleship from bow to stern, a destroyer
 * three quarters of it): the sprite's side is the frame's, so the battleship's length is it.
 *
 * Further out than its length reads (PLAN 4.12c, the critic's R5-B4: at 20 m/px a carrier group
 * was seven small pills, a destroyer 7.5 px), a ship is drawn at least SHIP_MIN_PX long for a
 * battleship and in proportion for the others: about twice its length at 20 m/px, its own from
 * 9.6 m/px in.
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

/** The least size of each frame's sprite, CSS px: a ship's, in proportion to its length; 0 for the rest (`ProxyRenderer.draw`). */
export const SHIP_FRAME_MIN_PX: readonly number[] = Array.from({ length: ATLAS_FRAMES }, (_, f) => (SIDE_M[f] === undefined ? 0 : (SHIP_MIN_PX * SIDE_M[f]!) / SIDE_M[Frame.battleship]!));
