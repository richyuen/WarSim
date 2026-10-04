/**
 * The measure of "no popping" shared by fades1938.spec.ts (the unit tiers) and
 * labelFades1938.spec.ts (flags, city labels, nation names): PLAN 2.7b, ADR-71.
 *
 * The camera steps across a threshold once and stays; the frames of the change that follows are
 * drawn 16 ms apart, the layers under test alone on black; consecutive frames are compared pixel
 * by pixel, as luminance (Rec. 709, 0–255). While the camera moves every edge moves by pixels a
 * frame, which is motion, not popping: so the camera does not move.
 */

/**
 * The largest change of a pixel between two frames, of 255. A smooth fade over 250 ms moves an
 * opacity by at most 0.096 in a 16 ms frame (1.5 × the linear step), which is 25 for a white
 * figure on black; where the layer going out covers the same pixel its change adds. 48 is twice
 * the single step, with room for rounding. A layer that appears or goes in one frame changes a
 * pixel by its whole contrast: both specs also assert that a whole change is more than twice
 * this, so that the measure is known to see a pop.
 */
export const MAX_JUMP = 48;
