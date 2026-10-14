import { describe, expect, it } from 'vitest';
import { ATLAS_FRAMES } from '../../src/render/units/atlas';
import { SHIP_FRAME_MIN_PX, SHIP_MIN_PX, shipSideCells } from '../../src/render/units/ships';
import { SLOT_SPACING } from '../../src/sim/core/pose';
import { Frame, isShipFrame } from '../../src/shared/unitLooks';

// PLAN 4.12c (the critic's R5-B4): at 20 m/px a carrier group was seven small pills. A ship is
// drawn at least SHIP_MIN_PX long for a battleship, the others in proportion to their length.

const KM_PER_CELL = 19.57;

describe('a ship\'s least length on the screen (PLAN 4.12c)', () => {
  it('a ship\'s frame has one, in proportion to its length, and no other frame has', () => {
    expect(SHIP_FRAME_MIN_PX.length).toBe(ATLAS_FRAMES);
    for (let f = 0; f < ATLAS_FRAMES; f++) {
      if (!isShipFrame(f)) {
        expect(SHIP_FRAME_MIN_PX[f], `frame ${f}`).toBe(0);
        continue;
      }
      expect(SHIP_FRAME_MIN_PX[f]! / SHIP_MIN_PX).toBeCloseTo(shipSideCells(f, KM_PER_CELL) / shipSideCells(Frame.battleship, KM_PER_CELL), 9);
    }
  });

  it('at 20 m/px a ship is drawn twice its length or more, and less than a slot apart from the next', () => {
    const pxPerCell = (KM_PER_CELL * 1000) / 20;
    for (const f of [Frame.battleship, Frame.carrier, Frame.ship, Frame.destroyer, Frame.submarine, Frame.transport]) {
      const own = shipSideCells(f, KM_PER_CELL) * pxPerCell;
      expect(SHIP_FRAME_MIN_PX[f]!, `frame ${f}`).toBeGreaterThan(2 * own);
    }
    expect(Math.max(...SHIP_FRAME_MIN_PX)).toBeLessThan(SLOT_SPACING * pxPerCell);
  });
});
