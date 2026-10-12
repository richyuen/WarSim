/**
 * A ship's length at T3 (PLAN 4.7b): one figure is one ship, drawn its own length, not the side
 * of a battalion's grid (a battleship was a speck the size of a rifleman's place). The atlas
 * draws each class's hull its length of the frame (a battleship from bow to stern, a destroyer
 * three quarters of it): the sprite's side is the frame's, so the battleship's length is it.
 */
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
