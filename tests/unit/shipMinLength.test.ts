import { describe, expect, it } from 'vitest';
import { ATLAS_FRAMES } from '../../src/render/units/atlas';
import { battleshipMinPx, SHIP_FRAME_MIN_PX, SHIP_MIN_PX, SHIP_ROOM_MAX_PX, shipFrameMinPx, shipSideCells, SLOT_GAP_CELLS } from '../../src/render/units/ships';
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

// PLAN 7.22b (critic run 8, naval 6: "at 1× a ship is about 20 to 30 px long at 15 m/px"): closer
// in, the least length grows with the gap between two slots on the screen, up to SHIP_ROOM_MAX_PX.
describe("a ship's least length grows with the room between ships (PLAN 7.22b)", () => {
  const slotPxAt = (m: number): number => (SLOT_GAP_CELLS * KM_PER_CELL * 1000) / m;
  const bbAt = (m: number): number => shipFrameMinPx(slotPxAt(m))[Frame.battleship]!;

  it("the render's slot gap is the sim's", () => {
    expect(SLOT_GAP_CELLS).toBe(SLOT_SPACING);
  });

  it('from 30 to 20.4 m/px it is what it was; 26.4 px at 20 m/px; 35 px at 15 m/px; 40 px from about 13 m/px in', () => {
    for (const m of [30, 25, 20.4]) expect(shipFrameMinPx(slotPxAt(m))).toEqual(SHIP_FRAME_MIN_PX);
    expect(bbAt(20)).toBeCloseTo(26.4, 1);
    expect(bbAt(15)).toBeCloseTo(35.2, 1);
    expect(bbAt(13)).toBe(SHIP_ROOM_MAX_PX);
    expect(bbAt(5)).toBe(SHIP_ROOM_MAX_PX);
    // Never less than before, at any gap.
    for (let px = 0; px < 200; px += 0.5) expect(battleshipMinPx(px)).toBeGreaterThanOrEqual(SHIP_MIN_PX);
  });

  it('from 20 m/px in, every ship is shorter than the gap to the next slot, and the classes keep their proportions', () => {
    for (let m = 20; m >= 1; m -= 0.25) {
      const floors = shipFrameMinPx(slotPxAt(m));
      expect(Math.max(...floors), `${m} m/px`).toBeLessThan(slotPxAt(m));
      for (let f = 0; f < ATLAS_FRAMES; f++) {
        if (!isShipFrame(f)) expect(floors[f]).toBe(0);
        else expect(floors[f]! / floors[Frame.battleship]!).toBeCloseTo(shipSideCells(f, KM_PER_CELL) / shipSideCells(Frame.battleship, KM_PER_CELL), 9);
      }
    }
  });

  it('a battleship is drawn its own length from 6.25 m/px in', () => {
    const own = (m: number): number => shipSideCells(Frame.battleship, KM_PER_CELL) * ((KM_PER_CELL * 1000) / m);
    expect(own(6.25)).toBeCloseTo(bbAt(6.25), 6);
    expect(own(6)).toBeGreaterThan(bbAt(6));
    expect(own(7)).toBeLessThan(bbAt(7));
  });
});
